import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BiometricHash from '@/lib/models/BiometricHash';
import VoteActivity from '@/lib/models/VoteActivity';
import { issueBiometricToken, getRekognitionClient } from '@/lib/biometric';
import { DetectFacesCommand, CompareFacesCommand } from '@aws-sdk/client-rekognition';
import { fetchFromIPFS } from '@/lib/ipfs';

export async function POST(req) {
  try {
    const { nullifierHash, image, electionId } = await req.json();

    if (!nullifierHash) {
      return NextResponse.json(
        { error: 'nullifierHash is required.' },
        { status: 400 }
      );
    }

    if (!image) {
      return NextResponse.json(
        { error: 'Image (base64 data URL) is required for biometric scan.' },
        { status: 400 }
      );
    }

    await connectDB();

    const rekognition = getRekognitionClient();
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const liveBuffer = Buffer.from(base64Data, 'base64');

    // 1. Liveness check: Detect faces in the live selfie
    const detectCmd = new DetectFacesCommand({
      Image: { Bytes: liveBuffer },
      Attributes: ['ALL']
    });
    
    const detectRes = await rekognition.send(detectCmd);
    if (!detectRes.FaceDetails || detectRes.FaceDetails.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Liveness check failed: No face detected in the camera feed.'
      }, { status: 400 });
    }
    if (detectRes.FaceDetails.length > 1) {
      return NextResponse.json({
        success: false,
        error: 'Liveness check failed: Multiple faces detected. Scan only one person.'
      }, { status: 400 });
    }

    const liveFace = detectRes.FaceDetails[0];
    if (liveFace.Confidence < 90) {
      return NextResponse.json({
        success: false,
        error: `Liveness check failed: Low face detection confidence (${Math.round(liveFace.Confidence)}%).`
      }, { status: 400 });
    }

    // Lighting check (Quality.Brightness)
    if (liveFace.Quality && liveFace.Quality.Brightness < 30) {
      return NextResponse.json({
        success: false,
        error: 'Liveness check failed: Lighting is too low. Please turn on lights or move to a brighter area.'
      }, { status: 400 });
    }

    // Eyeglasses & Sunglasses check
    const wearsGlasses = (liveFace.Eyeglasses && liveFace.Eyeglasses.Value === true && liveFace.Eyeglasses.Confidence > 80) ||
                         (liveFace.Sunglasses && liveFace.Sunglasses.Value === true && liveFace.Sunglasses.Confidence > 80);
    if (wearsGlasses) {
      return NextResponse.json({
        success: false,
        error: 'Liveness check failed: Please remove your glasses or sunglasses for biometric verification.'
      }, { status: 400 });
    }

    // Extract real face attributes for analytics dashboard
    const faceAttributes = {
      faceConfidence: liveFace.Confidence,
      gender: liveFace.Gender?.Value,
      genderConfidence: liveFace.Gender?.Confidence,
      ageRange: liveFace.AgeRange ? `${liveFace.AgeRange.Low} - ${liveFace.AgeRange.High} years old` : 'Unknown',
      brightness: liveFace.Quality?.Brightness,
      sharpness: liveFace.Quality?.Sharpness,
    };

    // 2. Fetch the registered biometric profile for this voter
    let record = await BiometricHash.findOne({ nullifierHash });

    let passed = false;
    let similarityScore = 100;

    if (record) {
      // Voter is already registered. Compare the live selfie against their own registered face image!
      let registeredImageBase64 = '';
      try {
        if (record.biometricHash.startsWith('mock-ipfs-cid-')) {
          throw new Error("Mock CID");
        }
        const ipfsData = await fetchFromIPFS(record.biometricHash);
        registeredImageBase64 = ipfsData.image;
      } catch (ipfsErr) {
        console.error('[biometric/verify] IPFS retrieval failed (using current image as fallback):', ipfsErr);
        registeredImageBase64 = image; 
      }

      const regBase64Data = registeredImageBase64.replace(/^data:image\/\w+;base64,/, "");
      const regBuffer = Buffer.from(regBase64Data, 'base64');

      const compareCmd = new CompareFacesCommand({
        SourceImage: { Bytes: liveBuffer },
        TargetImage: { Bytes: regBuffer },
        SimilarityThreshold: 85,
      });

      const compareRes = await rekognition.send(compareCmd);
      if (compareRes.FaceMatches && compareRes.FaceMatches.length > 0) {
        similarityScore = compareRes.FaceMatches[0].Similarity;
        passed = similarityScore >= 85;
      } else {
        similarityScore = compareRes.UnmatchedFaces && compareRes.UnmatchedFaces.length > 0 
          ? (100 - (compareRes.UnmatchedFaces[0].Confidence || 0))
          : 0;
        passed = false;
      }

      if (!passed) {
        return NextResponse.json({
          success: false,
          error: 'Biometric verification failed. Face does not match registered profile.',
          similarity: Math.round(similarityScore),
          requiredSimilarity: 85,
        }, { status: 401 });
      }

      // Update stats on successful verification
      record.lastVerifiedAt = new Date();
      record.verificationCount += 1;
      record.faceAttributes = faceAttributes;
      await record.save();

    } else {
      // 3. First time verification: Check duplicates ONLY against voters who actually voted in THIS election
      // If electionId is provided, scope the duplicate check per election.
      // This allows the same person to vote in Election 1, Election 2, etc. (distinct elections)
      // but blocks voting twice within the same election.
      const voteQuery = { voterNullifier: { $exists: true, $ne: '' } };
      if (electionId !== undefined && electionId !== null && electionId !== '') {
        voteQuery.electionId = Number(electionId);
      }

      const votedNullifiers = await VoteActivity.distinct('voterNullifier', voteQuery);

      let duplicateFound = false;

      if (votedNullifiers.length > 0) {
        // Only compare against biometric profiles of voters who actually voted in this election
        const votedRecords = await BiometricHash.find({
          nullifierHash: { $in: votedNullifiers, $ne: nullifierHash }
        });

        for (const other of votedRecords) {
          try {
            let otherImageBase64 = '';
            if (other.biometricHash.startsWith('data:image/')) {
              otherImageBase64 = other.biometricHash;
            } else if (other.biometricHash.startsWith('mock-ipfs-cid-') || other.biometricHash.startsWith('data-local-selfie-')) {
              continue;
            } else {
              const ipfsData = await fetchFromIPFS(other.biometricHash);
              otherImageBase64 = ipfsData.image;
            }

            if (otherImageBase64) {
              const otherBase64Data = otherImageBase64.replace(/^data:image\/\w+;base64,/, "");
              const otherBuffer = Buffer.from(otherBase64Data, 'base64');

              const compCmd = new CompareFacesCommand({
                SourceImage: { Bytes: liveBuffer },
                TargetImage: { Bytes: otherBuffer },
                SimilarityThreshold: 85,
              });

              const compRes = await rekognition.send(compCmd);
              if (compRes.FaceMatches && compRes.FaceMatches.length > 0) {
                if (compRes.FaceMatches[0].Similarity >= 85) {
                  duplicateFound = true;
                  break;
                }
              }
            }
          } catch (compErr) {
            console.error('[biometric/verify] Comparison with voted record failed:', compErr);
          }
        }
      }

      if (duplicateFound) {
        return NextResponse.json({
          success: false,
          error: 'Duplicate vote detected: This face has already cast a vote in this election.'
        }, { status: 400 });
      }

      // 4. Unique face -> Save face image to IPFS
      let ipfsCid = '';
      try {
        const { pinJSON } = await import('@/lib/ipfs');
        ipfsCid = await pinJSON({
          image,
          timestamp: new Date().toISOString()
        });
      } catch (ipfsErr) {
        console.error('[biometric/verify] IPFS pin failed:', ipfsErr);
        ipfsCid = 'data-local-selfie-' + Date.now();
      }

      // 5. Create new voter biometric profile record in MongoDB
      record = await BiometricHash.create({
        nullifierHash,
        biometricHash: ipfsCid,
        faceConfidence: liveFace.Confidence,
        provider: 'aws-rekognition',
        faceAttributes,
        registeredAt: new Date(),
        lastVerifiedAt: new Date(),
        verificationCount: 1
      });
    }

    // 6. Issue 60s JWT token
    const token = issueBiometricToken(nullifierHash);

    return NextResponse.json({
      success: true,
      message: 'Biometric verification successful.',
      similarity: Math.round(similarityScore),
      token,
      faceAttributes
    });

  } catch (err) {
    console.error('[biometric/verify] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Biometric verification failed.' },
      { status: 500 }
    );
  }
}

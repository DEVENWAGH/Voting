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
    let faceId = '';

    const { searchFaceFromBase64, indexFaceFromBase64 } = await import('@/lib/aws');
    const matches = await searchFaceFromBase64(image, 5, 85);

    // Find any match that belongs to a different voter
    const otherMatch = matches.find(m => m.nullifierHash !== nullifierHash);

    if (record) {
      const hasTwinBypass = record.bypassDuplicateCheck || record.twinVerificationStatus === 'approved';

      // 1. Check if face matches another voter
      if (otherMatch && !hasTwinBypass) {
        return NextResponse.json({
          success: false,
          error: 'Duplicate vote detected: This face has already cast a vote in this election (or is a matching twin).',
          isDuplicate: true,
          similarity: Math.round(otherMatch.similarity),
        }, { status: 400 });
      }

      // 2. Verify identity: self-match in Rekognition Collection
      const selfMatch = matches.find(m => m.nullifierHash === nullifierHash);
      if (selfMatch) {
        similarityScore = selfMatch.similarity;
        passed = true;
        faceId = selfMatch.faceId;
      } else {
        // Fallback: Compare directly against registered image from IPFS
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

        try {
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
            
            // Index the face now since it wasn't indexed in the collection
            const indexRes = await indexFaceFromBase64(nullifierHash, image);
            faceId = indexRes?.faceId || '';
          }
        } catch (compErr) {
          console.error('[biometric/verify] CompareFaces fallback failed:', compErr);
        }
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
      if (faceId && !record.faceId) {
        record.faceId = faceId;
      }
      await record.save();

    } else {
      // 3. First time verification: Check duplicates
      const hasTwinBypass = false;

      if (otherMatch && !hasTwinBypass) {
        let matchedEmail = '';
        const matchedVoter = await Voter.findOne({ nullifierHash: otherMatch.nullifierHash });
        if (matchedVoter) {
          matchedEmail = matchedVoter.email;
        }

        // Save pending twin record
        await BiometricHash.findOneAndUpdate(
          { nullifierHash },
          {
            nullifierHash,
            biometricHash: `pending-twin-override-for-${otherMatch.nullifierHash}`,
            faceConfidence: liveFace.Confidence / 100,
            provider: 'aws-rekognition',
            registeredAt: new Date(),
            twinVerificationStatus: 'pending',
            twinMatchedNullifier: otherMatch.nullifierHash,
            twinMatchedEmail: matchedEmail,
            twinMatchSimilarity: Math.round(otherMatch.similarity),
            twinNotes: 'Automatically flagged: high similarity match during voting-time registration.',
            faceAttributes,
          },
          { upsert: true }
        );

        return NextResponse.json({
          success: false,
          error: 'Duplicate vote detected: This face matches another registered voter. If you are an identical twin, please request a Twin Verification Override.',
          isDuplicate: true,
          similarity: Math.round(otherMatch.similarity),
          matchedNullifier: otherMatch.nullifierHash
        }, { status: 400 });
      }

      // 4. Index in AWS Rekognition collection
      const indexRes = await indexFaceFromBase64(nullifierHash, image);
      faceId = indexRes?.faceId || '';

      // 5. Unique face -> Save face image to IPFS
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

      // 6. Create new voter biometric profile record in MongoDB
      record = await BiometricHash.create({
        nullifierHash,
        biometricHash: ipfsCid,
        faceConfidence: liveFace.Confidence,
        provider: 'aws-rekognition',
        faceAttributes,
        faceId,
        twinVerificationStatus: 'none',
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

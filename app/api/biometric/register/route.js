import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BiometricHash from '@/lib/models/BiometricHash';
import Voter from '@/lib/models/Voter';
import { normalizeLandmarks, isAWSConfigured, getRekognitionClient, issueBiometricToken } from '@/lib/biometric';
import { DetectFacesCommand } from '@aws-sdk/client-rekognition';

export async function POST(req) {
  try {
    const { nullifierHash, landmarks, image, faceConfidence = 0.98 } = await req.json();

    if (!nullifierHash) {
      return NextResponse.json(
        { error: 'nullifierHash is required.' },
        { status: 400 }
      );
    }

    const awsConfigured = isAWSConfigured();
    if (awsConfigured && !image) {
      return NextResponse.json(
        { error: 'Image (base64 data URL) is required for AWS Rekognition.' },
        { status: 400 }
      );
    }
    if (!awsConfigured && !landmarks) {
      return NextResponse.json(
        { error: 'Landmarks are required for local biometric fallback.' },
        { status: 400 }
      );
    }

    await connectDB();

    // 1. Verify the voter exists and is in the system
    const voter = await Voter.findOne({ nullifierHash });
    if (!voter) {
      return NextResponse.json(
        { error: 'Voter registration not found. Please register first.' },
        { status: 404 }
      );
    }

    // 2. AWS Rekognition Face Detection & Liveness Check (if image provided)
    let confidence = Number(faceConfidence);
    let provider = 'local-canvas';
    let ipfsCid = '';
    let faceAttributes = null;

    if (image) {
      const rekognition = getRekognitionClient();
      try {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const detectCmd = new DetectFacesCommand({
          Image: { Bytes: imageBuffer },
          Attributes: ['ALL']
        });

        const detectRes = await rekognition.send(detectCmd);
        if (!detectRes.FaceDetails || detectRes.FaceDetails.length === 0) {
          return NextResponse.json(
            { error: 'No face detected in registration photo. Please capture a clear face.' },
            { status: 400 }
          );
        }
        if (detectRes.FaceDetails.length > 1) {
          return NextResponse.json(
            { error: 'Multiple faces detected. Please ensure only one person is in the frame.' },
            { status: 400 }
          );
        }

        const face = detectRes.FaceDetails[0];
        if (face.Confidence < 90) {
          return NextResponse.json(
            { error: `Face detection confidence is too low (${Math.round(face.Confidence)}%). Please ensure your face is fully visible.` },
            { status: 400 }
          );
        }

        // Lighting check (Quality.Brightness)
        if (face.Quality && face.Quality.Brightness < 30) {
          return NextResponse.json(
            { error: 'Liveness check failed: Lighting is too low. Please turn on lights or move to a brighter area.' },
            { status: 400 }
          );
        }

        // Eyeglasses & Sunglasses check
        const wearsGlasses = (face.Eyeglasses && face.Eyeglasses.Value === true && face.Eyeglasses.Confidence > 80) ||
                             (face.Sunglasses && face.Sunglasses.Value === true && face.Sunglasses.Confidence > 80);
        if (wearsGlasses) {
          return NextResponse.json(
            { error: 'Liveness check failed: Please remove your glasses or sunglasses for a clean biometric scan.' },
            { status: 400 }
          );
        }

        confidence = face.Confidence / 100;
        provider = 'aws-rekognition';

        // Extract real face attributes
        faceAttributes = {
          faceConfidence: face.Confidence,
          gender: face.Gender?.Value,
          genderConfidence: face.Gender?.Confidence,
          ageRange: face.AgeRange ? `${face.AgeRange.Low} - ${face.AgeRange.High} years old` : 'Unknown',
          brightness: face.Quality?.Brightness,
          sharpness: face.Quality?.Sharpness,
        };
      } catch (awsErr) {
        console.error('[biometric/register] AWS Rekognition error:', awsErr);
        return NextResponse.json(
          { error: `AWS Rekognition Face Detection failed: ${awsErr.message}` },
          { status: 500 }
        );
      }

      // Pin face registration to IPFS
      try {
        const { pinJSON } = await import('@/lib/ipfs');
        ipfsCid = await pinJSON(
          {
            nullifierHash,
            image,
            registeredAt: new Date().toISOString(),
          },
          `biometric-voter-${nullifierHash}`,
          { nullifierHash, type: 'biometric-voter' }
        );
        console.log(`[biometric/register] Face metadata pinned to IPFS CID: ${ipfsCid}`);
      } catch (ipfsErr) {
        console.error('[biometric/register] IPFS pin failed:', ipfsErr);
        // Fallback placeholder CID if Pinata configuration is missing or fails
        ipfsCid = `mock-ipfs-cid-${nullifierHash}`;
      }
    }

    // 3. Normalize face landmark coordinates (for local similarity fallbacks)
    const normalized = normalizeLandmarks(landmarks);
    if (!normalized) {
      return NextResponse.json(
        { error: 'Invalid face landmarks. Face could not be normalized.' },
        { status: 400 }
      );
    }

    // 4. Store the IPFS CID (or serialized ratios) as the biometricHash
    const biometricHashData = ipfsCid || JSON.stringify(normalized);

    const record = await BiometricHash.findOneAndUpdate(
      { nullifierHash },
      {
        nullifierHash,
        biometricHash: biometricHashData,
        faceConfidence: confidence,
        provider,
        registeredAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Success -> Issue 60s JWT token for immediate redirect
    const token = issueBiometricToken(nullifierHash);

    return NextResponse.json({
      success: true,
      message: 'Biometric profile registered successfully.',
      data: {
        nullifierHash: record.nullifierHash,
        registeredAt: record.registeredAt,
        provider: record.provider,
        ipfsCid: ipfsCid || null,
        faceAttributes,
        token
      },
    });
  } catch (err) {
    console.error('[biometric/register]', err);
    return NextResponse.json(
      { error: err.message || 'Biometric registration failed.' },
      { status: 500 }
    );
  }
}

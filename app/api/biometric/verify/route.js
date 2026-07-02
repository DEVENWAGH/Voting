/**
 * POST /api/biometric/verify
 * Verifies face landmarks against the registered biometric profile and issues a 60-second JWT.
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BiometricHash from '@/lib/models/BiometricHash';
import { normalizeLandmarks, calculateSimilarity, issueBiometricToken } from '@/lib/biometric';

const SIMILARITY_THRESHOLD = 0.92; // 92% similarity required for verification

export async function POST(req) {
  try {
    const { nullifierHash, landmarks } = await req.json();

    if (!nullifierHash || !landmarks) {
      return NextResponse.json(
        { error: 'nullifierHash and landmarks are required.' },
        { status: 400 }
      );
    }

    await connectDB();

    // 1. Fetch the registered biometric profile
    const record = await BiometricHash.findOne({ nullifierHash });
    if (!record) {
      return NextResponse.json(
        { error: 'Biometric profile not registered for this voter.' },
        { status: 404 }
      );
    }

    // 2. Normalize the incoming landmarks
    const incomingNormalized = normalizeLandmarks(landmarks);
    if (!incomingNormalized) {
      return NextResponse.json(
        { error: 'Invalid face landmarks. Face could not be normalized.' },
        { status: 400 }
      );
    }

    // 3. Parse the registered normalized landmarks
    let registeredNormalized;
    try {
      registeredNormalized = JSON.parse(record.biometricHash);
    } catch (parseErr) {
      return NextResponse.json(
        { error: 'Stored biometric profile is corrupted.' },
        { status: 500 }
      );
    }

    // 4. Calculate similarity
    const similarity = calculateSimilarity(registeredNormalized, incomingNormalized);
    const passed = similarity >= SIMILARITY_THRESHOLD;

    if (!passed) {
      return NextResponse.json({
        success: false,
        error: 'Biometric verification failed. Face does not match registered profile.',
        similarity: Math.round(similarity * 100),
        requiredSimilarity: Math.round(SIMILARITY_THRESHOLD * 100),
      }, { status: 401 });
    }

    // 5. Success -> Issue 60s JWT token
    const token = issueBiometricToken(nullifierHash);

    // Update stats
    record.lastVerifiedAt = new Date();
    record.verificationCount += 1;
    await record.save();

    return NextResponse.json({
      success: true,
      message: 'Biometric verification successful.',
      similarity: Math.round(similarity * 100),
      token,
    });
  } catch (err) {
    console.error('[biometric/verify]', err);
    return NextResponse.json(
      { error: err.message || 'Biometric verification failed.' },
      { status: 500 }
    );
  }
}

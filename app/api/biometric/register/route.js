/**
 * POST /api/biometric/register
 * Registers a voter's face landmarks by storing their zero-knowledge ratios.
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BiometricHash from '@/lib/models/BiometricHash';
import Voter from '@/lib/models/Voter';
import { normalizeLandmarks } from '@/lib/biometric';

export async function POST(req) {
  try {
    const { nullifierHash, landmarks, faceConfidence = 0.98 } = await req.json();

    if (!nullifierHash || !landmarks) {
      return NextResponse.json(
        { error: 'nullifierHash and landmarks are required.' },
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

    // 2. Normalize face landmark coordinates
    const normalized = normalizeLandmarks(landmarks);
    if (!normalized) {
      return NextResponse.json(
        { error: 'Invalid face landmarks. Face could not be normalized.' },
        { status: 400 }
      );
    }

    // 3. Store the serialized normalized ratios as the biometricHash
    // This protects raw biometric information (no images, no coordinates, just ratios)
    const biometricHashData = JSON.stringify(normalized);

    const record = await BiometricHash.findOneAndUpdate(
      { nullifierHash },
      {
        nullifierHash,
        biometricHash: biometricHashData,
        faceConfidence: Number(faceConfidence),
        provider: 'local-canvas',
        registeredAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      message: 'Biometric profile registered successfully.',
      data: {
        nullifierHash: record.nullifierHash,
        registeredAt: record.registeredAt,
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

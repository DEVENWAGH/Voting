import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BiometricHash from '@/lib/models/BiometricHash';
import Voter from '@/lib/models/Voter';

export async function POST(req) {
  try {
    const { email, orgSlug, electionId, nullifierHash } = await req.json();

    if (!nullifierHash) {
      return NextResponse.json({ error: 'nullifierHash is required.' }, { status: 400 });
    }

    await connectDB();

    // 1. Verify the voter exists
    const voter = await Voter.findOne({ nullifierHash });
    if (!voter) {
      return NextResponse.json({ error: 'Voter not found.' }, { status: 404 });
    }

    // 2. Fetch or create the biometric record and set twin status to pending
    let record = await BiometricHash.findOne({ nullifierHash });

    if (!record) {
      record = await BiometricHash.create({
        nullifierHash,
        biometricHash: 'pending-initial-twin-submission',
        faceConfidence: 0.9,
        provider: 'aws-rekognition',
        twinVerificationStatus: 'pending',
        twinNotes: 'User submitted twin verification request.',
        registeredAt: new Date(),
      });
    } else {
      record.twinVerificationStatus = 'pending';
      if (!record.twinNotes) {
        record.twinNotes = 'User requested twin verification override.';
      }
      await record.save();
    }

    return NextResponse.json({
      success: true,
      message: 'Twin verification override requested successfully.',
      status: record.twinVerificationStatus,
    });
  } catch (err) {
    console.error('[biometric/twin-request] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit twin request.' }, { status: 500 });
  }
}

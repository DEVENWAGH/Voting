import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BiometricHash from '@/lib/models/BiometricHash';
import { issueBiometricToken } from '@/lib/biometric';

/**
 * GET /api/biometric/status?nullifierHash=...
 * Returns whether a voter has a pre-existing biometric profile.
 * If they do, also issues a fresh permanent token so they can skip re-verification.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const nullifierHash = searchParams.get('nullifierHash');

    if (!nullifierHash) {
      return NextResponse.json({ error: 'nullifierHash is required.' }, { status: 400 });
    }

    await connectDB();

    const record = await BiometricHash.findOne({ nullifierHash });

    if (!record) {
      return NextResponse.json({ verified: false, registered: false });
    }

    return NextResponse.json({
      registered: true,
      verified: false, // Enforce face scanning every time they vote
      twinVerificationStatus: record.twinVerificationStatus || 'none',
      bypassDuplicateCheck: record.bypassDuplicateCheck || false,
      verificationCount: record.verificationCount,
      lastVerifiedAt: record.lastVerifiedAt,
      faceAttributes: record.faceAttributes,
    });
  } catch (err) {
    console.error('[biometric/status] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

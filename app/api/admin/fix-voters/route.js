/**
 * POST /api/admin/fix-voters
 * Clears all existing voter registrations so they can be re-registered
 * with the fixed nullifier hash formula (orgSlug:email:secret).
 * 
 * This is a one-time migration endpoint. Only call after deploying the nullifier fix.
 * Body: { confirm: true }
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';

export async function POST(req) {
  try {
    const { confirm } = await req.json();
    if (!confirm) {
      return NextResponse.json({ error: 'Send { confirm: true } to proceed' }, { status: 400 });
    }

    await connectDB();

    // Reset all registered voters back to pending so they can be
    // bulk-registered again with the corrected nullifier hash
    const result = await Voter.updateMany(
      { status: 'registered' },
      {
        $set: { status: 'pending', nullifierHash: null, onChainTxHash: '', registeredAt: null },
      }
    );

    // Also reset rejected voters
    const rejected = await Voter.updateMany(
      { status: 'rejected' },
      {
        $set: { status: 'pending', nullifierHash: null, onChainTxHash: '', rejectionReason: '', registeredAt: null },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'All voter registrations reset to pending. Re-run bulk-register for each election.',
      resetRegistered: result.modifiedCount,
      resetRejected: rejected.modifiedCount,
    });
  } catch (err) {
    console.error('[admin/fix-voters]', err);
    return NextResponse.json({ error: err.message || 'Reset failed' }, { status: 500 });
  }
}

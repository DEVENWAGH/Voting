/**
 * POST /api/admin/elections/approve
 * Guardian approves an election → transitions it on-chain from Registration → Voting
 * 
 * Body: { electionId: number, guardianAddress: string, action: 'approve' | 'reject' }
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import { relayTransitionPhase } from '@/lib/relay';

export async function POST(req) {
  try {
    const { electionId, guardianAddress, action } = await req.json();

    if (electionId === undefined || electionId === null) {
      return NextResponse.json({ error: 'electionId is required' }, { status: 400 });
    }
    if (!guardianAddress) {
      return NextResponse.json({ error: 'guardianAddress is required' }, { status: 400 });
    }
    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

    await connectDB();

    const electionDoc = await Election.findOne({ electionId: Number(electionId) });
    if (!electionDoc) {
      return NextResponse.json({ error: 'Election not found' }, { status: 404 });
    }

    if (!electionDoc.pendingApproval && action === 'approve') {
      return NextResponse.json({ error: 'This election has not requested go-live approval' }, { status: 400 });
    }

    if (action === 'reject') {
      // Guardian rejects — reset the pending flag, stays in Registration
      await Election.findOneAndUpdate(
        { electionId: Number(electionId) },
        { pendingApproval: false }
      );
      return NextResponse.json({
        success: true,
        message: 'Election go-live request rejected. It remains in Registration phase.',
      });
    }

    // ACTION: approve
    // Transition on-chain: Registration(0) → Voting(1)
    const { txHash } = await relayTransitionPhase(Number(electionId), 1);

    // Update MongoDB
    await Election.findOneAndUpdate(
      { electionId: Number(electionId) },
      {
        phase:              1,
        pendingApproval:    false,
        guardianApproved:   true,
        guardianApprovedBy: guardianAddress,
        guardianApprovedAt: new Date(),
      }
    );

    return NextResponse.json({
      success: true,
      txHash,
      message: `Election #${electionId} approved and is now LIVE for voters!`,
    });
  } catch (err) {
    console.error('[admin/elections/approve POST]', err);
    return NextResponse.json({ error: err.message || 'Approval failed' }, { status: 500 });
  }
}

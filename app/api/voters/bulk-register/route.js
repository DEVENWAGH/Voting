/**
 * POST /api/voters/bulk-register
 * Takes a batchId, registers all pending voters on-chain via relay.
 * Body: { batchId, orgId }
 */
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import VoterUploadBatch from '@/lib/models/VoterUploadBatch';
import { relayRegisterVoter } from '@/lib/relay';

export async function POST(req) {
  try {
    const { batchId, orgId } = await req.json();
    if (!batchId || !orgId) {
      return NextResponse.json({ error: 'batchId and orgId are required' }, { status: 400 });
    }

    await connectDB();

    const batch = await VoterUploadBatch.findById(batchId);
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    if (batch.status === 'registering') {
      return NextResponse.json({ error: 'Registration already in progress' }, { status: 409 });
    }

    await VoterUploadBatch.findByIdAndUpdate(batchId, { status: 'registering' });

    const pendingVoters = await Voter.find({ uploadBatchId: batchId, status: 'pending' });
    if (pendingVoters.length === 0) {
      await VoterUploadBatch.findByIdAndUpdate(batchId, { status: 'completed', completedAt: new Date() });
      return NextResponse.json({ success: true, message: 'No pending voters to register', registered: 0 });
    }

    let registered = 0;
    let failed = 0;
    const failedVoters = [];

    for (const voter of pendingVoters) {
      try {
        // Compute nullifier server-side — no PII on-chain
        const nullifierHash = ethers.keccak256(
          ethers.toUtf8Bytes(
            `${orgId}:${voter.memberId}:${process.env.SERVER_IDENTITY_SECRET}`
          )
        );

        const { txHash } = await relayRegisterVoter(nullifierHash);

        await Voter.findByIdAndUpdate(voter._id, {
          status: 'registered',
          nullifierHash,
          registeredAt: new Date(),
          onChainTxHash: txHash,
        });
        registered++;
      } catch (err) {
        console.error('[bulk-register] voter', voter.memberId, err.message);
        await Voter.findByIdAndUpdate(voter._id, {
          status: 'rejected',
          rejectionReason: err.message,
        });
        failedVoters.push(voter.memberId);
        failed++;
      }
    }

    await VoterUploadBatch.findByIdAndUpdate(batchId, {
      status: failed === pendingVoters.length ? 'failed' : 'completed',
      registeredRows: registered,
      completedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      registered,
      failed,
      failedMemberIds: failedVoters,
    });
  } catch (err) {
    console.error('[bulk-register]', err);
    return NextResponse.json({ error: 'Bulk registration failed' }, { status: 500 });
  }
}

/** GET /api/voters/bulk-register?batchId=xxx — check status */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    if (!batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 });

    await connectDB();
    const batch = await VoterUploadBatch.findById(batchId);
    if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 });

    return NextResponse.json({ batch });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch batch' }, { status: 500 });
  }
}

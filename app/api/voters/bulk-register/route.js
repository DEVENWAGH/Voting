/**
 * POST /api/voters/bulk-register
 * Registers all pending voters for an election on-chain via relay.
 * Body: { orgSlug, electionId }
 *
 * GET  /api/voters/bulk-register?orgSlug=xxx&electionId=0  — check pending count
 */
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import { relayRegisterVoter, resetRelayNonce } from '@/lib/relay';

export async function POST(req) {
  try {
    const { orgSlug, electionId } = await req.json();
    if (!orgSlug) {
      return NextResponse.json({ error: 'orgSlug is required' }, { status: 400 });
    }
    if (electionId == null || electionId === '') {
      return NextResponse.json({ error: 'electionId is required' }, { status: 400 });
    }

    await connectDB();

    const pendingVoters = await Voter.find({ orgSlug, electionId: Number(electionId), status: 'pending' });
    if (pendingVoters.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending voters to register', registered: 0 });
    }

    // Reset cached nonce before bulk operations to sync with the chain
    resetRelayNonce();

    let registered = 0;
    let failed = 0;
    const failedVoters = [];

    for (const voter of pendingVoters) {
      const label = voter.memberId || voter.email;
      let success = false;

      // Retry up to 3 times to handle nonce desync with Hardhat automining
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          // CANONICAL nullifier formula: orgSlug:email:secret
          // Must match send-otp and verify-otp exactly
          const secret = process.env.SERVER_IDENTITY_SECRET || 'dev-identity-secret-change-in-prod-12345';
          const cleanEmail = voter.email.toLowerCase().trim();
          const nullifierHash = ethers.keccak256(
            ethers.toUtf8Bytes(`${orgSlug}:${cleanEmail}:${secret}`)
          );

          const { txHash } = await relayRegisterVoter(nullifierHash);

          await Voter.findByIdAndUpdate(voter._id, {
            status: 'registered',
            nullifierHash,
            registeredAt: new Date(),
            onChainTxHash: txHash,
          });
          registered++;
          success = true;
        } catch (err) {
          // If nonce error, reset and retry
          if (err.code === 'NONCE_EXPIRED' || err.message?.includes('Nonce too low')) {
            console.warn(`[bulk-register] nonce error for ${label}, retrying (attempt ${attempt + 1})...`);
            resetRelayNonce();
            continue;
          }
          // Non-nonce error — mark rejected and move on
          console.error('[bulk-register] voter', label, err.message);
          await Voter.findByIdAndUpdate(voter._id, {
            status: 'rejected',
            rejectionReason: err.message,
          });
          failedVoters.push(label);
          failed++;
          success = true; // break out of retry loop
        }
      }

      // Exhausted retries without success
      if (!success) {
        console.error('[bulk-register] voter', label, 'failed after 3 nonce retries');
        await Voter.findByIdAndUpdate(voter._id, {
          status: 'rejected',
          rejectionReason: 'Nonce desync — failed after 3 retries',
        });
        failedVoters.push(label);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      registered,
      failed,
      failedVoters,
    });

  } catch (err) {
    console.error('[bulk-register]', err);
    return NextResponse.json({ error: 'Bulk registration failed' }, { status: 500 });
  }
}

/** GET /api/voters/bulk-register?orgSlug=xxx&electionId=0 — check pending count */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgSlug    = searchParams.get('orgSlug');
    const electionId = searchParams.get('electionId');
    if (!orgSlug)    return NextResponse.json({ error: 'orgSlug required' }, { status: 400 });
    if (electionId == null) return NextResponse.json({ error: 'electionId required' }, { status: 400 });

    const eid = Number(electionId);
    await connectDB();
    const pending    = await Voter.countDocuments({ orgSlug, electionId: eid, status: 'pending' });
    const registered = await Voter.countDocuments({ orgSlug, electionId: eid, status: 'registered' });
    const rejected   = await Voter.countDocuments({ orgSlug, electionId: eid, status: 'rejected' });

    return NextResponse.json({ pending, registered, rejected, total: pending + registered + rejected });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch voter counts' }, { status: 500 });
  }
}

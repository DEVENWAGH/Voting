/**
 * POST /api/voters/bulk-register
 * Registers all pending voters for an election on-chain via relay.
 * Body: { orgSlug, electionId }
 *
 * GET  /api/voters/bulk-register?orgSlug=xxx&electionId=0xabc...  — check pending count
 *
 * NOTE: Auto-registration now happens during CSV upload. This endpoint
 * serves as a manual fallback/retry if some voters failed during upload.
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import { relayRegisterVoter, resetRelayNonce, isVoterRegisteredOnChain } from '@/lib/relay';
import { computeNullifierHash, isAlreadyRegisteredError } from '@/lib/voterIdentity';

async function linkExistingVoter(voter, nullifierHash) {
  await Voter.findByIdAndUpdate(voter._id, {
    status: 'registered',
    nullifierHash,
    registeredAt: new Date(),
    onChainTxHash: 'linked-existing',
    rejectionReason: '',
  });
}

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

    const eid = String(electionId);
    // Include voters previously rejected only because they were already on-chain from another election
    const votersToRegister = await Voter.find({
      orgSlug,
      electionId: eid,
      $or: [
        { status: 'pending' },
        { status: 'rejected', rejectionReason: /already registered|transaction execution reverted/i },
      ],
    });
    if (votersToRegister.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending voters to register', registered: 0 });
    }

    // Reset cached nonce before bulk operations to sync with the chain
    resetRelayNonce();

    let registered = 0;
    let linked = 0;
    let failed = 0;
    const failedVoters = [];

    for (const voter of votersToRegister) {
      const label = voter.memberId || voter.email;
      let success = false;
      const nullifierHash = computeNullifierHash(orgSlug, voter.email);

      // Per-election on-chain registration — skip tx if already registered for this election
      try {
        if (await isVoterRegisteredOnChain(eid, nullifierHash)) {
          await linkExistingVoter(voter, nullifierHash);
          linked++;
          continue;
        }
      } catch (checkErr) {
        console.warn(`[bulk-register] on-chain check failed for ${label}:`, checkErr.message);
      }

      // Retry up to 3 times to handle nonce desync with Hardhat automining
      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          const { txHash } = await relayRegisterVoter(eid, nullifierHash);

          await Voter.findByIdAndUpdate(voter._id, {
            status: 'registered',
            nullifierHash,
            registeredAt: new Date(),
            onChainTxHash: txHash,
            rejectionReason: '',
          });
          registered++;
          success = true;
        } catch (err) {
          // If nonce error, reset and retry
          if (err.code === 'NONCE_EXPIRED' || err.message?.includes('Nonce too low') || err.message?.includes('nonce has already been used')) {
            console.warn(`[bulk-register] nonce error for ${label}, retrying (attempt ${attempt + 1})...`);
            resetRelayNonce();
            continue;
          }
          // Voter may already be registered for this election
          if (isAlreadyRegisteredError(err)) {
            await linkExistingVoter(voter, nullifierHash);
            linked++;
            success = true;
            continue;
          }
          // Sepolia often omits revert reason — verify on-chain before marking failed
          try {
            if (await isVoterRegisteredOnChain(eid, nullifierHash)) {
              await linkExistingVoter(voter, nullifierHash);
              linked++;
              success = true;
              continue;
            }
          } catch {
            // fall through to rejected
          }
          resetRelayNonce();
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
      linked,
      failed,
      failedVoters,
      message: linked > 0
        ? `${registered} newly registered, ${linked} linked from prior registration (no extra gas).`
        : undefined,
    });

  } catch (err) {
    console.error('[bulk-register]', err);
    return NextResponse.json({ error: 'Bulk registration failed' }, { status: 500 });
  }
}

/** GET /api/voters/bulk-register?orgSlug=xxx&electionId=0xabc... — check pending count */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgSlug    = searchParams.get('orgSlug');
    const electionId = searchParams.get('electionId');
    if (!orgSlug)    return NextResponse.json({ error: 'orgSlug required' }, { status: 400 });
    if (electionId == null) return NextResponse.json({ error: 'electionId required' }, { status: 400 });

    const eid = String(electionId);
    await connectDB();
    const pending    = await Voter.countDocuments({ orgSlug, electionId: eid, status: 'pending' });
    const registered = await Voter.countDocuments({ orgSlug, electionId: eid, status: 'registered' });
    const rejected   = await Voter.countDocuments({ orgSlug, electionId: eid, status: 'rejected' });

    return NextResponse.json({ pending, registered, rejected, total: pending + registered + rejected });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch voter counts' }, { status: 500 });
  }
}

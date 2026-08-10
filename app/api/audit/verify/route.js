/**
 * GET /api/audit/verify?txHash=0x...
 * Public vote verification — confirm a transaction was recorded on-chain.
 *
 * PRIVACY — RECEIPT-FREENESS:
 *   This endpoint intentionally does NOT return candidateId or candidateName.
 *   Exposing the vote choice via txHash would allow coercers to verify a
 *   voter's selection, breaking coercion resistance. The endpoint confirms
 *   only that a vote transaction exists and is valid.
 */
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import connectDB from '@/lib/db';
import VoteActivity from '@/lib/models/VoteActivity';
import Election from '@/lib/models/Election';
import Organization from '@/lib/models/Organization';

async function getReadContract() {
  const abi = (
    await import('@/lib/contracts/VotingV1.json', { assert: { type: 'json' } })
  ).default.abi;
  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL || 'http://127.0.0.1:8545',
  );
  return new ethers.Contract(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
    abi,
    provider,
  );
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const txHash = (searchParams.get('txHash') || '').trim();

    if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
      return NextResponse.json(
        { success: false, error: 'A valid transaction hash is required (0x + 64 hex chars).' },
        { status: 400 },
      );
    }

    await connectDB();

    const provider = new ethers.JsonRpcProvider(
      process.env.RPC_URL || 'http://127.0.0.1:8545',
    );

    const [receipt, activity] = await Promise.all([
      provider.getTransactionReceipt(txHash).catch(() => null),
      VoteActivity.findOne({ txHash }).lean(),
    ]);

    if (!receipt && !activity) {
      return NextResponse.json({
        success: false,
        verified: false,
        error: 'Transaction not found on-chain or in the vote ledger.',
      });
    }

    const contractAddress = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').toLowerCase();
    const onContract = receipt
      ? receipt.to?.toLowerCase() === contractAddress
      : false;
    const status = receipt?.status === 1 ? 'success' : receipt ? 'failed' : 'unknown';

    let electionId = activity?.electionId ?? null;
    let electionTitle = null;
    let orgName = null;
    let orgSlug = null;
    let blockNumber = receipt?.blockNumber ?? activity?.blockNumber ?? null;
    let timestamp = activity?.timestamp ?? null;

    // Parse VoteCast event from receipt logs if MongoDB has no record
    // PRIVACY: We extract electionId for context, but NOT candidateId
    if (receipt && onContract && electionId == null) {
      const iface = new ethers.Interface(
        (await import('@/lib/contracts/VotingV1.json', { assert: { type: 'json' } })).default.abi,
      );
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === 'VoteCast') {
            electionId = parsed.args[0]; // bytes32 hex string
            // candidateId intentionally NOT extracted — receipt-freeness
            break;
          }
        } catch {
          // not our event
        }
      }
    }

    if (electionId != null) {
      const election = await Election.findOne({ electionId }).lean();
      if (election) {
        electionTitle = election.title;
        orgSlug = election.orgSlug;
        if (election.orgSlug) {
          const org = await Organization.findOne({ slug: election.orgSlug }).lean();
          orgName = org?.name || election.orgSlug;
        }
      }
      // PRIVACY: candidateId/candidateName intentionally NOT looked up.
      // Exposing vote choice via txHash breaks receipt-freeness.
    }

    if (!timestamp && blockNumber) {
      try {
        const block = await provider.getBlock(blockNumber);
        if (block?.timestamp) timestamp = new Date(block.timestamp * 1000);
      } catch {
        // optional
      }
    }

    const verified = Boolean(
      (receipt && receipt.status === 1 && onContract) || activity,
    );

    return NextResponse.json({
      success: true,
      verified,
      txHash,
      status,
      onContract,
      blockNumber,
      timestamp,
      electionId,
      electionTitle,
      orgSlug,
      orgName,
      // candidateId and candidateName intentionally omitted for receipt-freeness
      message: verified
        ? 'Vote transaction verified on the blockchain. For voter privacy, the candidate choice is not disclosed.'
        : 'Transaction found but could not be fully verified as a successful vote.',
    });
  } catch (err) {
    console.error('[audit/verify]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

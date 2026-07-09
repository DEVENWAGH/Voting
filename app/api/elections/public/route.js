/**
 * GET /api/elections/public
 * Global public election ledger — live + completed elections across all orgs.
 */
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import connectDB from '@/lib/db';
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

export async function GET() {
  try {
    await connectDB();

    const dbElections = await Election.find({ orgSlug: { $ne: '' } })
      .sort({ electionId: -1 })
      .lean();

    const orgSlugs = [...new Set(dbElections.map((e) => e.orgSlug).filter(Boolean))];
    const orgs = await Organization.find({ slug: { $in: orgSlugs } }).lean();
    const orgMap = Object.fromEntries(orgs.map((o) => [o.slug, o]));

    // On-chain phase is source of truth when available
    const onChainMap = {};
    try {
      const contract = await getReadContract();
      const raw = await contract.getAllElections();
      for (const e of raw) {
        onChainMap[e.id] = {
          phase: Number(e.phase),
          title: e.title,
          description: e.description,
          startTime: Number(e.startTime) * 1000,
          endTime: Number(e.endTime) * 1000,
        };
      }
    } catch (err) {
      console.warn('[elections/public] chain unavailable, using MongoDB only:', err.message);
    }

    const elections = dbElections
      .map((e) => {
        const chain = onChainMap[e.electionId];
        const org = orgMap[e.orgSlug];
        const phase = chain?.phase ?? e.phase ?? 0;

        // Public ledger: only live or completed elections
        if (phase === 0) return null;

        return {
          _id: e._id,
          electionId: e.electionId,
          title: chain?.title || e.title,
          description: chain?.description || e.description,
          phase,
          orgSlug: e.orgSlug,
          orgName: org?.name || e.orgSlug,
          totalVotes: e.totalVotes ?? 0,
          candidateCount: e.candidateCount ?? 0,
          startTime: chain?.startTime
            ? new Date(chain.startTime).toISOString()
            : e.startTime,
          endTime: chain?.endTime
            ? new Date(chain.endTime).toISOString()
            : e.endTime,
          guardianApproved: e.guardianApproved,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, elections });
  } catch (err) {
    console.error('[elections/public]', err);
    return NextResponse.json({ error: 'Failed to load public elections' }, { status: 500 });
  }
}

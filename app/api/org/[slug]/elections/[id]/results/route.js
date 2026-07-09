/**
 * GET /api/org/[slug]/elections/[id]/results
 * Public results for a completed election (on-chain vote counts).
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Organization from '@/lib/models/Organization';
import Election from '@/lib/models/Election';
import { ethers } from 'ethers';

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

export async function GET(req, { params }) {
  try {
    const { slug, id } = await params;
    const electionId = id; // bytes32 hex string from URL param

    await connectDB();
    const org = await Organization.findOne({ slug });
    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

    const electionDoc = await Election.findOne({ electionId, orgSlug: slug }).lean();
    if (!electionDoc) {
      return NextResponse.json({ error: 'Election not found for this organization' }, { status: 404 });
    }
    if (electionDoc.phase !== 2) {
      return NextResponse.json(
        { error: 'Results are only available after the election has ended' },
        { status: 400 },
      );
    }

    const contract = await getReadContract();
    const rawCandidates = await contract.getCandidates(electionId);
    const candidates = rawCandidates
      .map((c) => ({
        id: Number(c.id),
        name: c.name,
        party: c.party,
        symbol: c.symbol,
        voteCount: Number(c.voteCount),
      }))
      .sort((a, b) => b.voteCount - a.voteCount);

    const totalVotes = candidates.reduce((sum, c) => sum + c.voteCount, 0);
    const winner = candidates.length > 0 && candidates[0].voteCount > 0 ? candidates[0] : null;

    return NextResponse.json({
      success: true,
      election: {
        id: electionId,
        title: electionDoc.title,
        description: electionDoc.description,
        phase: electionDoc.phase,
        orgSlug: slug,
        orgName: org.name,
      },
      candidates,
      winner,
      totalVotes,
    });
  } catch (err) {
    console.error('[results GET]', err);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}

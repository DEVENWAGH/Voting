/**
 * GET  /api/org/[slug]/elections  — list elections for org
 * POST /api/org/[slug]/elections  — create election via relay
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Organization from '@/lib/models/Organization';
import { relayCreateElection } from '@/lib/relay';
import { ethers } from 'ethers';

// Read-only contract for queries
async function getReadContract() {
  const abi = (await import('@/lib/contracts/VotingV1.json', { assert: { type: 'json' } })).default.abi;
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
  return new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, abi, provider);
}

export async function GET(req, { params }) {
  try {
    const { slug } = await params;
    await connectDB();
    const org = await Organization.findOne({ slug });
    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

    const contract = await getReadContract();
    const raw = await contract.getAllElections();
    const elections = raw.map(e => ({
      id:          Number(e.id),
      title:       e.title,
      description: e.description,
      bannerUrl:   e.bannerUrl,
      startTime:   Number(e.startTime),
      endTime:     Number(e.endTime),
      phase:       Number(e.phase),
    }));
    return NextResponse.json({ elections });
  } catch (err) {
    console.error('[org/elections GET]', err);
    return NextResponse.json({ error: 'Failed to fetch elections' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { slug } = await params;
    const { title, description, bannerUrl = '', startTime, endTime } = await req.json();

    if (!title || !description || !startTime || !endTime) {
      return NextResponse.json({ error: 'title, description, startTime, endTime required' }, { status: 400 });
    }

    const start = Math.floor(new Date(startTime).getTime() / 1000);
    const end   = Math.floor(new Date(endTime).getTime()   / 1000);
    const now   = Math.floor(Date.now() / 1000);

    if (start <= now) return NextResponse.json({ error: 'Start time must be in the future' }, { status: 400 });
    if (end <= start) return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });

    const { txHash } = await relayCreateElection(title, description, bannerUrl, start, end);
    return NextResponse.json({ success: true, txHash }, { status: 201 });
  } catch (err) {
    console.error('[org/elections POST]', err);
    return NextResponse.json({ error: err.message || 'Failed to create election' }, { status: 500 });
  }
}

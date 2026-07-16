import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VoteActivity from '@/lib/models/VoteActivity';
import Election from '@/lib/models/Election';

// GET /api/votes?electionId=0&limit=100
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const filter = {};
    if (searchParams.has('electionId')) filter.electionId = searchParams.get('electionId');
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

    const votes = await VoteActivity.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, count: votes.length, data: votes });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/votes  — called by VoteCast event listener
export async function POST(request) {
  try {
    await connectDB();
    const { electionId, candidateId, txHash, blockNumber, timestamp } = await request.json();

    const vote = await VoteActivity.findOneAndUpdate(
      { txHash },
      {
        electionId:  String(electionId),
        candidateId: Number(candidateId),
        txHash,
        blockNumber,
        timestamp: timestamp ? new Date(Number(timestamp) * 1000) : new Date(),
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Increment totalVotes on the parent election
    await Election.findOneAndUpdate(
      { electionId: String(electionId) },
      { $inc: { totalVotes: 1 } }
    );

    return NextResponse.json({ success: true, data: vote }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

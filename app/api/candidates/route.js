import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Candidate from '@/lib/models/Candidate';

// GET /api/candidates?electionId=0
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    if (!searchParams.has('electionId'))
      return NextResponse.json(
        { success: false, error: 'electionId query param is required' },
        { status: 400 }
      );

    const candidates = await Candidate.find({
      electionId: Number(searchParams.get('electionId')),
    })
      .sort({ candidateId: 1 })
      .lean();

    return NextResponse.json({ success: true, count: candidates.length, data: candidates });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/candidates  — called by event listener (CandidateAdded)
export async function POST(request) {
  try {
    await connectDB();
    const { electionId, candidateId, name, party, symbol, manifesto, txHash, blockNumber } =
      await request.json();

    const candidate = await Candidate.findOneAndUpdate(
      { electionId: Number(electionId), candidateId: Number(candidateId) },
      { electionId: Number(electionId), candidateId: Number(candidateId), name, party, symbol, manifesto, txHash, blockNumber },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, data: candidate }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH /api/candidates  — increment voteCount (called by VoteCast event listener)
export async function PATCH(request) {
  try {
    await connectDB();
    const { electionId, candidateId } = await request.json();

    const candidate = await Candidate.findOneAndUpdate(
      { electionId: Number(electionId), candidateId: Number(candidateId) },
      { $inc: { voteCount: 1 } },
      { new: true }
    );

    if (!candidate)
      return NextResponse.json({ success: false, error: 'Candidate not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: candidate });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

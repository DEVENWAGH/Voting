import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import Candidate from '@/lib/models/Candidate';

// GET /api/elections/:id  — single election with its candidates
export async function GET(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;

    const election = await Election.findOne({ electionId: id }).lean();
    if (!election)
      return NextResponse.json({ success: false, error: 'Election not found' }, { status: 404 });

    const candidates = await Candidate.find({ electionId: id })
      .sort({ candidateId: 1 })
      .lean();

    return NextResponse.json({ success: true, data: { ...election, candidates } });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH /api/elections/:id  — update phase (called by event listener)
export async function PATCH(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const election = await Election.findOneAndUpdate(
      { electionId: id },
      { $set: body },
      { returnDocument: 'after' }
    );
    if (!election)
      return NextResponse.json({ success: false, error: 'Election not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: election });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

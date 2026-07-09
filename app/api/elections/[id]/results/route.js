import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import Candidate from '@/lib/models/Candidate';

// GET /api/elections/:id/results
export async function GET(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;

    const election = await Election.findOne({ electionId: id }).lean();
    if (!election)
      return NextResponse.json({ success: false, error: 'Election not found' }, { status: 404 });

    if (election.phase !== 2)
      return NextResponse.json(
        { success: false, error: 'Results only available after election is completed' },
        { status: 400 }
      );

    const candidates = await Candidate.find({ electionId: id })
      .sort({ voteCount: -1 })
      .lean();

    const winner = candidates[0] ?? null;
    const totalVotes = candidates.reduce((sum, c) => sum + (c.voteCount || 0), 0);

    return NextResponse.json({ success: true, data: { election, candidates, winner, totalVotes } });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

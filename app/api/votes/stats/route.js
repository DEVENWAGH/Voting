import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VoteActivity from '@/lib/models/VoteActivity';

// GET /api/votes/stats
export async function GET() {
  try {
    await connectDB();

    const total = await VoteActivity.countDocuments();
    const last24h = await VoteActivity.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const byElection = await VoteActivity.aggregate([
      { $group: { _id: '$electionId', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    return NextResponse.json({ success: true, data: { total, last24h, byElection } });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

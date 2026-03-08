import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VoteActivity from '@/lib/models/VoteActivity';

// GET /api/elections/:id/activity?limit=50
export async function GET(request, { params }) {
  try {
    await connectDB();
    const id = Number(params.id);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

    const activity = await VoteActivity.find({ electionId: id })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ success: true, count: activity.length, data: activity });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

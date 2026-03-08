import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';

// GET /api/elections?phase=0|1|2
export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const filter = {};
    if (searchParams.has('phase')) filter.phase = Number(searchParams.get('phase'));

    const elections = await Election.find(filter).sort({ electionId: 1 }).lean();
    return NextResponse.json({ success: true, count: elections.length, data: elections });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/elections  — called internally by the blockchain event listener
export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const { electionId, title, description, startTime, endTime, txHash, blockNumber } = body;

    const election = await Election.findOneAndUpdate(
      { electionId: Number(electionId) },
      {
        electionId: Number(electionId),
        title,
        description,
        startTime: new Date(Number(startTime) * 1000),
        endTime:   new Date(Number(endTime) * 1000),
        txHash,
        blockNumber,
      },
      { upsert: true, new: true }
    );
    return NextResponse.json({ success: true, data: election }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VoterRegistration from '@/lib/models/VoterRegistration';

// GET /api/voters/stats
export async function GET() {
  try {
    await connectDB();
    const total = await VoterRegistration.countDocuments();
    const last24h = await VoterRegistration.countDocuments({
      registrationTime: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    return NextResponse.json({ success: true, data: { total, last24h } });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/voters  — called by VoterRegistered event listener
export async function POST(request) {
  try {
    await connectDB();
    const { walletAddress, txHash, blockNumber } = await request.json();

    const voter = await VoterRegistration.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      {
        walletAddress: walletAddress.toLowerCase(),
        registrationTime: new Date(),
        txHash,
        blockNumber,
      },
      { upsert: true, new: true }
    );
    return NextResponse.json({ success: true, data: voter }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

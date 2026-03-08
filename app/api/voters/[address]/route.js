import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VoterRegistration from '@/lib/models/VoterRegistration';

// GET /api/voters/:address
export async function GET(request, { params }) {
  try {
    await connectDB();
    const voter = await VoterRegistration.findOne({
      walletAddress: params.address.toLowerCase(),
    }).lean();

    if (!voter)
      return NextResponse.json({ success: false, error: 'Voter not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: voter });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email')?.toLowerCase().trim();
    const orgSlug = searchParams.get('orgSlug');
    const electionId = searchParams.get('electionId');

    if (!email) {
      return NextResponse.json({ error: 'email is required.' }, { status: 400 });
    }

    let voter;
    if (orgSlug && electionId) {
      voter = await Voter.findOne({
        orgSlug,
        electionId: String(electionId),
        email,
        status: 'registered',
      });
    } else {
      // Find the first registered voter record by email across any election
      voter = await Voter.findOne({ email, status: 'registered' });
    }

    if (!voter) {
      return NextResponse.json({ error: 'Voter not found or registration not approved on-chain.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      memberId: voter.memberId,
      orgSlug: voter.orgSlug,
      orgId: voter.orgId,
      nullifierHash: voter.nullifierHash,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

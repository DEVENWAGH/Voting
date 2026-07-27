import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Organization from '@/lib/models/Organization';

export async function POST(req) {
  try {
    await connectDB();
    const { id, isVerified } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    const org = await Organization.findByIdAndUpdate(
      id,
      { isVerified },
      { returnDocument: 'after' }
    );

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, org });
  } catch (err) {
    console.error('Verify org error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update organization' }, { status: 500 });
  }
}

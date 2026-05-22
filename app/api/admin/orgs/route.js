/** GET /api/admin/orgs — platform admin: list all organizations */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Organization from '@/lib/models/Organization';

export async function GET() {
  try {
    await connectDB();
    const orgs = await Organization.find({}).sort({ createdAt: -1 }).select('-__v').lean();
    return NextResponse.json({ orgs });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch orgs' }, { status: 500 });
  }
}

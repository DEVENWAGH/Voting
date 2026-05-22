/** GET /api/voters/batches?orgId=xxx — list upload batches for an org */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VoterUploadBatch from '@/lib/models/VoterUploadBatch';

export async function GET(req) {
  try {
    const orgId = new URL(req.url).searchParams.get('orgId');
    if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });
    await connectDB();
    const batches = await VoterUploadBatch.find({ orgId }).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ batches });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
  }
}

/**
 * GET /api/voters/list?orgSlug=xxx&electionId=0
 * Returns all voters for an election with optional status filter.
 * Query params:
 *   orgSlug    (required)
 *   electionId (required)
 *   status     pending | registered | rejected | all  (default: all)
 *   page       (default: 1)
 *   limit      (default: 100, max: 500)
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgSlug    = searchParams.get('orgSlug');
    const electionIdRaw = searchParams.get('electionId');
    const status     = searchParams.get('status') || 'all';
    const page       = Math.max(1, parseInt(searchParams.get('page')  || '1', 10));
    const limit      = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));

    if (!orgSlug) return NextResponse.json({ error: 'orgSlug is required' }, { status: 400 });
    if (electionIdRaw == null || electionIdRaw === '') {
      return NextResponse.json({ error: 'electionId is required' }, { status: 400 });
    }
    const electionId = Number(electionIdRaw);

    await connectDB();

    const baseFilter = { orgSlug, electionId };
    const filter = { ...baseFilter };
    if (status !== 'all') filter.status = status;

    const [voters, total] = await Promise.all([
      Voter.find(filter)
        .select('name email phone gender age status registeredAt onChainTxHash rejectionReason createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Voter.countDocuments(filter),
    ]);

    // Summary counts scoped to this election
    const [pending, registered, rejected] = await Promise.all([
      Voter.countDocuments({ ...baseFilter, status: 'pending' }),
      Voter.countDocuments({ ...baseFilter, status: 'registered' }),
      Voter.countDocuments({ ...baseFilter, status: 'rejected' }),
    ]);

    return NextResponse.json({
      voters,
      total,
      page,
      pages: Math.ceil(total / limit),
      counts: { pending, registered, rejected, total: pending + registered + rejected },
    });
  } catch (err) {
    console.error('[voters/list]', err);
    return NextResponse.json({ error: 'Failed to fetch voters' }, { status: 500 });
  }
}

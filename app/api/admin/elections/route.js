/**
 * GET  /api/admin/elections  — list elections pending guardian approval
 * POST /api/admin/elections/approve  — guardian approves an election → goes live
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import Organization from '@/lib/models/Organization';

export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'pending'; // pending | all

    let query = {};
    if (filter === 'pending') {
      query = { pendingApproval: true, guardianApproved: false };
    }

    const elections = await Election.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Enrich with org info
    const orgSlugs = [...new Set(elections.map(e => e.orgSlug).filter(Boolean))];
    const orgs = await Organization.find({ slug: { $in: orgSlugs } }).lean();
    const orgMap = {};
    for (const o of orgs) orgMap[o.slug] = o;

    const enriched = elections.map(e => ({
      ...e,
      org: orgMap[e.orgSlug] || { name: e.orgSlug, slug: e.orgSlug },
    }));

    return NextResponse.json({ elections: enriched });
  } catch (err) {
    console.error('[admin/elections GET]', err);
    return NextResponse.json({ error: 'Failed to fetch elections' }, { status: 500 });
  }
}

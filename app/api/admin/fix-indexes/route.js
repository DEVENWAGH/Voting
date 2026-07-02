/**
 * GET /api/admin/fix-indexes
 * One-time migration: drops stale indexes on the voters collection
 * that were created by old schema versions, then resyncs the current schema indexes.
 *
 * Run once by visiting: http://localhost:3000/api/admin/fix-indexes
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';

// Indexes that existed in old schema versions — must be removed
const STALE_INDEXES = [
  'orgId_1_memberId_1',      // old unique compound — causes E11000 on memberId: ""
  'orgId_1_email_1',         // old unique compound replaced by orgSlug_1_email_1
  'nullifierHash_1',         // may exist as non-sparse — will be recreated sparse
  'memberId_1',              // old standalone index
];

export async function GET() {
  try {
    await connectDB();

    const collection = Voter.collection; 

    // 1. List all current indexes
    const existingRaw = await collection.indexes();
    const existing = existingRaw.map(i => i.name);

    const dropped = [];
    const notFound = [];

    // 2. Drop each stale index if it exists
    for (const name of STALE_INDEXES) {
      if (existing.includes(name)) {
        try {
          await collection.dropIndex(name);
          dropped.push(name);
          console.log(`[fix-indexes] Dropped stale index: ${name}`);
        } catch (e) {
          console.warn(`[fix-indexes] Could not drop ${name}:`, e.message);
        }
      } else {
        notFound.push(name);
      }
    }

    // 3. Sync current schema indexes (creates any missing, leaves correct ones)
    await Voter.syncIndexes();
    console.log('[fix-indexes] syncIndexes complete');

    // 4. Report final index state
    const finalIndexes = (await collection.indexes()).map(i => ({
      name: i.name,
      key:  i.key,
      unique: i.unique ?? false,
      sparse: i.sparse ?? false,
    }));

    return NextResponse.json({
      success: true,
      dropped,
      notFound,
      currentIndexes: finalIndexes,
    });

  } catch (err) {
    console.error('[fix-indexes] ERROR:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

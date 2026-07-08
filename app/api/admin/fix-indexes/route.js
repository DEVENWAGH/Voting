/**
 * GET /api/admin/fix-indexes
 * One-time migration: drops stale indexes on the voters collection
 * that were created by old schema versions, then resyncs the current schema indexes.
 *
 * Run once by visiting: http://localhost:3000/api/admin/fix-indexes
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';
import Voter from '@/lib/models/Voter';

// Indexes that existed in old schema versions — must be removed
const STALE_INDEXES = [
  'orgId_1_memberId_1',      // old unique compound — causes E11000 on memberId: ""
  'orgId_1_email_1',         // old unique compound replaced by orgSlug_1_email_1
  'nullifierHash_1',         // was globally unique — same voter can appear in multiple elections
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

    // 3. Drop legacy global unique nullifierHash (same voter can be in multiple elections)
    if (existing.includes('nullifierHash_1')) {
      try {
        await collection.dropIndex('nullifierHash_1');
        if (!dropped.includes('nullifierHash_1')) dropped.push('nullifierHash_1');
      } catch (e) {
        console.warn('[fix-indexes] Could not drop nullifierHash_1:', e.message);
      }
    }

    // 4. Ensure per-election nullifier lookup index exists (non-unique)
    await collection.createIndex(
      { orgSlug: 1, electionId: 1, nullifierHash: 1 },
      { name: 'orgSlug_1_electionId_1_nullifierHash_1', background: true },
    );

    // 5. Sync other schema indexes (may recreate stale ones if model cache is old — re-drop after)
    delete mongoose.models.Voter;
    await Voter.syncIndexes();

    // 6. Safety: never keep a global unique nullifierHash index
    const afterSync = (await collection.indexes()).map(i => i.name);
    if (afterSync.includes('nullifierHash_1')) {
      const nh = (await collection.indexes()).find(i => i.name === 'nullifierHash_1');
      if (nh?.unique) {
        await collection.dropIndex('nullifierHash_1');
        dropped.push('nullifierHash_1 (post-sync)');
      }
    }
    console.log('[fix-indexes] syncIndexes complete');

    // 7. Report final index state
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

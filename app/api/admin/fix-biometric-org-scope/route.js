import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BiometricHash from '@/lib/models/BiometricHash';
import Voter from '@/lib/models/Voter';

/**
 * POST /api/admin/fix-biometric-org-scope
 * 
 * One-time migration endpoint: backfills orgSlug and electionId onto
 * BiometricHash records that are missing them, by joining via the Voter model.
 * 
 * This fixes the bug where the TwinOverridesPanel in the dashboard shows
 * "No twin override requests found" even when requests exist — caused by
 * BiometricHash records created before orgSlug/electionId were added to the schema.
 */
export async function POST(req) {
  try {
    await connectDB();

    // Find all BiometricHash records missing orgSlug
    const records = await BiometricHash.find({
      $or: [{ orgSlug: { $exists: false } }, { orgSlug: '' }],
      twinVerificationStatus: { $ne: 'none' },
    }).lean();

    if (records.length === 0) {
      return NextResponse.json({ success: true, message: 'No records need backfilling.', updated: 0 });
    }

    let updated = 0;
    let notFound = 0;

    for (const record of records) {
      const voter = await Voter.findOne({ nullifierHash: record.nullifierHash })
        .select('orgSlug electionId')
        .lean();

      if (voter && (voter.orgSlug || voter.electionId)) {
        await BiometricHash.updateOne(
          { nullifierHash: record.nullifierHash },
          {
            $set: {
              orgSlug: voter.orgSlug || '',
              electionId: voter.electionId || '',
            },
          }
        );
        updated++;
      } else {
        notFound++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfill complete. ${updated} records updated, ${notFound} voter records not found.`,
      updated,
      notFound,
    });
  } catch (err) {
    console.error('[admin/fix-biometric-org-scope] Error:', err);
    return NextResponse.json({ error: err.message || 'Backfill failed.' }, { status: 500 });
  }
}

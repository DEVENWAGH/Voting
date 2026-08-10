import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BiometricHash from '@/lib/models/BiometricHash';
import Voter from '@/lib/models/Voter';

// GET /api/admin/twin-requests?orgSlug=...&electionId=...
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgSlug = searchParams.get('orgSlug');
    const electionId = searchParams.get('electionId');

    if (!orgSlug) {
      return NextResponse.json({ error: 'orgSlug is required.' }, { status: 400 });
    }

    await connectDB();

    // ── Strategy 1: Direct orgSlug+electionId query on BiometricHash ──────────
    // This works for records created/updated after the schema migration that
    // added orgSlug/electionId fields.
    const directQuery = { orgSlug, twinVerificationStatus: { $ne: 'none' } };
    if (electionId) directQuery.electionId = electionId;
    const directRecords = await BiometricHash.find(directQuery).lean();

    // ── Strategy 2: Voter-scoped join (legacy / fallback) ─────────────────────
    // Finds voters for this org+election that have a nullifierHash, then looks up
    // their BiometricHash records. Covers records created before the schema change.
    const voterQuery = { orgSlug };
    if (electionId) voterQuery.electionId = electionId;
    const voters = await Voter.find(voterQuery).select('name email nullifierHash').lean();
    const voterMap = new Map(voters.map(v => [v.nullifierHash, v]));
    const nullifierHashes = voters.map(v => v.nullifierHash).filter(Boolean);

    let legacyRecords = [];
    if (nullifierHashes.length > 0) {
      // Exclude any already found via Strategy 1 to avoid duplicates
      const directNullifiers = new Set(directRecords.map(r => r.nullifierHash));
      legacyRecords = await BiometricHash.find({
        nullifierHash: { $in: nullifierHashes },
        twinVerificationStatus: { $ne: 'none' },
        // exclude ones already captured by Strategy 1
        ...(directNullifiers.size > 0 ? { nullifierHash: { $in: nullifierHashes, $nin: [...directNullifiers] } } : {}),
      }).lean();
    }

    // Merge and de-duplicate by nullifierHash
    const allRecordsMap = new Map();
    for (const r of [...directRecords, ...legacyRecords]) {
      if (!allRecordsMap.has(r.nullifierHash)) {
        allRecordsMap.set(r.nullifierHash, r);
      }
    }
    const allRecords = [...allRecordsMap.values()];

    // Map biometric records to enriched response objects
    const requests = await Promise.all(allRecords.map(async (record) => {
      // Try to find voter info from voterMap (Strategy 2 path) or by direct lookup
      let voter = voterMap.get(record.nullifierHash);
      if (!voter) {
        voter = await Voter.findOne({ nullifierHash: record.nullifierHash }).select('name email').lean();
      }

      // Look up the matched voter's details
      let matchedVoterName = 'Unknown';
      let matchedVoterEmail = record.twinMatchedEmail || 'Unknown';
      if (record.twinMatchedNullifier) {
        const mv = await Voter.findOne({ nullifierHash: record.twinMatchedNullifier }).select('name email').lean();
        if (mv) {
          matchedVoterName = mv.name;
          matchedVoterEmail = mv.email;
        }
      }

      return {
        id: record._id,
        nullifierHash: record.nullifierHash,
        name: voter?.name || 'Unknown Voter',
        email: voter?.email || 'Unknown Email',
        twinVerificationStatus: record.twinVerificationStatus,
        bypassDuplicateCheck: record.bypassDuplicateCheck,
        twinMatchedNullifier: record.twinMatchedNullifier,
        twinMatchedEmail: matchedVoterEmail,
        twinMatchedName: matchedVoterName,
        twinMatchSimilarity: record.twinMatchSimilarity,
        twinNotes: record.twinNotes || '',
        updatedAt: record.updatedAt,
      };
    }));

    return NextResponse.json({ success: true, requests });
  } catch (err) {
    console.error('[admin/twin-requests] GET Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch twin requests.' }, { status: 500 });
  }
}

// POST /api/admin/twin-requests
// Body: { nullifierHash, action: 'approve' | 'reject', notes }
export async function POST(req) {
  try {
    const { nullifierHash, action, notes } = await req.json();

    if (!nullifierHash) {
      return NextResponse.json({ error: 'nullifierHash is required.' }, { status: 400 });
    }
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be approve or reject.' }, { status: 400 });
    }

    await connectDB();

    const record = await BiometricHash.findOne({ nullifierHash });
    if (!record) {
      return NextResponse.json({ error: 'Biometric record not found.' }, { status: 404 });
    }

    if (action === 'approve') {
      record.bypassDuplicateCheck = true;
      record.twinVerificationStatus = 'approved';
    } else {
      record.bypassDuplicateCheck = false;
      record.twinVerificationStatus = 'rejected';
    }

    record.twinNotes = notes || `Manually ${action}d by administrator.`;
    await record.save();

    return NextResponse.json({
      success: true,
      message: `Twin request successfully ${action}d.`,
      record: {
        nullifierHash: record.nullifierHash,
        twinVerificationStatus: record.twinVerificationStatus,
        bypassDuplicateCheck: record.bypassDuplicateCheck,
      }
    });
  } catch (err) {
    console.error('[admin/twin-requests] POST Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update twin request.' }, { status: 500 });
  }
}

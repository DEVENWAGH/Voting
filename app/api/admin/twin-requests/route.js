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

    // 1. Find all voters for this organization and election
    const query = { orgSlug };
    if (electionId) query.electionId = electionId;
    const voters = await Voter.find(query).select('name email nullifierHash').lean();
    const voterMap = new Map(voters.map(v => [v.nullifierHash, v]));

    // 2. Find biometric records with active twin status for these voters
    const nullifierHashes = voters.map(v => v.nullifierHash).filter(Boolean);
    const biometricRecords = await BiometricHash.find({
      nullifierHash: { $in: nullifierHashes },
      twinVerificationStatus: { $ne: 'none' }
    }).lean();

    // 3. Map biometric records back to voter details and include matched voter details
    const requests = await Promise.all(biometricRecords.map(async (record) => {
      const voter = voterMap.get(record.nullifierHash);
      
      // Look up the matched voter's details (using their nullifierHash)
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

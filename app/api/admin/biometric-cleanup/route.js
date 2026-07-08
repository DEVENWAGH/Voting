import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BiometricHash from '@/lib/models/BiometricHash';
import Voter from '@/lib/models/Voter';

/**
 * DELETE /api/admin/biometric-cleanup
 * Removes BiometricHash records that have no matching Voter (orphan / bad test records).
 * Also removes records where the nullifierHash is empty or a mock value.
 * 
 * Query params:
 *   - nullifierHash: (optional) delete a specific hash directly
 *   - orphansOnly: (optional, default true) only delete orphan records
 */
export async function DELETE(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const specificHash = searchParams.get('nullifierHash');

    // If specific hash provided, delete it directly
    if (specificHash) {
      const result = await BiometricHash.deleteOne({ nullifierHash: specificHash });
      return NextResponse.json({
        success: true,
        message: `Deleted biometric record for nullifierHash: ${specificHash}`,
        deletedCount: result.deletedCount,
      });
    }

    // Otherwise, clean up orphan records
    // 1. Get all valid nullifierHashes from voters
    const validVoters = await Voter.find({ nullifierHash: { $exists: true, $ne: '' } }, 'nullifierHash');
    const validHashes = validVoters.map(v => v.nullifierHash);

    // 2. Find all BiometricHash records NOT in valid voter hashes, or with empty/mock hashes
    const orphanRecords = await BiometricHash.find({
      $or: [
        { nullifierHash: { $nin: validHashes } },
        { nullifierHash: '' },
        { nullifierHash: { $regex: '^mock-' } },
      ]
    });

    const orphanHashes = orphanRecords.map(r => r.nullifierHash);

    if (orphanHashes.length === 0) {
      return NextResponse.json({ success: true, message: 'No orphan biometric records found.', deletedCount: 0 });
    }

    const result = await BiometricHash.deleteMany({ nullifierHash: { $in: orphanHashes } });

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} orphan biometric record(s).`,
      deletedCount: result.deletedCount,
      deletedHashes: orphanHashes,
    });
  } catch (err) {
    console.error('[admin/biometric-cleanup] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

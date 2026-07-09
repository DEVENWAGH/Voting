/**
 * scripts/reset-mongodb.js
 * 
 * Resets stale MongoDB voter/election/candidate data.
 * Run this when:
 *   - Switching from Hardhat local to Sepolia (or vice versa)
 *   - Hardhat node was restarted (on-chain state wiped)
 *   - Deploying a fresh contract that starts with empty state
 * 
 * Usage:
 *   node scripts/reset-mongodb.js           # reset everything
 *   node scripts/reset-mongodb.js --voters  # reset only voters (keep elections)
 *   node scripts/reset-mongodb.js --dry-run # show what would be deleted
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not set in .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const votersOnly = args.includes('--voters');
const dryRun = args.includes('--dry-run');

async function main() {
  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');

  const db = mongoose.connection.db;

  const collections = votersOnly
    ? ['voters']
    : ['elections', 'voters', 'candidates', 'voteactivities', 'relaytransactions'];

  for (const name of collections) {
    try {
      const col = db.collection(name);
      const count = await col.countDocuments();
      if (dryRun) {
        console.log(`  [DRY RUN] Would delete ${count} documents from ${name}`);
      } else {
        await col.deleteMany({});
        console.log(`  ✅ Cleared ${count} documents from ${name}`);
      }
    } catch (err) {
      if (err.codeName === 'NamespaceNotFound') {
        console.log(`  ⚠️  Collection ${name} does not exist — skipping`);
      } else {
        console.error(`  ❌ Error clearing ${name}:`, err.message);
      }
    }
  }

  // Drop stale indexes that might reference old Number-type electionId
  if (!dryRun && !votersOnly) {
    try {
      const voterCol = db.collection('voters');
      await voterCol.dropIndexes();
      console.log('\n  ✅ Dropped old voter indexes (will be recreated on next app start)');
    } catch (err) {
      console.log('  ⚠️  Could not drop voter indexes:', err.message);
    }
  }

  console.log(dryRun ? '\n🏁 Dry run complete — no data was deleted.' : '\n🏁 MongoDB reset complete!');
  console.log('   Next steps:');
  console.log('   1. Deploy a fresh contract: yarn deploy (or yarn deploy:sepolia)');
  console.log('   2. Upload voter CSVs again');
  console.log('   3. Create elections & add candidates\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});

/**
 * Wipe election-related MongoDB data (keeps organizations).
 * Use after contract redeploy when electionId collisions cause stale voters/votes.
 *
 * Usage: node scripts/wipe-election-data.js
 *        node scripts/wipe-election-data.js --confirm
 */
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const CONFIRM = process.argv.includes("--confirm");

const COLLECTIONS = [
  "voters",
  "elections",
  "voteactivities",
  "candidates",
  "relaytransactions",
  "voterregistrations",
  "emailotps",
  "biometrichashes",
];

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI not set in .env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const counts = {};
  for (const name of COLLECTIONS) {
    try {
      counts[name] = await db.collection(name).countDocuments();
    } catch {
      counts[name] = 0;
    }
  }

  console.log("\n📊 Current document counts:");
  for (const [name, count] of Object.entries(counts)) {
    console.log(`   ${name}: ${count}`);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    console.log("\n✅ Nothing to wipe — all election collections are already empty.");
    await mongoose.disconnect();
    return;
  }

  if (!CONFIRM) {
    console.log("\n⚠️  Run with --confirm to delete all election-related data:");
    console.log("   node scripts/wipe-election-data.js --confirm\n");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log("\n🗑️  Wiping election data (organizations are kept)...\n");

  for (const name of COLLECTIONS) {
    try {
      const result = await db.collection(name).deleteMany({});
      console.log(`   ${name}: deleted ${result.deletedCount}`);
    } catch (err) {
      console.log(`   ${name}: skipped (${err.message})`);
    }
  }

  console.log("\n✅ Done. Next steps:");
  console.log("   1. yarn dev:next-only");
  console.log("   2. Create a NEW election on the current Sepolia contract");
  console.log("   3. Upload CSV + Bulk Register + vote again\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Wipe failed:", err);
  process.exit(1);
});

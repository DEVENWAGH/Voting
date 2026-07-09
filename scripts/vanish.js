/**
 * scripts/vanish.js
 * Wipes MongoDB election/voter collections, Pinata IPFS pins, and AWS Rekognition faces.
 *
 * Usage:
 *   yarn vanish
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { RekognitionClient, DeleteCollectionCommand, CreateCollectionCommand } from '@aws-sdk/client-rekognition';

async function clearMongoDB() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not set in .env');
    return;
  }

  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const db = mongoose.connection.db;
  const collections = [
    'elections',
    'voters',
    'voteactivities',
    'candidates',
    'relaytransactions',
    'voterregistrations',
    'emailotps',
    'biometrichashes'
  ];

  console.log('🧹 Clearing MongoDB collections...');
  for (const name of collections) {
    try {
      const col = db.collection(name);
      const count = await col.countDocuments();
      await col.deleteMany({});
      console.log(`   ✅ Cleared ${count} documents from '${name}'`);
    } catch (err) {
      if (err.codeName === 'NamespaceNotFound') {
        console.log(`   ℹ️ Collection '${name}' does not exist — skipping`);
      } else {
        console.error(`   ❌ Error clearing '${name}':`, err.message);
      }
    }
  }

  // Drop stale voter indexes
  try {
    const voterCol = db.collection('voters');
    await voterCol.dropIndexes();
    console.log('\n   ✅ Dropped voter indexes');
  } catch (err) {
    // Ignore if not present
  }

  await mongoose.disconnect();
}

async function clearPinata() {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    console.log('⚠️ PINATA_JWT not set in .env — skipping Pinata unpinning.\n');
    return;
  }

  console.log('\n🧹 Fetching pins from Pinata IPFS...');
  try {
    const res = await fetch('https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=1000', {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to list pins: ${res.statusText}`);
    }

    const data = await res.json();
    const pins = data.rows || [];
    console.log(`   Found ${pins.length} active pins on Pinata.`);

    if (pins.length === 0) {
      console.log('   No pins to delete.\n');
      return;
    }

    let successCount = 0;
    for (const pin of pins) {
      const cid = pin.ipfs_pin_hash;
      try {
        const deleteRes = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${jwt}`
          }
        });
        if (deleteRes.ok) {
          successCount++;
        } else {
          console.warn(`   ⚠️ Failed to unpin ${cid}: ${deleteRes.statusText}`);
        }
      } catch (err) {
        console.warn(`   ⚠️ Error unpinning ${cid}:`, err.message);
      }
    }
    console.log(`   ✅ Successfully unpinned ${successCount}/${pins.length} items from Pinata.\n`);
  } catch (err) {
    console.error('❌ Pinata cleanup failed:', err.message);
  }
}

async function clearAWSFaceData() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-1';
  const COLLECTION_ID = 'block-vote-voters';

  if (!accessKeyId || !secretAccessKey) {
    console.log('⚠️ AWS Rekognition credentials not configured in .env — skipping AWS cleanup.\n');
    return;
  }

  console.log('\n🧹 Resetting AWS Rekognition face collection...');
  try {
    const client = new RekognitionClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    // Delete collection if exists
    try {
      await client.send(new DeleteCollectionCommand({ CollectionId: COLLECTION_ID }));
      console.log(`   ✅ Deleted Rekognition collection '${COLLECTION_ID}'`);
    } catch (err) {
      if (err.name === 'ResourceNotFoundException' || err.message?.includes('does not exist')) {
        console.log(`   ℹ️ Collection '${COLLECTION_ID}' did not exist.`);
      } else {
        throw err;
      }
    }

    // Recreate collection so it is ready
    await client.send(new CreateCollectionCommand({ CollectionId: COLLECTION_ID }));
    console.log(`   ✅ Recreated empty Rekognition collection '${COLLECTION_ID}'\n`);
  } catch (err) {
    console.error('❌ AWS Rekognition reset failed:', err.message);
  }
}

async function main() {
  console.log('💥 STARTING TOTAL DATA WIPEOUT (vanish) 💥\n');
  
  await clearMongoDB();
  await clearPinata();
  await clearAWSFaceData();

  console.log('🎉 Wiped MongoDB, Pinata IPFS, and Face Recognition data successfully!\n');
}

main().catch((err) => {
  console.error('❌ Clean-up failed:', err);
  process.exit(1);
});

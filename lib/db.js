/**
 * lib/db.js
 * MongoDB singleton for Next.js.
 *
 * Next.js runs API Route Handlers in a serverless-like environment where the
 * module is re-evaluated on cold-starts. A global cached promise prevents
 * opening a new connection on every request during development (HMR) and in a
 * multi-instance serverless production deployment.
 */
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define MONGODB_URI in your .env.local file.\n' +
    'Example: MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/votingdapp'
  );
}

// Use a global variable so the connection is reused across hot-reloads in dev.
let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: 'votingdapp',
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;

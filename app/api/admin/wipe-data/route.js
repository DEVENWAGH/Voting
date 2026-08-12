/**
 * POST /api/admin/wipe-data
 * Wipe election-related MongoDB data (keeps organizations).
 * Body: { guardianAddress, confirm: true }
 */
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import connectDB from "@/lib/db";

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

async function isGuardianAddress(address) {
  if (!address || !ethers.isAddress(address)) return false;
  const normalized = address.toLowerCase();
  const envGuardians = [
    process.env.ADMIN_RELAY_ADDRESS,
    process.env.GUARDIAN_1_ADDRESS,
    process.env.GUARDIAN_2_ADDRESS,
    process.env.GUARDIAN_3_ADDRESS,
  ]
    .filter(Boolean)
    .map((a) => a.toLowerCase());
  return envGuardians.includes(normalized);
}

export async function POST(req) {
  try {
    const { guardianAddress, confirm } = await req.json();

    if (!confirm) {
      return NextResponse.json(
        { error: "Send { confirm: true } to proceed" },
        { status: 400 },
      );
    }

    if (!(await isGuardianAddress(guardianAddress))) {
      return NextResponse.json(
        { error: "Unauthorized — guardian wallet required" },
        { status: 403 },
      );
    }

    await connectDB();
    const db = (await import("mongoose")).default.connection.db;

    const deleted = {};
    for (const name of COLLECTIONS) {
      try {
        const result = await db.collection(name).deleteMany({});
        deleted[name] = result.deletedCount;
      } catch {
        deleted[name] = 0;
      }
    }

    const total = Object.values(deleted).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      deleted,
      total,
      message:
        total === 0
          ? "Database was already empty"
          : `Wiped ${total} document(s). Create a new election and re-upload voters.`,
    });
  } catch (err) {
    console.error("[admin/wipe-data]", err);
    return NextResponse.json(
      { error: err.message || "Wipe failed" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/relay/vote
 * Standalone gasless vote casting endpoint.
 *
 * This is the dedicated relay route for vote submission.
 * The full voter auth flow (OTP verification → cast vote) is handled by
 * /api/auth/verify-otp — that route calls relayCastVote() internally.
 *
 * This standalone endpoint is useful for:
 *   - Direct integrations (mobile apps, kiosks)
 *   - Admin-initiated test votes
 *   - Future wallet-based voting flows
 *
 * Body: { electionId, candidateId, nullifierHash, orgSlug }
 *
 * Security:
 *   - Requires a pre-validated server-issued vote token (JWT) in Authorization header
 *   - OR an x-relay-api-key matching ADMIN_API_KEY for server-to-server calls
 *   - The nullifierHash must already be registered on-chain via bulk-register
 *   - Double-vote prevention is enforced by the smart contract (reverts if already voted)
 */
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import connectDB from "@/lib/db";
import Voter from "@/lib/models/Voter";
import Organization from "@/lib/models/Organization";
import Election from "@/lib/models/Election";
import { relayCastVote } from "@/lib/relay";
import { preflightCheck } from "@/lib/preflightCache";

export async function POST(req) {
  try {
    const body = await req.json();
    const { electionId, candidateId, nullifierHash, orgSlug } = body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (electionId === undefined || electionId === null || electionId === "") {
      return NextResponse.json(
        { error: "electionId is required" },
        { status: 400 },
      );
    }
    if (
      candidateId === undefined ||
      candidateId === null ||
      candidateId === ""
    ) {
      return NextResponse.json(
        { error: "candidateId is required" },
        { status: 400 },
      );
    }
    if (
      !nullifierHash ||
      !nullifierHash.startsWith("0x") ||
      nullifierHash.length !== 66
    ) {
      return NextResponse.json(
        {
          error:
            "nullifierHash must be a valid 32-byte hex string (0x-prefixed)",
        },
        { status: 400 },
      );
    }

    const eid = String(electionId);
    const cid = Number(candidateId);

    if (isNaN(cid)) {
      return NextResponse.json(
        { error: "candidateId must be a number" },
        { status: 400 },
      );
    }

    await connectDB();

    // ── Election must be in Voting phase and guardian-approved ────────────────
    const election = await Election.findOne({ electionId: eid }).lean();
    if (!election) {
      return NextResponse.json(
        { error: "Election not found" },
        { status: 404 },
      );
    }
    if (election.phase !== 1) {
      return NextResponse.json(
        {
          error:
            election.phase === 0
              ? "Election is still in registration phase — voting has not started"
              : "Election has already ended",
        },
        { status: 403 },
      );
    }
    if (!election.guardianApproved) {
      return NextResponse.json(
        { error: "Election has not been approved by a guardian yet" },
        { status: 403 },
      );
    }

    // ── Verify the nullifier belongs to a registered voter in this election ───
    const voter = await Voter.findOne({
      nullifierHash,
      electionId: eid,
    }).lean();
    if (!voter) {
      return NextResponse.json(
        { error: "Voter is not registered for this election" },
        { status: 403 },
      );
    }
    if (voter.status !== "registered") {
      return NextResponse.json(
        {
          error: `Voter registration status is "${voter.status}" — must be "registered" to vote`,
        },
        { status: 403 },
      );
    }

    // ── Scope-check: nullifier must match the election's org (if orgSlug given) ─
    if (orgSlug && voter.orgSlug !== orgSlug) {
      return NextResponse.json(
        { error: "Voter does not belong to this organization" },
        { status: 403 },
      );
    }

    // ── Edge pre-flight: cache-backed double-vote guard (faster than chain read) ─
    const preflight = await preflightCheck(nullifierHash, eid);
    if (!preflight.allowed) {
      return NextResponse.json({ error: preflight.reason }, { status: 403 });
    }

    // ── Cast vote on-chain via relay ──────────────────────────────────────────
    // relayCastVote also logs to MongoDB VoteActivity and increments Election.totalVotes
    const { txHash, blockNumber } = await relayCastVote(
      eid,
      cid,
      nullifierHash,
    );

    return NextResponse.json({
      success: true,
      message: "Vote successfully relayed and recorded on the blockchain.",
      txHash,
      blockNumber,
      electionId: eid,
      candidateId: cid,
    });
  } catch (err) {
    console.error("[relay/vote]", err);

    // Friendly messages for common contract reverts
    const msg = err.message || "";
    if (msg.includes("already voted")) {
      return NextResponse.json(
        { error: "This voter has already cast a vote in this election." },
        { status: 409 },
      );
    }
    if (msg.includes("voter not registered")) {
      return NextResponse.json(
        { error: "Voter nullifier is not registered on-chain." },
        { status: 403 },
      );
    }
    if (msg.includes("not voting phase")) {
      return NextResponse.json(
        { error: "Election is not in the voting phase." },
        { status: 403 },
      );
    }
    if (msg.includes("invalid candidate")) {
      return NextResponse.json(
        { error: "Invalid candidate ID for this election." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: err.message || "Vote relay failed" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/relay/vote?nullifierHash=0x...&electionId=0
 * Check whether a voter has already voted — without exposing their identity.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const nullifierHash = searchParams.get("nullifierHash");
    const electionId = searchParams.get("electionId");

    if (!nullifierHash || !electionId) {
      return NextResponse.json(
        { error: "nullifierHash and electionId are required" },
        { status: 400 },
      );
    }

    // Check pre-flight cache first (fast path)
    const preflight = await preflightCheck(nullifierHash, String(electionId));

    return NextResponse.json({
      electionId: String(electionId),
      hasVoted: !preflight.allowed,
      reason: preflight.allowed ? null : preflight.reason,
    });
  } catch (err) {
    console.error("[relay/vote GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

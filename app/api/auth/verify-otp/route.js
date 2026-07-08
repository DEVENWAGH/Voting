/**
 * POST /api/auth/verify-otp
 * Voter Authentication OTP Verification & Vote Casting
 *
 * Verifies email OTP, performs edge pre-flight validation,
 * and casts the vote on-chain via the gasless relay wallet.
 *
 * NOTE: Biometric (v2) and Aadhaar (dropped) are NOT part of this flow.
 *       Authentication = Email OTP only for v1.
 */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Voter from "@/lib/models/Voter";
import EmailOTP from "@/lib/models/EmailOTP";
import { preflightCheck } from "@/lib/preflightCache";
import { relayCastVote } from "@/lib/relay";
import { sendVoteReceiptEmail } from "@/lib/mailer";
import bcrypt from "bcryptjs";
import { verifyBiometricToken } from "@/lib/biometric";

export async function POST(req) {
  try {
    const { email, otp, orgId, electionId, candidateId, biometricToken: bodyToken } = await req.json();
    const biometricToken = req.headers.get('x-biometric-token') || bodyToken;

    if (
      !email ||
      !otp ||
      !orgId ||
      electionId === undefined ||
      electionId === null ||
      electionId === "" ||
      candidateId === undefined
    ) {
      return NextResponse.json(
        {
          error: "email, otp, orgId, electionId, and candidateId are required.",
        },
        { status: 400 },
      );
    }

    await connectDB();

    const cleanEmail = email.toLowerCase().trim();

    // ── 1. Verify OTP ─────────────────────────────────────────────────────────
    const record = await EmailOTP.findOne({
      email: cleanEmail,
      purpose: "vote",
      orgId,
    });

    if (!record || record.used) {
      return NextResponse.json(
        {
          error:
            "OTP has expired or has already been used. Please request a new one.",
        },
        { status: 400 },
      );
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 400 },
      );
    }

    if (record.attempts >= 3) {
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please request a new OTP." },
        { status: 400 },
      );
    }

    const validOTP = await bcrypt.compare(String(otp).trim(), record.otp);
    if (!validOTP) {
      record.attempts += 1;
      await record.save();
      const remaining = 3 - record.attempts;
      return NextResponse.json(
        {
          error: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
        },
        { status: 400 },
      );
    }

    // ── 2. Fetch Voter — use stored nullifierHash (guaranteed to match on-chain) ──
    const Organization = (await import("@/lib/models/Organization")).default;
    const org = await Organization.findById(orgId);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found." },
        { status: 404 },
      );
    }

    const voter = await Voter.findOne({
      orgSlug: org.slug,
      electionId: Number(electionId),
      email: cleanEmail,
    });

    if (!voter) {
      return NextResponse.json(
        {
          error:
            "Email is not registered for this election. Please check with your organization admin.",
        },
        { status: 404 },
      );
    }

    if (voter.status !== "registered") {
      return NextResponse.json(
        {
          error: `Voter registration status is "${voter.status}". Please contact your admin.`,
        },
        { status: 403 },
      );
    }

    if (!voter.nullifierHash) {
      return NextResponse.json(
        {
          error:
            "Voter on-chain registration is incomplete. Please contact your admin to re-run bulk registration.",
        },
        { status: 403 },
      );
    }

    // Use the nullifierHash stored during bulk-register — this is the exact bytes32
    // that was submitted to the contract. Never recompute it here to avoid any
    // formula mismatch between registration and voting.
    const nullifierHash = voter.nullifierHash;

    // ── 2.5. Verify Biometric Token ──────────────────────────────────────────
    if (!biometricToken) {
      return NextResponse.json(
        { error: "Biometric session verification required. Please verify your face first." },
        { status: 403 }
      );
    }

    const decodedBiometric = verifyBiometricToken(biometricToken);
    if (!decodedBiometric || !decodedBiometric.authenticated) {
      return NextResponse.json(
        { error: "Biometric authentication is invalid. Please verify your face again." },
        { status: 403 }
      );
    }

    // ── 3. Edge Pre-flight — fast double-vote guard (cache + chain) ───────────
    const checkResult = await preflightCheck(nullifierHash, Number(electionId));
    if (!checkResult.allowed) {
      return NextResponse.json({ error: checkResult.reason }, { status: 403 });
    }

    // ── 4. Cast Vote via Relay (logs to MongoDB VoteActivity automatically) ───
    const { txHash } = await relayCastVote(
      Number(electionId),
      Number(candidateId),
      nullifierHash,
    );

    const Candidate = (await import("@/lib/models/Candidate")).default;
    const Election = (await import("@/lib/models/Election")).default;
    const [candidate, election] = await Promise.all([
      Candidate.findOne({
        electionId: Number(electionId),
        candidateId: Number(candidateId),
      }).lean(),
      Election.findOne({ electionId: Number(electionId) }).lean(),
    ]);

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify?txHash=${encodeURIComponent(txHash)}`;

    try {
      await sendVoteReceiptEmail(cleanEmail, {
        orgName: org.name || "Block Vote",
        electionTitle: election?.title || `Election #${electionId}`,
        candidateName: candidate?.name || "your selected candidate",
        txHash,
        verifyUrl,
      });
    } catch (mailErr) {
      console.error("[verify-otp] receipt email failed:", mailErr);
    }

    // ── 5. Mark OTP as used ───────────────────────────────────────────────────
    record.used = true;
    await record.save();

    return NextResponse.json({
      success: true,
      message: "Vote successfully relayed and recorded on the blockchain.",
      txHash,
      verifyUrl,
    });
  } catch (err) {
    console.error('[verify-otp]', err);

    // Extract a clean, user-friendly error from blockchain reverts
    const reason = err?.reason || err?.revert?.args?.[0] || err?.message || 'Verification failed.';
    let userMessage = reason;

    if (reason.includes('voter not registered')) {
      userMessage = 'Your voter registration is not yet finalized on the blockchain. Please contact your election admin to complete on-chain registration.';
    } else if (reason.includes('already voted')) {
      userMessage = 'Your vote has already been recorded on the blockchain for this election.';
    } else if (reason.includes('election not active') || reason.includes('not in voting phase')) {
      userMessage = 'This election is no longer accepting votes.';
    } else if (reason.includes('invalid candidate')) {
      userMessage = 'The selected candidate is not valid for this election.';
    }

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}

/**
 * POST /api/auth/send-otp
 * Voter Authentication OTP Sender
 *
 * Verifies if voter is registered, runs preflight check, and sends email OTP.
 */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Voter from "@/lib/models/Voter";
import Organization from "@/lib/models/Organization";
import EmailOTP from "@/lib/models/EmailOTP";
import { sendOTPEmail } from "@/lib/mailer";
import { preflightCheck } from "@/lib/preflightCache";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req) {
  try {
    const { email, orgId, electionId } = await req.json();

    if (
      !email ||
      !orgId ||
      electionId === undefined ||
      electionId === null ||
      electionId === ""
    ) {
      return NextResponse.json(
        { error: "email, orgId, and electionId are required." },
        { status: 400 },
      );
    }

    await connectDB();

    // 1. Verify Voter is registered in MongoDB (search by orgId OR orgSlug for compatibility)
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
      email: email.toLowerCase().trim(),
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
          error:
            "Voter registration has not been finalized on-chain yet. Please contact your organization admin.",
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

    const orgName = org.name || "Block Vote";

    // Use the stored nullifierHash — this is the exact bytes32 submitted to the contract
    // during bulk-register. Using it directly prevents any formula mismatch.
    const nullifierHash = voter.nullifierHash;

    // 4. Run Pre-flight duplicate check (Feature 2)
    const checkResult = await preflightCheck(nullifierHash, Number(electionId));
    if (!checkResult.allowed) {
      return NextResponse.json({ error: checkResult.reason }, { status: 403 });
    }

    // 5. Generate 6-digit OTP
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 8);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    // 6. Save OTP to DB
    await EmailOTP.findOneAndUpdate(
      { email: email.toLowerCase().trim(), purpose: "vote", orgId },
      {
        email: email.toLowerCase().trim(),
        otp: otpHash,
        orgId,
        purpose: "vote",
        expiresAt,
        used: false,
        attempts: 0,
      },
      { upsert: true, new: true },
    );

    // 7. Send OTP Email
    await sendOTPEmail(email.toLowerCase().trim(), otp, "vote", orgName);

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully to your email.",
      expiresAt,
    });
  } catch (err) {
    console.error("[send-otp]", err);
    return NextResponse.json(
      { error: err.message || "Failed to send OTP." },
      { status: 500 },
    );
  }
}

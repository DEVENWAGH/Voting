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
import { rateLimit } from "@/lib/rateLimit";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Rate limit: max 5 OTP requests per minute per IP
const otpLimiter = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'send-otp', message: 'Too many OTP requests. Please wait before trying again.' });

export async function POST(req) {
  // Rate limit check
  const limited = otpLimiter(req);
  if (limited) return limited;

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
      electionId: String(electionId),
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

    if (voter.status === "rejected") {
      return NextResponse.json(
        {
          error:
            `Voter registration was rejected: ${voter.rejectionReason || 'unknown reason'}. Please contact your organization admin.`,
        },
        { status: 403 },
      );
    }

    let nullifierHash = voter.nullifierHash;

    // For pending voters who haven't been registered on-chain yet,
    // compute the nullifierHash so we can proceed. Auto-registration
    // happens later in verify-otp.
    if (!nullifierHash) {
      const { computeNullifierHash } = await import("@/lib/voterIdentity");
      nullifierHash = computeNullifierHash(org.slug, email.toLowerCase().trim());
    }

    const orgName = org.name || "Block Vote";

    // Pre-flight duplicate check — skip for pending voters (they aren't registered yet)
    if (voter.status === "registered") {
      const checkResult = await preflightCheck(nullifierHash, String(electionId));
      if (!checkResult.allowed) {
        return NextResponse.json({ error: checkResult.reason }, { status: 403 });
      }
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
      { upsert: true, returnDocument: 'after' },
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

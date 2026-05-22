/**
 * POST /api/auth/send-otp
 * Sends a 6-digit email OTP to the voter's email for gasless voting.
 * Body: { email, electionId, orgId }
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import EmailOTP from '@/lib/models/EmailOTP';
import Organization from '@/lib/models/Organization';
import { sendOTPEmail } from '@/lib/mailer';

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;

function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

export async function POST(req) {
  try {
    const { email, electionId, orgId } = await req.json();

    if (!email || !orgId) {
      return NextResponse.json({ error: 'email and orgId are required' }, { status: 400 });
    }

    await connectDB();

    // Check org exists
    const org = await Organization.findById(orgId);
    if (!org || !org.isActive) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check voter is registered
    const voter = await Voter.findOne({ email: email.toLowerCase(), orgId, status: 'registered' });
    if (!voter) {
      return NextResponse.json({ error: 'Email not found in voter registry for this organization' }, { status: 404 });
    }

    // Rate limit: max 3 OTP requests per 15 minutes
    const recentOTPs = await EmailOTP.countDocuments({
      email: email.toLowerCase(),
      purpose: 'vote',
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    });
    if (recentOTPs >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many OTP requests. Please wait 15 minutes.' }, { status: 429 });
    }

    // Invalidate previous unused OTPs
    await EmailOTP.deleteMany({ email: email.toLowerCase(), purpose: 'vote', used: false });

    // Generate & store new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await EmailOTP.create({
      email: email.toLowerCase(),
      otp,             // stored as plain for now; hash in production with bcrypt
      orgId,
      purpose: 'vote',
      expiresAt,
    });

    // Send email
    await sendOTPEmail(email, otp, 'vote', org.name);

    return NextResponse.json({
      success: true,
      message: `OTP sent to ${email}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
      expiresAt,
    });
  } catch (err) {
    console.error('[send-otp]', err);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}

/**
 * POST /api/org-auth/verify-email
 * Step 2: Verify the OTP sent during signup and mark org as email-verified.
 * Body: { adminEmail, otp }
 */
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import Organization from '@/lib/models/Organization';
import EmailOTP from '@/lib/models/EmailOTP';

export async function POST(req) {
  try {
    const { adminEmail, otp } = await req.json();

    if (!adminEmail || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required.' }, { status: 400 });
    }

    await connectDB();

    const record = await EmailOTP.findOne({
      email:   adminEmail.toLowerCase().trim(),
      purpose: 'org-signup',
      used:    false,
    });

    if (!record) {
      return NextResponse.json({ error: 'OTP not found or already used.' }, { status: 400 });
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json({ error: 'OTP has expired. Please sign up again.' }, { status: 400 });
    }

    if (record.attempts >= 5) {
      return NextResponse.json({ error: 'Too many failed attempts. Please sign up again.' }, { status: 429 });
    }

    const valid = await bcrypt.compare(String(otp).trim(), record.otp);
    if (!valid) {
      await EmailOTP.findByIdAndUpdate(record._id, { $inc: { attempts: 1 } });
      const left = 5 - (record.attempts + 1);
      return NextResponse.json(
        { error: `Incorrect OTP. ${left} attempt${left !== 1 ? 's' : ''} remaining.` },
        { status: 400 }
      );
    }

    // Mark OTP as used
    await EmailOTP.findByIdAndUpdate(record._id, { used: true });

    // Mark org as email-verified
    const org = await Organization.findByIdAndUpdate(
      record.orgId,
      { isEmailVerified: true },
      { returnDocument: 'after' }
    );

    if (!org) {
      return NextResponse.json({ error: 'Organization not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      org: { id: org._id, name: org.name, slug: org.slug },
    });
  } catch (err) {
    console.error('[org-auth/verify-email]', err);
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 });
  }
}

/**
 * POST /api/org-auth/signup
 * Step 1: Register org with email + password (unverified).
 * Sends a 6-digit OTP to adminEmail for verification.
 * Body: { orgName, orgType, description, adminEmail, password }
 */
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import Organization from '@/lib/models/Organization';
import EmailOTP from '@/lib/models/EmailOTP';
import { sendOTPEmail } from '@/lib/mailer';

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60);
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req) {
  try {
    const { orgName, orgType, description, adminEmail, password } = await req.json();

    if (!orgName || !adminEmail || !password) {
      return NextResponse.json(
        { error: 'orgName, adminEmail, and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if email already registered + verified
    const existing = await Organization.findOne({ adminEmail: adminEmail.toLowerCase().trim() });
    if (existing?.isEmailVerified) {
      return NextResponse.json(
        { error: 'An organization with this email already exists.' },
        { status: 409 }
      );
    }

    // Generate unique slug
    const baseSlug = slugify(orgName);
    let slug = baseSlug;
    let counter = 1;
    while (await Organization.exists({ slug, adminEmail: { $ne: adminEmail.toLowerCase().trim() } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Upsert: overwrite any previous unverified registration for this email
    const org = await Organization.findOneAndUpdate(
      { adminEmail: adminEmail.toLowerCase().trim() },
      {
        name:            orgName.trim(),
        slug,
        adminEmail:      adminEmail.toLowerCase().trim(),
        description:     description || '',
        type:            orgType || 'other',
        passwordHash,
        isEmailVerified: false,
        isActive:        true,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // Generate & store OTP (overwrite any existing for this email)
    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 8);
    await EmailOTP.findOneAndUpdate(
      { email: adminEmail.toLowerCase(), purpose: 'org-signup' },
      {
        email:     adminEmail.toLowerCase().trim(),
        otp:       otpHash,
        orgId:     org._id,
        purpose:   'org-signup',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
        used:      false,
        attempts:  0,
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Send OTP email
    await sendOTPEmail(adminEmail, otp, 'org-login', orgName.trim());

    return NextResponse.json(
      { success: true, message: 'OTP sent to your email. Please verify.' },
      { status: 201 }
    );
  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json(
        { error: 'An organization with this name already exists. Try a different name.' },
        { status: 409 }
      );
    }
    console.error('[org-auth/signup]', err);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}

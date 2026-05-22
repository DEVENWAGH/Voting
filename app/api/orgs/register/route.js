/**
 * POST /api/orgs/register
 * Self-service organization registration.
 * Body: { name, email, description, type, adminEmail }
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Organization from '@/lib/models/Organization';
import { sendOTPEmail } from '@/lib/mailer';

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60);
}

export async function POST(req) {
  try {
    const { name, email, description, type, adminEmail } = await req.json();

    if (!name || !email || !adminEmail) {
      return NextResponse.json({ error: 'name, email, and adminEmail are required' }, { status: 400 });
    }

    await connectDB();

    const baseSlug = slugify(name);
    // Ensure unique slug
    let slug = baseSlug;
    let counter = 1;
    while (await Organization.exists({ slug })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const org = await Organization.create({
      name: name.trim(),
      slug,
      email: email.toLowerCase().trim(),
      description: description || '',
      type: type || 'other',
      adminEmail: adminEmail.toLowerCase().trim(),
      isVerified: false,
    });

    // Welcome email to admin
    await sendOTPEmail(
      adminEmail,
      '------', // no OTP for registration confirmation — just use the template with a note
      'org-login',
      name
    ).catch(() => {}); // non-blocking

    return NextResponse.json({
      success: true,
      org: { id: org._id, name: org.name, slug: org.slug },
    }, { status: 201 });
  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json({ error: 'An organization with this email already exists.' }, { status: 409 });
    }
    console.error('[orgs/register]', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}

/** GET /api/orgs/register?slug=xxx — lookup org by slug */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const id   = searchParams.get('id');

    await connectDB();
    const org = id
      ? await Organization.findById(id).select('-__v')
      : await Organization.findOne({ slug }).select('-__v');

    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    return NextResponse.json({ org });
  } catch (err) {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}

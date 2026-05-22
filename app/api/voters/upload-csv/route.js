/**
 * POST /api/voters/upload-csv
 * Accepts multipart CSV file, validates, stores pending voters in MongoDB.
 * Returns batch report with valid/error rows.
 *
 * Expected CSV columns: name, email, phone, member_id, role, notes
 */
import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import VoterUploadBatch from '@/lib/models/VoterUploadBatch';
import Organization from '@/lib/models/Organization';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 10_000;
const REQUIRED_COLUMNS = ['name', 'email', 'member_id'];

function validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function validatePhone(p) { return !p || /^\d{10}$/.test(p.replace(/\s/g, '')); }

export async function POST(req) {
  try {
    await connectDB();

    const formData = await req.formData();
    const file   = formData.get('file');
    const orgId  = formData.get('orgId');
    const adminEmail = formData.get('adminEmail');

    if (!file || !orgId) {
      return NextResponse.json({ error: 'file and orgId are required' }, { status: 400 });
    }

    const org = await Organization.findById(orgId);
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds 5MB limit' }, { status: 413 });
    }

    const csvText = new TextDecoder().decode(bytes);

    // Parse CSV
    let records;
    try {
      records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch {
      return NextResponse.json({ error: 'Invalid CSV format. Ensure proper comma-separated values.' }, { status: 400 });
    }

    if (records.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }
    if (records.length > MAX_ROWS) {
      return NextResponse.json({ error: `CSV exceeds ${MAX_ROWS} row limit` }, { status: 400 });
    }

    // Check required columns
    const headers = Object.keys(records[0]).map(h => h.toLowerCase().trim());
    for (const col of REQUIRED_COLUMNS) {
      if (!headers.includes(col)) {
        return NextResponse.json({
          error: `Missing required column: "${col}". Required: ${REQUIRED_COLUMNS.join(', ')}`,
        }, { status: 400 });
      }
    }

    // Create batch record
    const batch = await VoterUploadBatch.create({
      orgId,
      uploadedBy: adminEmail || 'admin',
      filename: file.name,
      totalRows: records.length,
      status: 'uploaded',
    });

    // Validate rows
    const validVoters = [];
    const errors = [];
    const seenEmails = new Set();
    const seenMemberIds = new Set();

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // 1-indexed + header row
      const name     = (row.name     || '').trim();
      const email    = (row.email    || '').toLowerCase().trim();
      const phone    = (row.phone    || '').trim();
      const memberId = (row.member_id || '').trim();
      const role     = (row.role     || 'member').trim();

      const rowErrors = [];
      if (!name || name.length < 2)       rowErrors.push('name is required (min 2 chars)');
      if (!email)                          rowErrors.push('email is required');
      else if (!validateEmail(email))      rowErrors.push('invalid email format');
      if (!memberId)                       rowErrors.push('member_id is required');
      if (phone && !validatePhone(phone))  rowErrors.push('phone must be 10 digits');
      if (seenEmails.has(email))           rowErrors.push('duplicate email in file');
      if (seenMemberIds.has(memberId))     rowErrors.push('duplicate member_id in file');

      if (rowErrors.length > 0) {
        errors.push({ row: rowNum, memberId: memberId || '—', reason: rowErrors.join('; ') });
        continue;
      }

      seenEmails.add(email);
      seenMemberIds.add(memberId);
      validVoters.push({ orgId, name, email, phone, memberId, role, uploadBatchId: batch._id });
    }

    // Bulk insert valid voters (skip duplicates already in DB)
    let inserted = 0;
    let skipped  = 0;
    for (const v of validVoters) {
      try {
        await Voter.create(v);
        inserted++;
      } catch (e) {
        if (e.code === 11000) {
          skipped++;
          errors.push({ row: '—', memberId: v.memberId, reason: 'Already exists in database' });
        } else throw e;
      }
    }

    // Update batch record
    await VoterUploadBatch.findByIdAndUpdate(batch._id, {
      validRows:  inserted,
      errorRows:  errors.length,
      errors:     errors.slice(0, 100), // store first 100 errors
    });

    return NextResponse.json({
      success: true,
      batchId: batch._id,
      total:    records.length,
      inserted,
      skipped,
      errors:   errors.slice(0, 50), // return first 50 to client
      hasMoreErrors: errors.length > 50,
    });
  } catch (err) {
    console.error('[upload-csv]', err);
    return NextResponse.json({ error: 'CSV processing failed' }, { status: 500 });
  }
}

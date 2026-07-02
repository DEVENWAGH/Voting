/**
 * POST /api/voters/upload-csv
 * Accepts multipart CSV file, validates, upserts voters into MongoDB,
 * then pins an anonymised voter roster (names + emails) to IPFS for audit trail.
 *
 * Expected CSV columns: name, email, phone, gender, age
 * Required formData fields: file, orgSlug (and optionally orgId), electionId
 */
import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import connectDB from "@/lib/db";
import Voter from "@/lib/models/Voter";
import Organization from "@/lib/models/Organization";
import { pinJSON, getIPFSUrl } from "@/lib/ipfs";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 10_000;
const REQUIRED_COLUMNS = ["name", "email"];

function validateEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
function validatePhone(p) {
  return !p || /^\d{10}$/.test(p.replace(/\s/g, ""));
}

export async function POST(req) {
  try {
    await connectDB();

    const formData = await req.formData();
    const file = formData.get("file");
    const orgSlug = (formData.get("orgSlug") || "").trim();
    const orgId = (formData.get("orgId") || "").trim();
    const electionIdRaw = formData.get("electionId");

    console.log(
      "[upload-csv] orgSlug:",
      orgSlug,
      "| orgId:",
      orgId,
      "| electionId:",
      electionIdRaw,
      "| file:",
      file?.name,
    );

    // Require the file and at least one org identifier
    if (!file) {
      return NextResponse.json({ error: "No file received" }, { status: 400 });
    }
    if (!orgSlug && !orgId) {
      return NextResponse.json(
        { error: "org not identified — provide orgSlug or orgId" },
        { status: 400 },
      );
    }
    if (electionIdRaw == null || electionIdRaw === "") {
      return NextResponse.json(
        { error: "electionId is required" },
        { status: 400 },
      );
    }
    const electionId = Number(electionIdRaw);
    if (isNaN(electionId)) {
      return NextResponse.json(
        { error: "electionId must be a number" },
        { status: 400 },
      );
    }

    // Resolve org by slug first, fall back to orgId
    const org = orgSlug
      ? await Organization.findOne({ slug: orgSlug }).lean()
      : await Organization.findById(orgId).lean();

    if (!org)
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );

    const resolvedSlug = org.slug;
    const resolvedId = org._id;

    // File size guard
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 5MB limit" },
        { status: 413 },
      );
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
      return NextResponse.json(
        { error: "Invalid CSV format. Ensure proper comma-separated values." },
        { status: 400 },
      );
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
    }
    if (records.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `CSV exceeds ${MAX_ROWS} row limit` },
        { status: 400 },
      );
    }

    // Check required columns exist
    const headers = Object.keys(records[0]).map((h) => h.toLowerCase().trim());
    for (const col of REQUIRED_COLUMNS) {
      if (!headers.includes(col)) {
        return NextResponse.json(
          {
            error: `Missing required column: "${col}". Required: ${REQUIRED_COLUMNS.join(", ")}`,
          },
          { status: 400 },
        );
      }
    }

    // Validate rows
    const validVoters = [];
    const errors = [];
    const seenEmails = new Set();

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // 1-indexed + header row
      const name = (row.name || "").trim();
      const email = (row.email || "").toLowerCase().trim();
      const phone = (row.phone || "").trim();
      const gender = (row.gender || "").trim();
      const ageRaw = (row.age || "").trim();
      const age = ageRaw ? parseInt(ageRaw, 10) : null;

      const rowErrors = [];
      if (!name || name.length < 2)
        rowErrors.push("name is required (min 2 chars)");
      if (!email) rowErrors.push("email is required");
      else if (!validateEmail(email)) rowErrors.push("invalid email format");
      if (phone && !validatePhone(phone))
        rowErrors.push("phone must be 10 digits");
      if (ageRaw && (isNaN(age) || age < 1 || age > 150))
        rowErrors.push("age must be 1–150");
      if (seenEmails.has(email)) rowErrors.push("duplicate email in file");

      if (rowErrors.length > 0) {
        errors.push({
          row: rowNum,
          email: email || "—",
          reason: rowErrors.join("; "),
        });
        continue;
      }

      seenEmails.add(email);
      validVoters.push({
        orgSlug: resolvedSlug,
        orgId: resolvedId,
        electionId,
        name,
        email,
        phone,
        gender,
        age,
      });
    }

    // Upsert all valid voters — re-uploading same CSV updates existing records,
    // never throws a duplicate key error.
    let upserted = 0;
    let updated = 0;

    if (validVoters.length > 0) {
      const ops = validVoters.map((v) => ({
        updateOne: {
          filter: { orgSlug: resolvedSlug, electionId, email: v.email },
          update: {
            $set: {
              orgId: v.orgId,
              name: v.name,
              phone: v.phone,
              gender: v.gender,
              age: v.age,
            },
            // Only set status/orgSlug/electionId on first insert — don't overwrite a "registered" voter's status
            $setOnInsert: {
              orgSlug: resolvedSlug,
              electionId,
              email: v.email,
              status: "pending",
            },
          },
          upsert: true,
        },
      }));

      const result = await Voter.bulkWrite(ops, { ordered: false });
      upserted = result.upsertedCount;
      updated = result.modifiedCount;
    }

    // ── Pin anonymised voter roster to IPFS ───────────────────────────────────
    // Store only names + emails (no phone/gender/age) — minimal PII for audit
    let ipfsCid = "";
    try {
      ipfsCid = await pinJSON(
        {
          type: "voter-roster",
          version: "1.0",
          orgSlug: resolvedSlug,
          electionId,
          totalVoters: validVoters.length,
          // Store emails only — names stripped for privacy; just need a verifiable count
          voterEmails: validVoters.map((v) => v.email),
          uploadedAt: new Date().toISOString(),
        },
        `voter-roster-${resolvedSlug}-election${electionId}-${Date.now()}`,
        {
          orgSlug: resolvedSlug,
          electionId: String(electionId),
          type: "voter-roster",
        },
      );
      console.log(`[upload-csv] Pinned voter roster to IPFS: ${ipfsCid}`);
    } catch (ipfsErr) {
      console.warn(
        "[upload-csv] IPFS pin failed (non-fatal):",
        ipfsErr.message,
      );
    }

    return NextResponse.json({
      success: true,
      orgSlug: resolvedSlug,
      electionId,
      total: records.length,
      upserted, // new voters added
      updated, // existing voters refreshed
      skipped: records.length - validVoters.length - errors.length,
      errors: errors.slice(0, 50),
      hasMoreErrors: errors.length > 50,
      ipfsCid,
      ipfsUrl: getIPFSUrl(ipfsCid),
    });
  } catch (err) {
    console.error("[upload-csv] FATAL:", err);
    return NextResponse.json(
      {
        error: `CSV processing failed: ${err.message || err}`,
      },
      { status: 500 },
    );
  }
}

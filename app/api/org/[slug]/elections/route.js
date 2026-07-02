/**
 * GET  /api/org/[slug]/elections  — list elections for this org (scoped)
 * POST /api/org/[slug]/elections  — create election via relay + pin metadata to IPFS + store in MongoDB
 */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Organization from "@/lib/models/Organization";
import Election from "@/lib/models/Election";
import { relayCreateElection } from "@/lib/relay";
import { pinJSON, getIPFSUrl } from "@/lib/ipfs";
import { ethers } from "ethers";

// Read-only contract for queries
async function getReadContract() {
  const abi = (
    await import("@/lib/contracts/VotingV1.json", { assert: { type: "json" } })
  ).default.abi;
  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL || "http://127.0.0.1:8545",
  );
  return new ethers.Contract(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
    abi,
    provider,
  );
}

export async function GET(req, { params }) {
  try {
    const { slug } = await params;
    await connectDB();
    const org = await Organization.findOne({ slug });
    if (!org)
      return NextResponse.json({ error: "Org not found" }, { status: 404 });

    // Get on-chain elections, then enrich with MongoDB metadata (orgSlug, guardianApproved, etc.)
    let onChainElections = [];
    try {
      const contract = await getReadContract();
      const raw = await contract.getAllElections();
      onChainElections = raw.map((e) => ({
        id: Number(e.id),
        title: e.title,
        description: e.description,
        bannerUrl: e.bannerUrl,
        startTime: Number(e.startTime),
        endTime: Number(e.endTime),
        phase: Number(e.phase),
      }));
    } catch (contractErr) {
      if (
        contractErr.code === "BAD_DATA" ||
        contractErr.code === "CALL_EXCEPTION"
      ) {
        console.warn(
          "[org/elections GET] Contract not available — returning empty list",
        );
      } else {
        throw contractErr;
      }
    }

    // Get all MongoDB election records for this org
    const dbElections = await Election.find({ orgSlug: slug }).lean();
    const dbMap = {};
    for (const e of dbElections) {
      dbMap[e.electionId] = e;
    }

    // Merge: only return elections that belong to this org (have a MongoDB record with this orgSlug)
    const orgElectionIds = new Set(dbElections.map((e) => e.electionId));
    const elections = onChainElections
      .filter((e) => orgElectionIds.has(e.id))
      .map((e) => {
        const db = dbMap[e.id] || {};
        return {
          ...e,
          _id: db._id,
          orgSlug: db.orgSlug || slug,
          guardianApproved: db.guardianApproved || false,
          pendingApproval: db.pendingApproval || false,
          guardianApprovedBy: db.guardianApprovedBy || "",
          guardianApprovedAt: db.guardianApprovedAt || null,
          ipfsCid: db.ipfsCid || "",
          candidates: db.candidates || [],
        };
      });

    return NextResponse.json({ elections });
  } catch (err) {
    console.error("[org/elections GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch elections" },
      { status: 500 },
    );
  }
}

export async function POST(req, { params }) {
  try {
    const { slug } = await params;
    const {
      title,
      description,
      bannerUrl = "",
      startTime,
      endTime,
    } = await req.json();

    if (!title || !description || !startTime || !endTime) {
      return NextResponse.json(
        { error: "title, description, startTime, endTime required" },
        { status: 400 },
      );
    }

    await connectDB();
    const org = await Organization.findOne({ slug });
    if (!org)
      return NextResponse.json({ error: "Org not found" }, { status: 404 });

    // Check for duplicate election title within this org
    try {
      const contract = await getReadContract();
      const existing = await contract.getAllElections();
      const titleLower = title.trim().toLowerCase();
      // Only check titles of elections belonging to this org
      const dbElections = await Election.find({ orgSlug: slug }).lean();
      const orgElectionIds = new Set(dbElections.map((e) => e.electionId));
      const duplicate = existing.find(
        (e) =>
          orgElectionIds.has(Number(e.id)) &&
          e.title.trim().toLowerCase() === titleLower,
      );
      if (duplicate) {
        return NextResponse.json(
          {
            error: `An election named "${title}" already exists for this organization`,
          },
          { status: 409 },
        );
      }
    } catch {
      // Contract may not be available yet — skip duplicate check
    }

    let start = Math.floor(new Date(startTime).getTime() / 1000);
    const end = Math.floor(new Date(endTime).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);

    const GRACE_SECS = 2 * 60;
    if (start + GRACE_SECS <= now)
      return NextResponse.json(
        { error: "Start time must be in the future" },
        { status: 400 },
      );
    if (end <= start)
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 },
      );

    // Bump to now+30s if within grace window
    if (start <= now) {
      start = now + 30;
    }

    // ── Pin election metadata to IPFS ─────────────────────────────────────────
    let ipfsCid = "";
    try {
      ipfsCid = await pinJSON(
        {
          type: "election-metadata",
          version: "1.0",
          title,
          description,
          bannerUrl,
          orgSlug: slug,
          startTime: new Date(start * 1000).toISOString(),
          endTime: new Date(end * 1000).toISOString(),
          pinnedAt: new Date().toISOString(),
        },
        `election-${slug}-${Date.now()}`,
        { orgSlug: slug, type: "election" },
      );
      console.log(
        `[elections POST] Pinned election metadata to IPFS: ${ipfsCid}`,
      );
    } catch (ipfsErr) {
      console.warn(
        "[elections POST] IPFS pin failed (non-fatal):",
        ipfsErr.message,
      );
    }

    // Create election on-chain via relay
    const { txHash, blockNumber } = await relayCreateElection(
      title,
      description,
      bannerUrl,
      start,
      end,
    );

    // Get the newly-created election ID from the contract
    let newElectionId = null;
    try {
      const contract = await getReadContract();
      const count = Number(await contract.electionCount());
      newElectionId = count - 1; // elections are 0-indexed, count is incremented after creation
    } catch (e) {
      console.warn(
        "[org/elections POST] Could not read new election ID:",
        e.message,
      );
    }

    // Store in MongoDB with org scoping — this is what makes elections per-org
    if (newElectionId !== null) {
      await Election.findOneAndUpdate(
        { electionId: newElectionId },
        {
          electionId: newElectionId,
          orgSlug: slug,
          orgId: org._id,
          title,
          description,
          startTime: new Date(start * 1000),
          endTime: new Date(end * 1000),
          phase: 0,
          txHash,
          blockNumber,
          ipfsCid,
          guardianApproved: false,
          pendingApproval: false,
        },
        { upsert: true, new: true },
      );
    }

    return NextResponse.json(
      {
        success: true,
        txHash,
        electionId: newElectionId,
        ipfsCid,
        ipfsUrl: getIPFSUrl(ipfsCid),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[org/elections POST]", err);
    return NextResponse.json(
      { error: err.message || "Failed to create election" },
      { status: 500 },
    );
  }
}

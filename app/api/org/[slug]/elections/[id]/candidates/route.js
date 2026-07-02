/**
 * GET  /api/org/[slug]/elections/[id]/candidates  — list candidates for election
 * POST /api/org/[slug]/elections/[id]/candidates  — add candidate via relay + pin metadata to IPFS
 */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Organization from "@/lib/models/Organization";
import Election from "@/lib/models/Election";
import { relayAddCandidate } from "@/lib/relay";
import { pinJSON, getIPFSUrl } from "@/lib/ipfs";
import { ethers } from "ethers";

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
    const { slug, id } = await params;
    const electionId = Number(id);

    await connectDB();
    const org = await Organization.findOne({ slug });
    if (!org)
      return NextResponse.json({ error: "Org not found" }, { status: 404 });

    // Verify this election belongs to this org
    const electionDoc = await Election.findOne({ electionId, orgSlug: slug });
    if (!electionDoc) {
      return NextResponse.json(
        { error: "Election not found for this organization" },
        { status: 404 },
      );
    }

    // Fetch candidates from on-chain
    const contract = await getReadContract();
    const rawCandidates = await contract.getCandidates(electionId);
    const candidates = rawCandidates.map((c) => ({
      id: Number(c.id),
      name: c.name,
      party: c.party,
      symbol: c.symbol,
      manifesto: c.manifesto,
      photoUrl: c.photoUrl,
      voteCount: Number(c.voteCount),
    }));

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("[candidates GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch candidates" },
      { status: 500 },
    );
  }
}

export async function POST(req, { params }) {
  try {
    const { slug, id } = await params;
    const electionId = Number(id);
    const {
      name,
      party,
      symbol,
      manifesto = "",
      photoUrl = "",
    } = await req.json();

    if (!name?.trim())
      return NextResponse.json(
        { error: "Candidate name is required" },
        { status: 400 },
      );
    if (!party?.trim())
      return NextResponse.json(
        { error: "Party / affiliation is required" },
        { status: 400 },
      );
    if (!symbol?.trim())
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 },
      );

    await connectDB();
    const org = await Organization.findOne({ slug });
    if (!org)
      return NextResponse.json({ error: "Org not found" }, { status: 404 });

    // Verify election belongs to this org and is in Registration phase
    const electionDoc = await Election.findOne({ electionId, orgSlug: slug });
    if (!electionDoc) {
      return NextResponse.json(
        { error: "Election not found for this organization" },
        { status: 404 },
      );
    }
    if (electionDoc.phase !== 0) {
      return NextResponse.json(
        { error: "Candidates can only be added during Registration phase" },
        { status: 400 },
      );
    }

    // Add candidate on-chain via relay
    const { txHash } = await relayAddCandidate(
      electionId,
      name.trim(),
      party.trim(),
      symbol.trim(),
      manifesto,
      photoUrl,
    );

    // Pin candidate metadata to IPFS
    let ipfsCid = "";
    try {
      ipfsCid = await pinJSON(
        {
          type: "candidate-metadata",
          version: "1.0",
          electionId,
          orgSlug: slug,
          name: name.trim(),
          party: party.trim(),
          symbol: symbol.trim(),
          manifesto,
          photoUrl,
          txHash,
          pinnedAt: new Date().toISOString(),
        },
        `candidate-${slug}-election${electionId}-${name.trim().replace(/\s+/g, "-")}`,
        { orgSlug: slug, electionId: String(electionId), type: "candidate" },
      );
      console.log(
        `[candidates POST] Pinned candidate "${name}" to IPFS: ${ipfsCid}`,
      );
    } catch (ipfsErr) {
      console.warn(
        "[candidates POST] IPFS pin failed (non-fatal):",
        ipfsErr.message,
      );
    }

    // Update candidate count in MongoDB
    await Election.findOneAndUpdate(
      { electionId, orgSlug: slug },
      { $inc: { candidateCount: 1 } },
    );

    return NextResponse.json({
      success: true,
      txHash,
      ipfsCid,
      ipfsUrl: getIPFSUrl(ipfsCid),
    });
  } catch (err) {
    console.error("[candidates POST]", err);
    return NextResponse.json(
      { error: err.message || "Failed to add candidate" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/org/[slug]/elections/[id]/phase
 * 
 * Org admin can:
 * - Request go-live (Registration → pendingApproval=true) — needs guardian approval
 * - End election (Voting → Completed) — direct, no approval needed
 * 
 * Body: { action: 'request-live' | 'end-election' }
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Organization from '@/lib/models/Organization';
import Election from '@/lib/models/Election';
import { relayTransitionPhase } from '@/lib/relay';

export async function POST(req, { params }) {
  try {
    const { slug, id } = await params;
    const electionId = Number(id);
    const { action } = await req.json();

    if (!action) return NextResponse.json({ error: 'action is required' }, { status: 400 });

    await connectDB();
    const org = await Organization.findOne({ slug });
    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

    const electionDoc = await Election.findOne({ electionId, orgSlug: slug });
    if (!electionDoc) {
      return NextResponse.json({ error: 'Election not found for this organization' }, { status: 404 });
    }

    if (action === 'request-live') {
      // Org admin requests the election go live (Registration → Voting)
      // This just sets a flag — a Guardian must approve before the on-chain phase changes
      if (electionDoc.phase !== 0) {
        return NextResponse.json({ error: 'Election must be in Registration phase to request go-live' }, { status: 400 });
      }
      if (electionDoc.pendingApproval) {
        return NextResponse.json({ error: 'Go-live approval is already pending' }, { status: 400 });
      }
      if (electionDoc.guardianApproved) {
        return NextResponse.json({ error: 'Election is already approved and live' }, { status: 400 });
      }

      // Check at least 1 candidate exists on-chain
      if ((electionDoc.candidateCount || 0) < 1) {
        return NextResponse.json({ error: 'Add at least 1 candidate before requesting go-live' }, { status: 400 });
      }

      await Election.findOneAndUpdate(
        { electionId, orgSlug: slug },
        { pendingApproval: true }
      );

      return NextResponse.json({
        success: true,
        message: 'Go-live request submitted. A Guardian must approve before the election goes live.',
      });
    }

    if (action === 'end-election') {
      // Org admin ends voting (Voting → Completed) — no approval needed
      if (electionDoc.phase !== 1) {
        return NextResponse.json({ error: 'Election must be in Voting phase to end it' }, { status: 400 });
      }

      // Transition on-chain (phase 2 = Completed)
      const { txHash } = await relayTransitionPhase(electionId, 2, slug);

      // Update MongoDB
      await Election.findOneAndUpdate(
        { electionId, orgSlug: slug },
        { phase: 2, guardianApproved: false } // reset for clarity
      );

      return NextResponse.json({ success: true, txHash, message: 'Election ended. Results are now public.' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[phase POST]', err);
    return NextResponse.json({ error: err.message || 'Phase transition failed' }, { status: 500 });
  }
}

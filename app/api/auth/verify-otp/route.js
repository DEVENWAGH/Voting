/**
 * POST /api/auth/verify-otp
 * Verifies OTP and casts vote via relay (gasless).
 * Body: { email, otp, electionId, candidateId, orgId }
 */
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import EmailOTP from '@/lib/models/EmailOTP';
import Organization from '@/lib/models/Organization';
import { relayCastVote } from '@/lib/relay';

export async function POST(req) {
  try {
    const { email, otp, electionId, candidateId, orgId } = await req.json();

    if (!email || !otp || electionId === undefined || candidateId === undefined || !orgId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();

    // Find valid OTP record
    const otpRecord = await EmailOTP.findOne({
      email: email.toLowerCase(),
      purpose: 'vote',
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return NextResponse.json({ error: 'OTP expired or not found. Please request a new one.' }, { status: 400 });
    }

    // Check attempt limit
    if (otpRecord.attempts >= 3) {
      await EmailOTP.deleteOne({ _id: otpRecord._id });
      return NextResponse.json({ error: 'Too many wrong attempts. Request a new OTP.' }, { status: 400 });
    }

    if (otpRecord.otp !== otp) {
      await EmailOTP.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
      return NextResponse.json({
        error: 'Incorrect OTP',
        attemptsLeft: 3 - (otpRecord.attempts + 1),
      }, { status: 400 });
    }

    // OTP valid — mark as used
    await EmailOTP.updateOne({ _id: otpRecord._id }, { used: true });

    // Get voter & compute nullifier
    const voter = await Voter.findOne({ email: email.toLowerCase(), orgId, status: 'registered' });
    if (!voter) {
      return NextResponse.json({ error: 'Voter not found in registry' }, { status: 404 });
    }

    // Nullifier: keccak256(orgId + memberId + SERVER_IDENTITY_SECRET)
    const nullifierHash = ethers.keccak256(
      ethers.toUtf8Bytes(`${orgId}:${voter.memberId}:${process.env.SERVER_IDENTITY_SECRET}`)
    );

    // Cast vote via relay (gas paid by platform)
    const result = await relayCastVote(
      Number(electionId),
      Number(candidateId),
      nullifierHash
    );

    return NextResponse.json({
      success: true,
      message: 'Vote cast successfully!',
      txHash: result.txHash,
      blockNumber: result.blockNumber,
    });
  } catch (err) {
    console.error('[verify-otp]', err);
    // Surface contract revert messages clearly
    if (err?.message?.includes('already voted')) {
      return NextResponse.json({ error: 'You have already voted in this election.' }, { status: 409 });
    }
    if (err?.message?.includes('voter not registered')) {
      return NextResponse.json({ error: 'Voter not registered on-chain. Contact admin.' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to cast vote. Please try again.' }, { status: 500 });
  }
}

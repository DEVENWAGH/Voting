/**
 * lib/preflightCache.js
 * Edge Pre-flight Validation Cache
 * 
 * Simulates edge-computing behavior (Lambda@Edge + DynamoDB Global Tables)
 * using MongoDB as the fast lookup cache. In production, this would be
 * deployed to CloudFront Lambda@Edge with DynamoDB for sub-10ms latency.
 * 
 * Purpose: Reject invalid/duplicate votes BEFORE they hit the blockchain,
 * saving gas fees and reducing network congestion.
 */
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import VoteActivity from '@/lib/models/VoteActivity';
import Election from '@/lib/models/Election';

/**
 * Pre-flight validation for a vote attempt.
 * Returns { allowed: boolean, reason: string, latencyMs: number }
 * 
 * Checks performed (all from MongoDB cache — no blockchain query):
 * 1. Is the voter registered on-chain for this specific election?
 * 2. Has the voter already voted in this election?
 * 3. Is the election in the Voting phase?
 *
 * electionId is a string (bytes32 hex from the smart contract)
 */
export async function preflightCheck(nullifierHash, electionId) {
  const start = Date.now();

  await connectDB();

  // Check 1: Is the voter registered for this election?
  const voter = await Voter.findOne(
    { nullifierHash, electionId: String(electionId), status: 'registered' },
    { _id: 1 }
  ).lean();

  if (!voter) {
    return {
      allowed: false,
      reason: 'Voter not registered. Registration is required before voting.',
      code: 'NOT_REGISTERED',
      latencyMs: Date.now() - start,
      cached: true,
    };
  }

  // Check 2: Has the voter already voted in this election?
  const existingVote = await VoteActivity.findOne(
    { electionId: String(electionId), voterNullifier: nullifierHash },
    { _id: 1 }
  ).lean();

  if (existingVote) {
    return {
      allowed: false,
      reason: 'You have already cast your vote in this election.',
      code: 'ALREADY_VOTED',
      latencyMs: Date.now() - start,
      cached: true,
    };
  }

  // Check 3: Is the election in the Voting phase?
  const election = await Election.findOne(
    { electionId: String(electionId) },
    { phase: 1 }
  ).lean();

  if (!election) {
    return {
      allowed: false,
      reason: 'Election not found.',
      code: 'ELECTION_NOT_FOUND',
      latencyMs: Date.now() - start,
      cached: true,
    };
  }

  if (election.phase !== 1) {
    const phaseNames = ['Registration', 'Voting', 'Completed'];
    return {
      allowed: false,
      reason: `Election is in "${phaseNames[election.phase]}" phase, not "Voting".`,
      code: 'WRONG_PHASE',
      latencyMs: Date.now() - start,
      cached: true,
    };
  }

  // All checks passed
  return {
    allowed: true,
    reason: 'Pre-flight validation passed. Vote is eligible.',
    code: 'ALLOWED',
    latencyMs: Date.now() - start,
    cached: true,
  };
}

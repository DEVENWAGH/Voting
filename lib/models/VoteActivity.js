import mongoose from 'mongoose';

/**
 * VoteActivity — anonymized vote ledger.
 *
 * PRIVACY DESIGN:
 *   - NO voterNullifier — storing the nullifier here would let anyone with DB
 *     access trace email → nullifierHash → candidateId, breaking vote secrecy.
 *   - NO voterLocation — GPS coordinates alongside vote data can identify
 *     voters in small districts. Location analytics (if needed) must live in a
 *     separate, unlinked collection with no candidateId.
 *   - Anti-double-vote enforcement uses the on-chain hasVoted mapping and the
 *     Voter model's status, NOT this collection.
 */
const VoteActivitySchema = new mongoose.Schema(
  {
    electionId:      { type: String, required: true, index: true },
    candidateId:     { type: Number, required: true },
    txHash:          { type: String, required: true, unique: true },
    blockNumber:     { type: Number },
    timestamp:       { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.VoteActivity ??
  mongoose.model('VoteActivity', VoteActivitySchema);

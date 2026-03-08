import mongoose from 'mongoose';

// Anonymized — stores electionId + candidateId only. No voter address.
const VoteActivitySchema = new mongoose.Schema(
  {
    electionId:  { type: Number, required: true, index: true },
    candidateId: { type: Number, required: true },
    txHash:      { type: String, required: true, unique: true },
    blockNumber: { type: Number },
    timestamp:   { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.VoteActivity ??
  mongoose.model('VoteActivity', VoteActivitySchema);

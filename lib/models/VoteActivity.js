import mongoose from 'mongoose';

// Anonymized — stores electionId + candidateId only. No voter address.
const VoteActivitySchema = new mongoose.Schema(
  {
    electionId:      { type: String, required: true, index: true },
    candidateId:     { type: Number, required: true },
    txHash:          { type: String, required: true, unique: true },
    blockNumber:     { type: Number },
    voterNullifier:  { type: String, index: true },
    voterLocation: {
      latitude:  { type: Number },
      longitude: { type: Number },
      accuracy:  { type: Number },
      city:      { type: String },
      country:   { type: String },
    },
    timestamp:       { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.VoteActivity ??
  mongoose.model('VoteActivity', VoteActivitySchema);

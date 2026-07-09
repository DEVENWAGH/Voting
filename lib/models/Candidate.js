import mongoose from 'mongoose';

const CandidateSchema = new mongoose.Schema(
  {
    electionId:  { type: String, required: true, index: true },
    candidateId: { type: Number, required: true },
    name:        { type: String, required: true },
    party:       { type: String, required: true },
    symbol:      { type: String },
    manifesto:   { type: String },
    voteCount:   { type: Number, default: 0 },
    txHash:      { type: String },
    blockNumber: { type: Number },
  },
  { timestamps: true }
);

CandidateSchema.index({ electionId: 1, candidateId: 1 }, { unique: true });

export default mongoose.models.Candidate ?? mongoose.model('Candidate', CandidateSchema);

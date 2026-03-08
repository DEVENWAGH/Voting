import mongoose from 'mongoose';

const ElectionSchema = new mongoose.Schema(
  {
    electionId:    { type: Number, required: true, unique: true, index: true },
    title:         { type: String, required: true },
    description:   { type: String },
    startTime:     { type: Date, required: true },
    endTime:       { type: Date, required: true },
    // 0 = Registration, 1 = Voting, 2 = Completed
    phase:         { type: Number, default: 0, enum: [0, 1, 2] },
    txHash:        { type: String },
    blockNumber:   { type: Number },
    candidateCount:{ type: Number, default: 0 },
    totalVotes:    { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.Election ?? mongoose.model('Election', ElectionSchema);

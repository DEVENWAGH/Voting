import mongoose from "mongoose";

const ElectionSchema = new mongoose.Schema(
  {
    electionId: { type: Number, required: true, unique: true, index: true },
    // Which org owns this election (scoping)
    orgSlug: { type: String, index: true, default: "" },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },

    title: { type: String, required: true },
    description: { type: String },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    // 0 = Registration, 1 = Voting, 2 = Completed
    phase: { type: Number, default: 0, enum: [0, 1, 2] },
    txHash: { type: String },
    blockNumber: { type: Number },
    candidateCount: { type: Number, default: 0 },
    totalVotes: { type: Number, default: 0 },

    // Guardian approval gate — election can't go live without this
    guardianApproved: { type: Boolean, default: false },
    guardianApprovedBy: { type: String, default: "" }, // guardian wallet address
    guardianApprovedAt: { type: Date, default: null },

    // Pending approval request from org admin
    pendingApproval: { type: Boolean, default: false },

    // IPFS — CID of pinned election metadata JSON (Pinata)
    ipfsCid: { type: String, default: "" },
  },
  { timestamps: true },
);

// Index for fast org-scoped queries
ElectionSchema.index({ orgSlug: 1, phase: 1 });
ElectionSchema.index({ pendingApproval: 1, guardianApproved: 1 });

export default mongoose.models.Election ??
  mongoose.model("Election", ElectionSchema);

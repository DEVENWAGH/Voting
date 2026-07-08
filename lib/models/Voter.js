import mongoose from 'mongoose';

const VoterSchema = new mongoose.Schema({
  // Org relation — both slug (for direct URL queries) and ObjectId (for joins)
  orgSlug:       { type: String, required: true, trim: true },         // e.g. "mit-college"
  orgId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },

  // Election relation — on-chain election ID
  electionId:    { type: Number, required: true },

  // Voter identity
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, lowercase: true, trim: true },
  phone:         { type: String, default: '' },    // optional
  gender:        { type: String, default: '' },    // optional (Male / Female / Other)
  age:           { type: Number, default: null },  // optional
  memberId:      { type: String, default: '' },    // optional org-specific ID

  // On-chain registration — same hash across elections for the same org member (org-level identity)
  nullifierHash: { type: String, default: '' },
  status:        { type: String, enum: ['pending', 'registered', 'rejected'], default: 'pending' },
  registeredAt:  { type: Date },
  onChainTxHash: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
}, { timestamps: true });

// Primary unique constraint: one voter per email per election per org
VoterSchema.index({ orgSlug: 1, electionId: 1, email: 1 }, { unique: true });

// Secondary index for querying pending voters during bulk-register
VoterSchema.index({ orgSlug: 1, electionId: 1, status: 1 });
// Lookup at vote time — scoped per election roster
VoterSchema.index({ orgSlug: 1, electionId: 1, nullifierHash: 1 });

export default mongoose.models.Voter || mongoose.model('Voter', VoterSchema);

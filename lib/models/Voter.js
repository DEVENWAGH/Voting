import mongoose from 'mongoose';

const VoterSchema = new mongoose.Schema({
  orgId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, lowercase: true, trim: true },
  phone:         { type: String, default: '' },  // optional, cosmetic only — no SMS
  memberId:      { type: String, required: true, trim: true }, // org-assigned (roll no, emp ID)
  role:          { type: String, default: 'member' },          // student / employee / member
  nullifierHash: { type: String, unique: true, sparse: true }, // keccak256(orgId+memberId+secret)
  status:        { type: String, enum: ['pending', 'registered', 'rejected'], default: 'pending' },
  uploadBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'VoterUploadBatch' },
  registeredAt:  { type: Date },
  onChainTxHash: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
}, { timestamps: true });

// unique email per org
VoterSchema.index({ orgId: 1, email: 1 }, { unique: true });
// unique memberId per org
VoterSchema.index({ orgId: 1, memberId: 1 }, { unique: true });

export default mongoose.models.Voter || mongoose.model('Voter', VoterSchema);

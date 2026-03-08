import mongoose from 'mongoose';

// aadhaarHash is intentionally NOT stored — privacy by design.
const VoterRegistrationSchema = new mongoose.Schema(
  {
    walletAddress:    { type: String, required: true, unique: true, lowercase: true, index: true },
    registrationTime: { type: Date, default: Date.now },
    txHash:           { type: String },
    blockNumber:      { type: Number },
  },
  { timestamps: true }
);

export default mongoose.models.VoterRegistration ??
  mongoose.model('VoterRegistration', VoterRegistrationSchema);

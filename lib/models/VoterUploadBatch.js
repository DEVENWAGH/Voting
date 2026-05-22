import mongoose from 'mongoose';

const VoterUploadBatchSchema = new mongoose.Schema({
  orgId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  uploadedBy:   { type: String, required: true },  // admin email
  filename:     { type: String, required: true },
  totalRows:    { type: Number, default: 0 },
  validRows:    { type: Number, default: 0 },
  errorRows:    { type: Number, default: 0 },
  registeredRows: { type: Number, default: 0 },
  status:       { type: String, enum: ['uploaded', 'registering', 'completed', 'failed'], default: 'uploaded' },
  errors:       [{ row: Number, memberId: String, reason: String }],
  createdAt:    { type: Date, default: Date.now },
  completedAt:  { type: Date },
});

export default mongoose.models.VoterUploadBatch || mongoose.model('VoterUploadBatch', VoterUploadBatchSchema);

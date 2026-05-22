import mongoose from 'mongoose';

const EmailOTPSchema = new mongoose.Schema({
  email:     { type: String, required: true, lowercase: true },
  otp:       { type: String, required: true },   // bcrypt hashed
  orgId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  purpose:   {
    type: String,
    enum: ['vote', 'org-login', 'admin-login', 'org-signup'],
    default: 'vote',
  },
  expiresAt: { type: Date, required: true },
  used:      { type: Boolean, default: false },
  attempts:  { type: Number, default: 0 },
}, { timestamps: true });

EmailOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-delete

export default mongoose.models.EmailOTP || mongoose.model('EmailOTP', EmailOTPSchema);

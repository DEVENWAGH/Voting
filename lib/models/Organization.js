import mongoose from 'mongoose';

const OrganizationSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  slug:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  adminEmail:   { type: String, required: true, unique: true, lowercase: true, trim: true },
  description:  { type: String, default: '' },
  type:         { type: String, enum: ['college', 'company', 'community', 'dao', 'other'], default: 'other' },
  logoUrl:      { type: String, default: '' },
  passwordHash: { type: String, default: null },  // bcrypt hash; null for Google OAuth orgs
  googleId:     { type: String, default: null },   // Google OAuth sub id
  isEmailVerified: { type: Boolean, default: false }, // true after OTP verification
  isActive:     { type: Boolean, default: true },
  createdAt:    { type: Date, default: Date.now },
});

export default mongoose.models.Organization || mongoose.model('Organization', OrganizationSchema);

import mongoose from 'mongoose';

const OrganizationSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, default: '' },
  type:        { type: String, enum: ['college', 'company', 'community', 'dao', 'other'], default: 'other' },
  logoUrl:     { type: String, default: '' },  // ImageKit CDN URL
  adminEmail:  { type: String, required: true, lowercase: true },
  isVerified:  { type: Boolean, default: false },
  isActive:    { type: Boolean, default: true },
  createdAt:   { type: Date, default: Date.now },
});

export default mongoose.models.Organization || mongoose.model('Organization', OrganizationSchema);

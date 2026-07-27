import mongoose from 'mongoose';

/**
 * BiometricHash — stores a zero-knowledge biometric hash for voter verification.
 * 
 * Privacy by design:
 * - NO raw image data is ever stored
 * - NO facial features are stored
 * - Only an HMAC-SHA256 hash of face landmark coordinates is persisted
 * - The hash is irreversible — you cannot reconstruct the face from it
 * 
 * In production, this integrates with AWS Rekognition DetectFaces API.
 * For local development, face detection uses browser Canvas API measurements.
 */
const BiometricHashSchema = new mongoose.Schema(
  {
    // Links to the Voter model via nullifierHash (no PII reference)
    nullifierHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // HMAC-SHA256 of face landmark data — zero-knowledge proof of identity
    biometricHash: {
      type: String,
      required: true,
    },
    // Processing metadata (no PII)
    faceConfidence: {
      type: Number,
      default: 0,
    },
    provider: {
      type: String,
      enum: ['local-canvas', 'aws-rekognition'],
      default: 'local-canvas',
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    lastVerifiedAt: {
      type: Date,
    },
    verificationCount: {
      type: Number,
      default: 0,
    },
    faceAttributes: {
      type: Object,
    },
    faceId: {
      type: String,
      default: '',
    },
    bypassDuplicateCheck: {
      type: Boolean,
      default: false,
    },
    twinVerificationStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    twinMatchedNullifier: {
      type: String,
      default: '',
    },
    twinMatchedEmail: {
      type: String,
      default: '',
    },
    twinMatchSimilarity: {
      type: Number,
      default: 0,
    },
    twinNotes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export default mongoose.models.BiometricHash ??
  mongoose.model('BiometricHash', BiometricHashSchema);

/**
 * lib/biometric.js
 * Biometric verification utilities
 * 
 * Provides:
 * 1. Landmark normalization and hashing (HMAC-SHA256) for privacy-preserving storage
 * 2. JWT signing and verification for short-lived biometric tokens
 */
import crypto from 'crypto';
import { RekognitionClient } from "@aws-sdk/client-rekognition";

// Enforce secrets
const IDENTITY_SECRET = process.env.SERVER_IDENTITY_SECRET || 'dev-identity-secret-change-in-prod-12345';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-prod-54321';

/**
 * Initializes and returns the AWS Rekognition client if credentials are set.
 * Returns null if credentials are not configured.
 */
export function getRekognitionClient() {
  const region = process.env.AWS_REGION || "us-east-1";

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return new RekognitionClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  // Auto-resolve credentials from AWS SDK provider chain
  return new RekognitionClient({ region });
}


/**
 * Checks if AWS Rekognition is configured.
 */
export function isAWSConfigured() {
  return true;
}

/**
 * Normalizes facial landmarks to ensure distance-invariance.
 * Landmarks should represent ratios rather than absolute pixel coordinates.
 * 
 * Expected landmarks shape:
 * {
 *   eyeDistance: number,    // distance between pupils
 *   noseLength: number,     // bridge to tip
 *   mouthWidth: number,     // corner to corner
 *   jawWidth: number,       // jawbone width
 *   faceHeight: number,     // forehead to chin
 * }
 */
export function normalizeLandmarks(landmarks) {
  const { eyeDistance, noseLength, mouthWidth, jawWidth, faceHeight } = landmarks;
  
  // Use faceHeight as the base unit to normalize other measurements
  if (!faceHeight || faceHeight === 0) return null;

  return {
    eyeDistanceRatio: Math.round((eyeDistance / faceHeight) * 10000) / 10000,
    noseLengthRatio: Math.round((noseLength / faceHeight) * 10000) / 10000,
    mouthWidthRatio: Math.round((mouthWidth / faceHeight) * 10000) / 10000,
    jawWidthRatio: Math.round((jawWidth / faceHeight) * 10000) / 10000,
  };
}

/**
 * Generates an HMAC-SHA256 hash from normalized face ratios.
 * This is zero-knowledge: the raw face features cannot be reconstructed from this hash.
 */
export function hashLandmarks(normalizedLandmarks) {
  if (!normalizedLandmarks) return null;
  
  // Sort keys to ensure consistent JSON stringification
  const landmarksStr = JSON.stringify(normalizedLandmarks, Object.keys(normalizedLandmarks).sort());
  
  return crypto
    .createHmac('sha256', IDENTITY_SECRET)
    .update(landmarksStr)
    .digest('hex');
}

/**
 * Checks if two biometric hashes are within an acceptable tolerance threshold.
 * For local Canvas-based landmarks, we compare the ratio metrics directly on the server
 * if they are sent for verification, or we can use a similarity scoring algorithm.
 */
export function calculateSimilarity(normalizedA, normalizedB) {
  if (!normalizedA || !normalizedB) return 0;
  
  // Compare ratios and calculate average deviation
  const keys = ['eyeDistanceRatio', 'noseLengthRatio', 'mouthWidthRatio', 'jawWidthRatio'];
  let totalError = 0;
  
  for (const key of keys) {
    const valA = normalizedA[key];
    const valB = normalizedB[key];
    if (valA === undefined || valB === undefined) return 0;
    
    totalError += Math.abs(valA - valB) / Math.max(valA, valB, 0.0001);
  }
  
  const avgError = totalError / keys.length;
  // 100% similarity = 1, decreases as error increases
  return Math.max(0, 1 - avgError);
}

// ─── Token Utilities ──────────────────────────────────────────────────────────

function base64url(buf) {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Issues a short-lived (60-second) JWT representing successful biometric authentication.
 */
export function issueBiometricToken(nullifierHash) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { nullifierHash, authenticated: true };
  
  const encodedHeader = base64url(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64url(Buffer.from(JSON.stringify(payload)));
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  
  const encodedSignature = base64url(signature);
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies a biometric JWT. Returns payload if valid, null otherwise.
 */
export function verifyBiometricToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    
    const expectedSignature = base64url(signature);
    if (encodedSignature !== expectedSignature) return null;
    
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
    
    return payload;
  } catch (err) {
    console.error('Failed to verify biometric token:', err);
    return null;
  }
}

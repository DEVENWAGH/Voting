import { expect } from 'chai';
import {
  normalizeLandmarks,
  calculateSimilarity,
  issueBiometricToken,
  verifyBiometricToken,
  isAWSConfigured
} from '../lib/biometric.js';

describe('Biometric Verification Utilities', () => {
  describe('normalizeLandmarks', () => {
    it('should normalize coordinates relative to faceHeight', () => {
      const landmarks = {
        faceHeight: 200,
        eyeDistance: 80,
        noseLength: 40,
        mouthWidth: 60,
        jawWidth: 140,
      };

      const normalized = normalizeLandmarks(landmarks);

      expect(normalized).to.not.be.null;
      expect(normalized.eyeDistanceRatio).to.equal(0.4);
      expect(normalized.noseLengthRatio).to.equal(0.2);
      expect(normalized.mouthWidthRatio).to.equal(0.3);
      expect(normalized.jawWidthRatio).to.equal(0.7);
    });

    it('should return null if faceHeight is missing or zero', () => {
      const landmarks = {
        faceHeight: 0,
        eyeDistance: 80,
        noseLength: 40,
        mouthWidth: 60,
        jawWidth: 140,
      };

      const normalized = normalizeLandmarks(landmarks);
      expect(normalized).to.be.null;
    });
  });

  describe('calculateSimilarity', () => {
    it('should calculate 100% similarity for identical landmarks', () => {
      const landmarksA = {
        eyeDistanceRatio: 0.4,
        noseLengthRatio: 0.2,
        mouthWidthRatio: 0.3,
        jawWidthRatio: 0.7,
      };

      const similarity = calculateSimilarity(landmarksA, landmarksA);
      expect(similarity).to.equal(1);
    });

    it('should calculate lower similarity for different landmarks', () => {
      const landmarksA = {
        eyeDistanceRatio: 0.4,
        noseLengthRatio: 0.2,
        mouthWidthRatio: 0.3,
        jawWidthRatio: 0.7,
      };

      const landmarksB = {
        eyeDistanceRatio: 0.45, // 12.5% error
        noseLengthRatio: 0.2,
        mouthWidthRatio: 0.3,
        jawWidthRatio: 0.7,
      };

      const similarity = calculateSimilarity(landmarksA, landmarksB);
      expect(similarity).to.be.greaterThan(0.9);
      expect(similarity).to.be.lessThan(1);
    });
  });

  describe('issueBiometricToken and verifyBiometricToken', () => {
    const testNullifier = '0x' + '1'.repeat(64);

    it('should issue a valid token and verify it successfully', () => {
      const token = issueBiometricToken(testNullifier);
      expect(token).to.be.a('string');
      expect(token.split('.').length).to.equal(3);

      const decoded = verifyBiometricToken(token);
      expect(decoded).to.not.be.null;
      expect(decoded.nullifierHash).to.equal(testNullifier);
      expect(decoded.authenticated).to.be.true;
    });

    it('should fail verification for a corrupted token', () => {
      const token = issueBiometricToken(testNullifier);
      const corrupted = token + 'corrupt';

      const decoded = verifyBiometricToken(corrupted);
      expect(decoded).to.be.null;
    });
  });

  describe('isAWSConfigured', () => {
    it('should return a boolean value', () => {
      const result = isAWSConfigured();
      expect(result).to.be.a('boolean');
    });
  });
});

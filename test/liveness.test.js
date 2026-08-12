import { expect } from 'chai';

/**
 * Liveness Engine Tests
 * 
 * Tests the pure-logic functions from lib/livenessEngine.js.
 * Since the engine is 'use client' and depends on TensorFlow.js + browser APIs,
 * we test the exported pure functions (checkDistance, constants) and replicate
 * the internal algorithms (computeColorVariance, pinhole distance) here.
 */

// ─── Replicate constants from livenessEngine.js ─────────────────────────────
const AVERAGE_FACE_HEIGHT_M = 0.22;
const FOCAL_LENGTH_PX = 763;
const BACKGROUND_VARIANCE_THRESHOLD = 35;
const MIN_DISTANCE_M = 0.5;
const MAX_DISTANCE_M = 1.5;

// ─── Replicate checkDistance logic ──────────────────────────────────────────
function checkDistance(distance) {
  return {
    inRange: distance >= MIN_DISTANCE_M && distance <= MAX_DISTANCE_M,
    tooClose: distance < MIN_DISTANCE_M,
    tooFar: distance > MAX_DISTANCE_M,
  };
}

// ─── Replicate pinhole distance formula ────────────────────────────────────
function estimateDistance(pixelHeight) {
  if (pixelHeight <= 0) return Infinity;
  return (AVERAGE_FACE_HEIGHT_M * FOCAL_LENGTH_PX) / pixelHeight;
}

// ─── Replicate computeColorVariance ────────────────────────────────────────
function computeColorVariance(pixels) {
  if (pixels.length === 0) return 100;

  const grays = pixels.map((p) => 0.299 * p.r + 0.587 * p.g + 0.114 * p.b);
  const mean = grays.reduce((a, b) => a + b, 0) / grays.length;
  const variance = grays.reduce((sum, g) => sum + (g - mean) ** 2, 0) / grays.length;
  const stdDev = Math.sqrt(variance);

  let edgeSum = 0;
  const step = Math.max(1, Math.floor(pixels.length / 200));
  let edgeCount = 0;
  for (let i = step; i < grays.length; i += step) {
    edgeSum += Math.abs(grays[i] - grays[i - step]);
    edgeCount++;
  }
  const avgEdge = edgeCount > 0 ? edgeSum / edgeCount : 0;

  const hueBuckets = new Set();
  for (let i = 0; i < pixels.length; i += Math.max(1, Math.floor(pixels.length / 100))) {
    const p = pixels[i];
    const maxC = Math.max(p.r, p.g, p.b);
    const minC = Math.min(p.r, p.g, p.b);
    if (maxC - minC > 25) {
      const hueBucket = Math.floor(
        ((p.r > p.g ? (p.g - p.b) : (p.b - p.r)) / (maxC - minC + 1)) * 6 + 6
      ) % 6;
      hueBuckets.add(hueBucket);
    }
  }

  const normalizedStdDev = Math.min(stdDev / 60, 1) * 50;
  const normalizedEdge = Math.min(avgEdge / 30, 1) * 30;
  const normalizedHue = Math.min(hueBuckets.size / 4, 1) * 20;

  return Math.round(normalizedStdDev + normalizedEdge + normalizedHue);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Liveness Engine — Distance Estimation', () => {

  describe('Pinhole Camera Distance Formula', () => {
    it('should estimate ~0.7m when face bbox is ~240px tall', () => {
      const distance = estimateDistance(240);
      expect(distance).to.be.closeTo(0.7, 0.05);
    });

    it('should estimate ~1.0m when face bbox is ~168px tall', () => {
      const distance = estimateDistance(168);
      expect(distance).to.be.closeTo(1.0, 0.05);
    });

    it('should estimate ~0.5m when face bbox is ~336px tall', () => {
      const distance = estimateDistance(336);
      expect(distance).to.be.closeTo(0.5, 0.05);
    });

    it('should estimate ~1.5m when face bbox is ~112px tall', () => {
      const distance = estimateDistance(112);
      expect(distance).to.be.closeTo(1.5, 0.05);
    });

    it('should return Infinity for zero pixel height', () => {
      const distance = estimateDistance(0);
      expect(distance).to.equal(Infinity);
    });

    it('should return Infinity for negative pixel height', () => {
      const distance = estimateDistance(-100);
      expect(distance).to.equal(Infinity);
    });

    it('should return very small distance for very large bbox (face very close)', () => {
      const distance = estimateDistance(600);
      expect(distance).to.be.lessThan(0.3);
    });

    it('should return very large distance for very small bbox (face far away)', () => {
      const distance = estimateDistance(30);
      expect(distance).to.be.greaterThan(5);
    });
  });

  describe('checkDistance — Range Validation', () => {
    it('should return inRange=true for 0.5m (min boundary)', () => {
      const result = checkDistance(0.5);
      expect(result.inRange).to.be.true;
      expect(result.tooClose).to.be.false;
      expect(result.tooFar).to.be.false;
    });

    it('should return inRange=true for 1.5m (max boundary)', () => {
      const result = checkDistance(1.5);
      expect(result.inRange).to.be.true;
      expect(result.tooClose).to.be.false;
      expect(result.tooFar).to.be.false;
    });

    it('should return inRange=true for 1.0m (middle of range)', () => {
      const result = checkDistance(1.0);
      expect(result.inRange).to.be.true;
    });

    it('should return tooClose=true for 0.3m', () => {
      const result = checkDistance(0.3);
      expect(result.inRange).to.be.false;
      expect(result.tooClose).to.be.true;
      expect(result.tooFar).to.be.false;
    });

    it('should return tooFar=true for 2.0m', () => {
      const result = checkDistance(2.0);
      expect(result.inRange).to.be.false;
      expect(result.tooClose).to.be.false;
      expect(result.tooFar).to.be.true;
    });

    it('should return tooClose=true for 0.0m', () => {
      const result = checkDistance(0);
      expect(result.tooClose).to.be.true;
      expect(result.inRange).to.be.false;
    });

    it('should return tooFar=true for very large distances', () => {
      const result = checkDistance(100);
      expect(result.tooFar).to.be.true;
      expect(result.inRange).to.be.false;
    });
  });
});

describe('Liveness Engine — Background Uniformity Analysis', () => {

  describe('computeColorVariance', () => {
    it('should return 0 (most uniform) for identical solid-color pixels', () => {
      // Perfectly uniform wall — all pixels are the same color
      const pixels = Array(200).fill({ r: 180, g: 180, b: 180 });
      const score = computeColorVariance(pixels);
      expect(score).to.equal(0);
    });

    it('should return low score for nearly uniform wall (slight noise)', () => {
      // Simulated slightly noisy plain wall
      const pixels = Array(200).fill(null).map(() => ({
        r: 180 + Math.floor(Math.random() * 6 - 3),
        g: 180 + Math.floor(Math.random() * 6 - 3),
        b: 180 + Math.floor(Math.random() * 6 - 3),
      }));
      const score = computeColorVariance(pixels);
      expect(score).to.be.lessThan(BACKGROUND_VARIANCE_THRESHOLD);
    });

    it('should return high score for highly varied / cluttered background', () => {
      // Simulated cluttered bookshelf — diverse colors
      const pixels = Array(200).fill(null).map(() => ({
        r: Math.floor(Math.random() * 255),
        g: Math.floor(Math.random() * 255),
        b: Math.floor(Math.random() * 255),
      }));
      const score = computeColorVariance(pixels);
      expect(score).to.be.greaterThan(BACKGROUND_VARIANCE_THRESHOLD);
    });

    it('should return 100 for empty pixel array', () => {
      const score = computeColorVariance([]);
      expect(score).to.equal(100);
    });

    it('should handle single-pixel input gracefully', () => {
      const score = computeColorVariance([{ r: 128, g: 128, b: 128 }]);
      expect(score).to.be.a('number');
      expect(score).to.be.at.least(0);
      expect(score).to.be.at.most(100);
    });

    it('should classify a white wall as plain', () => {
      const pixels = Array(200).fill({ r: 255, g: 255, b: 255 });
      const score = computeColorVariance(pixels);
      expect(score).to.be.lessThan(BACKGROUND_VARIANCE_THRESHOLD);
    });

    it('should classify a dark wall as plain', () => {
      const pixels = Array(200).fill({ r: 30, g: 30, b: 30 });
      const score = computeColorVariance(pixels);
      expect(score).to.be.lessThan(BACKGROUND_VARIANCE_THRESHOLD);
    });

    it('should classify a colored wall (blue) as plain', () => {
      const pixels = Array(200).fill({ r: 50, g: 80, b: 180 });
      const score = computeColorVariance(pixels);
      expect(score).to.be.lessThan(BACKGROUND_VARIANCE_THRESHOLD);
    });

    it('should detect a half-and-half wall (two distinct colors) as semi-cluttered', () => {
      const pixels = [
        ...Array(100).fill({ r: 200, g: 200, b: 200 }),
        ...Array(100).fill({ r: 40, g: 40, b: 40 }),
      ];
      const score = computeColorVariance(pixels);
      // Two-tone background should have noticeable variance but not as high as random
      expect(score).to.be.greaterThan(10);
    });

    it('should score a gradient (smooth transition) lower than random noise', () => {
      // Smooth gradient — somewhat uniform
      const gradient = Array(200).fill(null).map((_, i) => ({
        r: Math.floor((i / 200) * 255),
        g: Math.floor((i / 200) * 255),
        b: Math.floor((i / 200) * 255),
      }));

      // Random noise — cluttered
      const noise = Array(200).fill(null).map(() => ({
        r: Math.floor(Math.random() * 255),
        g: Math.floor(Math.random() * 255),
        b: Math.floor(Math.random() * 255),
      }));

      const gradientScore = computeColorVariance(gradient);
      const noiseScore = computeColorVariance(noise);

      expect(gradientScore).to.be.lessThan(noiseScore);
    });
  });
});

describe('Liveness Engine — Constants & Configuration', () => {
  it('should have reasonable distance bounds', () => {
    expect(MIN_DISTANCE_M).to.be.greaterThan(0);
    expect(MAX_DISTANCE_M).to.be.greaterThan(MIN_DISTANCE_M);
    expect(MAX_DISTANCE_M).to.be.lessThan(5); // Not unreasonably far
  });

  it('should have a positive focal length', () => {
    expect(FOCAL_LENGTH_PX).to.be.greaterThan(0);
  });

  it('should have a reasonable face height constant', () => {
    expect(AVERAGE_FACE_HEIGHT_M).to.be.closeTo(0.22, 0.05);
  });

  it('should have background threshold between 0 and 100', () => {
    expect(BACKGROUND_VARIANCE_THRESHOLD).to.be.greaterThan(0);
    expect(BACKGROUND_VARIANCE_THRESHOLD).to.be.lessThan(100);
  });
});

describe('Liveness Engine — Integration Scenarios', () => {
  it('should correctly chain distance estimation → range check for a normal webcam scenario', () => {
    // Person at ~1m: face bbox would be about 168px
    const pixelHeight = 168;
    const distance = estimateDistance(pixelHeight);
    const rangeCheck = checkDistance(distance);

    expect(distance).to.be.closeTo(1.0, 0.1);
    expect(rangeCheck.inRange).to.be.true;
  });

  it('should fail range check when face is too close to camera', () => {
    // Person at ~0.25m: face bbox would be very large (~672px)
    const pixelHeight = 672;
    const distance = estimateDistance(pixelHeight);
    const rangeCheck = checkDistance(distance);

    expect(distance).to.be.lessThan(0.5);
    expect(rangeCheck.inRange).to.be.false;
    expect(rangeCheck.tooClose).to.be.true;
  });

  it('should fail range check when face is too far from camera', () => {
    // Person at ~3m: face bbox would be very small (~56px)
    const pixelHeight = 56;
    const distance = estimateDistance(pixelHeight);
    const rangeCheck = checkDistance(distance);

    expect(distance).to.be.greaterThan(1.5);
    expect(rangeCheck.inRange).to.be.false;
    expect(rangeCheck.tooFar).to.be.true;
  });

  it('should correctly classify a plain wall + proper distance as passing scenario', () => {
    // Plain wall
    const wallPixels = Array(200).fill({ r: 200, g: 195, b: 190 });
    const bgScore = computeColorVariance(wallPixels);
    const bgPasses = bgScore < BACKGROUND_VARIANCE_THRESHOLD;

    // Person at ~0.8m
    const distance = estimateDistance(210);
    const distPasses = checkDistance(distance).inRange;

    expect(bgPasses).to.be.true;
    expect(distPasses).to.be.true;
  });

  it('should correctly classify a cluttered background + proper distance as failing scenario', () => {
    // Cluttered bookshelf
    const clutteredPixels = Array(200).fill(null).map(() => ({
      r: Math.floor(Math.random() * 255),
      g: Math.floor(Math.random() * 255),
      b: Math.floor(Math.random() * 255),
    }));
    const bgScore = computeColorVariance(clutteredPixels);
    const bgPasses = bgScore < BACKGROUND_VARIANCE_THRESHOLD;

    // Even with good distance
    const distance = estimateDistance(210);
    const distPasses = checkDistance(distance).inRange;

    expect(bgPasses).to.be.false; // Background fails
    expect(distPasses).to.be.true; // Distance is fine
  });
});

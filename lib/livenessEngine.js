'use client';

/**
 * lib/livenessEngine.js
 * 
 * Client-side ML engine for liveness & environment verification.
 * All inference runs locally in the browser — no video frames leave the device.
 * 
 * Provides:
 * 1. Face detection with bounding box + distance estimation (pinhole camera model)
 * 2. Person detection via COCO-SSD for environment scanning
 * 3. Background uniformity analysis (plain wall/door check)
 */

// ─── Model Singletons ──────────────────────────────────────────────────────────
let cocoModel = null;
let faceDetector = null;
let modelsLoading = false;
let modelsLoaded = false;

// ─── Constants ──────────────────────────────────────────────────────────────────

// Average human face height in meters (forehead to chin)
const AVERAGE_FACE_HEIGHT_M = 0.22;

// Calibrated focal length constant for typical laptop/phone webcam
// at 640×480 resolution with ~60° horizontal FOV.
// This is derived from: focal_px = (known_pixel_height × known_distance) / real_height
// Calibrated: person at 0.7m → face bbox ~240px → focal = (240 * 0.7) / 0.22 ≈ 763
const FOCAL_LENGTH_PX = 763;

// Background uniformity threshold (0-100). Lower = more uniform.
// Scores below this are considered "plain wall/door".
const BACKGROUND_VARIANCE_THRESHOLD = 35;

// Minimum confidence for COCO-SSD person detection
const PERSON_CONFIDENCE_THRESHOLD = 0.5;

// Acceptable distance range in meters
export const MIN_DISTANCE_M = 0.5;
export const MAX_DISTANCE_M = 1.5;

// ─── Model Loading ──────────────────────────────────────────────────────────────

/**
 * Lazily loads TensorFlow.js + COCO-SSD + Face Detection models.
 * Returns a promise that resolves when all models are ready.
 * Subsequent calls return immediately if already loaded.
 */
export async function loadModels(onProgress) {
  if (modelsLoaded) return true;
  if (modelsLoading) {
    // Wait for the other loader to finish
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (modelsLoaded) {
          clearInterval(check);
          resolve(true);
        }
      }, 200);
    });
  }

  modelsLoading = true;

  try {
    onProgress?.('Loading TensorFlow.js runtime...');
    // Dynamic imports to avoid bundling these heavy libs at page load
    const tf = await import('@tensorflow/tfjs');
    await tf.ready();

    onProgress?.('Loading face detection model...');
    const faceDetection = await import('@tensorflow-models/face-detection');
    faceDetector = await faceDetection.createDetector(
      faceDetection.SupportedModels.MediaPipeFaceDetector,
      {
        runtime: 'tfjs',
        maxFaces: 5,
      }
    );

    onProgress?.('Loading object detection model...');
    const cocoSsd = await import('@tensorflow-models/coco-ssd');
    cocoModel = await cocoSsd.load({
      base: 'lite_mobilenet_v2', // Fastest variant for real-time browser use
    });

    modelsLoaded = true;
    modelsLoading = false;
    onProgress?.('All models loaded.');
    return true;
  } catch (err) {
    modelsLoading = false;
    console.error('[livenessEngine] Model loading failed:', err);
    throw new Error(`Failed to load ML models: ${err.message}`);
  }
}

/**
 * Returns whether models are loaded.
 */
export function areModelsLoaded() {
  return modelsLoaded;
}

// ─── Face Detection + Distance Estimation ───────────────────────────────────────

/**
 * Detects faces in the given video element.
 * Returns an array of face objects with bounding box and estimated distance.
 * 
 * @param {HTMLVideoElement} videoElement - The video element with the camera feed
 * @returns {Promise<Array<{box: {x,y,width,height}, distance: number, keypoints: Array}>>}
 */
export async function detectFaces(videoElement) {
  if (!faceDetector || !videoElement) return [];

  try {
    const faces = await faceDetector.estimateFaces(videoElement, {
      flipHorizontal: false,
    });

    return faces.map((face) => {
      const box = face.box;
      // Distance estimation using pinhole camera model
      // distance = (realHeight × focalLength) / pixelHeight
      const pixelHeight = box.height;
      const distance = pixelHeight > 0
        ? (AVERAGE_FACE_HEIGHT_M * FOCAL_LENGTH_PX) / pixelHeight
        : Infinity;

      return {
        box: {
          x: box.xMin,
          y: box.yMin,
          width: box.width,
          height: box.height,
        },
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        keypoints: face.keypoints || [],
      };
    });
  } catch (err) {
    console.error('[livenessEngine] Face detection error:', err);
    return [];
  }
}

/**
 * Checks whether the detected face is within the acceptable distance range.
 * @param {number} distance - Estimated distance in meters
 * @returns {{ inRange: boolean, tooClose: boolean, tooFar: boolean }}
 */
export function checkDistance(distance) {
  return {
    inRange: distance >= MIN_DISTANCE_M && distance <= MAX_DISTANCE_M,
    tooClose: distance < MIN_DISTANCE_M,
    tooFar: distance > MAX_DISTANCE_M,
  };
}

// ─── Person Detection (Environment Scan) ────────────────────────────────────────

/**
 * Detects all persons in the current video frame.
 * Used during the environment scan step.
 * 
 * @param {HTMLVideoElement} videoElement
 * @returns {Promise<Array<{bbox: number[], score: number}>>} Array of detected persons
 */
export async function detectPersons(videoElement) {
  if (!cocoModel || !videoElement) return [];

  try {
    const predictions = await cocoModel.detect(videoElement);
    return predictions
      .filter((p) => p.class === 'person' && p.score >= PERSON_CONFIDENCE_THRESHOLD)
      .map((p) => ({
        bbox: p.bbox, // [x, y, width, height]
        score: p.score,
      }));
  } catch (err) {
    console.error('[livenessEngine] Person detection error:', err);
    return [];
  }
}

// ─── Background Uniformity Analysis ─────────────────────────────────────────────

/**
 * Analyzes the background behind the user for uniformity.
 * A plain wall or door will have low color variance.
 * 
 * Strategy:
 * 1. Capture a frame from the video
 * 2. Detect face bounding box to identify the person region
 * 3. Analyze the peripheral regions (top, left, right) excluding the face area
 * 4. Compute color variance — low variance = plain background
 * 
 * @param {HTMLVideoElement} videoElement
 * @param {Object} faceBox - The detected face bounding box {x, y, width, height}
 * @returns {Promise<{score: number, isPlain: boolean, message: string}>}
 */
export async function analyzeBackground(videoElement, faceBox) {
  if (!videoElement) return { score: 100, isPlain: false, message: 'No video feed' };

  try {
    const canvas = document.createElement('canvas');
    const w = videoElement.videoWidth || 640;
    const h = videoElement.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, w, h);

    // Define background sampling regions (avoiding the face/body center)
    // We sample the edges and corners of the frame
    const regions = [];

    if (faceBox) {
      // Expand the person zone (face + estimated body below)
      const personLeft = Math.max(0, faceBox.x - faceBox.width * 0.5);
      const personRight = Math.min(w, faceBox.x + faceBox.width * 1.5);
      const personTop = Math.max(0, faceBox.y - faceBox.height * 0.3);

      // Sample left strip
      if (personLeft > 30) {
        regions.push({ x: 0, y: 0, w: Math.floor(personLeft), h });
      }
      // Sample right strip
      if (w - personRight > 30) {
        regions.push({ x: Math.floor(personRight), y: 0, w: Math.floor(w - personRight), h });
      }
      // Sample top strip (above face)
      if (personTop > 30) {
        regions.push({ x: 0, y: 0, w, h: Math.floor(personTop) });
      }
    } else {
      // No face detected — sample the outer 25% border of the frame
      const margin = Math.floor(w * 0.25);
      regions.push({ x: 0, y: 0, w: margin, h }); // left
      regions.push({ x: w - margin, y: 0, w: margin, h }); // right
      regions.push({ x: 0, y: 0, w, h: Math.floor(h * 0.2) }); // top
    }

    if (regions.length === 0) {
      return { score: 50, isPlain: false, message: 'Unable to isolate background region' };
    }

    // Collect pixel samples from background regions
    let allPixels = [];
    for (const region of regions) {
      if (region.w <= 0 || region.h <= 0) continue;
      const imageData = ctx.getImageData(region.x, region.y, region.w, region.h);
      const data = imageData.data;

      // Sample every 8th pixel for performance
      for (let i = 0; i < data.length; i += 32) {
        allPixels.push({
          r: data[i],
          g: data[i + 1],
          b: data[i + 2],
        });
      }
    }

    if (allPixels.length < 50) {
      return { score: 50, isPlain: false, message: 'Insufficient background data' };
    }

    // Compute color variance
    const score = computeColorVariance(allPixels);
    const isPlain = score < BACKGROUND_VARIANCE_THRESHOLD;

    let message;
    if (isPlain) {
      message = 'Plain background detected ✓';
    } else if (score < BACKGROUND_VARIANCE_THRESHOLD * 1.5) {
      message = 'Background is somewhat cluttered — try standing in front of a plain wall';
    } else {
      message = 'Background too cluttered — please stand in front of a plain wall or door';
    }

    return { score, isPlain, message };
  } catch (err) {
    console.error('[livenessEngine] Background analysis error:', err);
    return { score: 100, isPlain: false, message: 'Background analysis failed' };
  }
}

/**
 * Computes a color variance score (0-100) for a set of pixel samples.
 * Uses standard deviation of the grayscale values plus a hue diversity penalty.
 * Lower score = more uniform (plain wall).
 */
function computeColorVariance(pixels) {
  if (pixels.length === 0) return 100;

  // Convert to grayscale and compute stats
  const grays = pixels.map((p) => 0.299 * p.r + 0.587 * p.g + 0.114 * p.b);
  const mean = grays.reduce((a, b) => a + b, 0) / grays.length;
  const variance = grays.reduce((sum, g) => sum + (g - mean) ** 2, 0) / grays.length;
  const stdDev = Math.sqrt(variance);

  // Compute edge/gradient diversity by comparing adjacent samples
  let edgeSum = 0;
  const step = Math.max(1, Math.floor(pixels.length / 200));
  let edgeCount = 0;
  for (let i = step; i < grays.length; i += step) {
    edgeSum += Math.abs(grays[i] - grays[i - step]);
    edgeCount++;
  }
  const avgEdge = edgeCount > 0 ? edgeSum / edgeCount : 0;

  // Hue diversity: check how many distinct color "buckets" appear
  const hueBuckets = new Set();
  for (let i = 0; i < pixels.length; i += Math.max(1, Math.floor(pixels.length / 100))) {
    const p = pixels[i];
    const maxC = Math.max(p.r, p.g, p.b);
    const minC = Math.min(p.r, p.g, p.b);
    if (maxC - minC > 25) { // Only count saturated pixels
      const hueBucket = Math.floor(
        ((p.r > p.g ? (p.g - p.b) : (p.b - p.r)) / (maxC - minC + 1)) * 6 + 6
      ) % 6;
      hueBuckets.add(hueBucket);
    }
  }

  // Combine metrics into a final score (0-100)
  // stdDev contributes most, edge gradient and hue diversity add penalties
  const normalizedStdDev = Math.min(stdDev / 60, 1) * 50;
  const normalizedEdge = Math.min(avgEdge / 30, 1) * 30;
  const normalizedHue = Math.min(hueBuckets.size / 4, 1) * 20;

  return Math.round(normalizedStdDev + normalizedEdge + normalizedHue);
}

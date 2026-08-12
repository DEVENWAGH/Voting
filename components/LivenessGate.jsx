'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, CheckCircle2, AlertCircle, Loader2, Shield, ArrowLeft,
  ArrowRight, Eye, Ruler, ScanFace, RotateCcw, Maximize2,
  ChevronRight, Monitor, Users, Ban, Sparkles
} from 'lucide-react';

/**
 * LivenessGate — Multi-step local liveness & environment verification component.
 * 
 * Steps:
 * 1. Face Detection + Distance Check (0.5m – 1.5m)
 * 2. Background Analysis (plain wall/door)
 * 3. Environment Scan (pan left/right, no other person)
 * 4. Auto-Capture → calls onCapture(base64Image)
 * 
 * Props:
 * - onCapture(base64Image): Called when all checks pass and image is captured
 * - onCancel(): Called when user cancels
 * - className: Optional wrapper class
 */
export default function LivenessGate({ onCapture, onCancel, className = '' }) {
  // ─── State ──────────────────────────────────────────────────────────
  const [step, setStep] = useState(0); // 0=loading, 1=face+dist, 2=background, 3=envScan, 4=capture
  const [modelStatus, setModelStatus] = useState('Loading ML models...');
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Face + Distance
  const [faceDetected, setFaceDetected] = useState(false);
  const [distanceM, setDistanceM] = useState(null);
  const [distanceOk, setDistanceOk] = useState(false);
  const [faceBox, setFaceBox] = useState(null);
  const [step1Passed, setStep1Passed] = useState(false);
  const step1HoldRef = useRef(0); // Frames where face+distance are both OK

  // Step 2: Background
  const [bgScore, setBgScore] = useState(null);
  const [bgIsPlain, setBgIsPlain] = useState(false);
  const [bgMessage, setBgMessage] = useState('');
  const [step2Passed, setStep2Passed] = useState(false);

  // Step 3: Environment Scan
  const [scanDirection, setScanDirection] = useState('left'); // 'left' | 'right'
  const [scanProgress, setScanProgress] = useState(0); // 0-100
  const [personFound, setPersonFound] = useState(false);
  const [leftScanDone, setLeftScanDone] = useState(false);
  const [rightScanDone, setRightScanDone] = useState(false);
  const [step3Passed, setStep3Passed] = useState(false);
  const scanFrameCountRef = useRef(0);
  const scanCleanFramesRef = useRef(0);
  const SCAN_REQUIRED_FRAMES = 30; // ~1 second at 30fps

  // Step 4: Capture countdown
  const [countdown, setCountdown] = useState(-1);
  const [capturing, setCapturing] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const engineRef = useRef(null);

  // ─── Load Models ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const engine = await import('@/lib/livenessEngine');
        engineRef.current = engine;
        await engine.loadModels((msg) => {
          if (!cancelled) setModelStatus(msg);
        });
        if (!cancelled) {
          setModelsReady(true);
          setStep(1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Model loading failed: ${err.message}. Please refresh and try again.`);
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // ─── Camera Start/Stop ──────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setError('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch {
      setError('Camera access denied. Please grant camera permissions and try again.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setCameraActive(false);
  }, []);

  // Auto-start camera when models are ready
  useEffect(() => {
    if (modelsReady && !cameraActive) {
      startCamera();
    }
  }, [modelsReady, cameraActive, startCamera]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  // ─── Main Detection Loop ───────────────────────────────────────────
  useEffect(() => {
    if (!cameraActive || !modelsReady || !engineRef.current) return;

    let active = true;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');

    let frameCount = 0;

    const runLoop = async () => {
      if (!active) return;
      frameCount++;

      // Draw video
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const engine = engineRef.current;

      // ── Step 1: Face + Distance ──
      if (step === 1 && !step1Passed) {
        // Run face detection every 3rd frame for performance
        if (frameCount % 3 === 0) {
          const faces = await engine.detectFaces(video);
          if (faces.length === 1) {
            const face = faces[0];
            setFaceDetected(true);
            setFaceBox(face.box);
            setDistanceM(face.distance);

            const distCheck = engine.checkDistance(face.distance);
            setDistanceOk(distCheck.inRange);

            if (distCheck.inRange) {
              step1HoldRef.current += 1;
              if (step1HoldRef.current >= 10) {
                // Held for ~1s at good distance
                setStep1Passed(true);
                setStep(2);
              }
            } else {
              step1HoldRef.current = 0;
            }

            // Draw face bounding box
            drawFaceBox(ctx, face.box, distCheck.inRange);
          } else if (faces.length > 1) {
            setFaceDetected(true);
            setDistanceOk(false);
            step1HoldRef.current = 0;
            // Draw all face boxes in red
            faces.forEach((f) => drawFaceBox(ctx, f.box, false));
          } else {
            setFaceDetected(false);
            setFaceBox(null);
            setDistanceM(null);
            setDistanceOk(false);
            step1HoldRef.current = 0;
          }
        } else if (faceBox) {
          // Redraw last known face box on non-detection frames
          drawFaceBox(ctx, faceBox, distanceOk);
        }
      }

      // ── Step 2: Background Analysis ──
      if (step === 2 && !step2Passed) {
        if (frameCount % 15 === 0) {
          const bgResult = await engine.analyzeBackground(video, faceBox);
          setBgScore(bgResult.score);
          setBgIsPlain(bgResult.isPlain);
          setBgMessage(bgResult.message);

          if (bgResult.isPlain) {
            setStep2Passed(true);
            setStep(3);
          }
        }

        // Draw face guide overlay
        if (faceBox) drawFaceBox(ctx, faceBox, true);
      }

      // ── Step 3: Environment Scan ──
      if (step === 3 && !step3Passed) {
        if (frameCount % 3 === 0) {
          const persons = await engine.detectPersons(video);
          scanFrameCountRef.current += 1;

          // During scan, we expect the primary user's face might be detected
          // We consider the environment "clear" if there are 0 or 1 persons (the user themselves)
          if (persons.length <= 1) {
            scanCleanFramesRef.current += 1;
          } else {
            // Multiple persons detected — another person is nearby
            setPersonFound(true);
            scanCleanFramesRef.current = 0;
            scanFrameCountRef.current = 0;

            // Draw bounding boxes for detected persons
            persons.forEach((p) => {
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 2;
              ctx.strokeRect(p.bbox[0], p.bbox[1], p.bbox[2], p.bbox[3]);
              ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
              ctx.fillRect(p.bbox[0], p.bbox[1], p.bbox[2], p.bbox[3]);
            });
          }

          const progress = Math.min(
            (scanCleanFramesRef.current / SCAN_REQUIRED_FRAMES) * 100,
            100
          );
          setScanProgress(progress);

          if (scanCleanFramesRef.current >= SCAN_REQUIRED_FRAMES) {
            if (scanDirection === 'left' && !leftScanDone) {
              setLeftScanDone(true);
              setScanDirection('right');
              scanFrameCountRef.current = 0;
              scanCleanFramesRef.current = 0;
              setScanProgress(0);
              setPersonFound(false);
            } else if (scanDirection === 'right' && !rightScanDone) {
              setRightScanDone(true);
              setStep3Passed(true);
              setStep(4);
            }
          }
        }
      }

      // ── Step 4: Auto-Capture ──
      if (step === 4 && !capturing) {
        // Draw success overlay then trigger countdown
        if (faceBox) drawFaceBox(ctx, faceBox, true);
      }

      animFrameRef.current = requestAnimationFrame(runLoop);
    };

    runLoop();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive, modelsReady, step, step1Passed, step2Passed, step3Passed, scanDirection, leftScanDone, rightScanDone, capturing]);

  // ─── Auto-start countdown when step 4 is reached ───────────────────
  useEffect(() => {
    if (step === 4 && !capturing && countdown === -1) {
      setCountdown(3);
      const iv = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(iv);
            doCapture();
            return -1;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(iv);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ─── Capture Final Image ───────────────────────────────────────────
  const doCapture = useCallback(() => {
    setCapturing(true);
    const video = videoRef.current;
    if (!video) return;

    const tmp = document.createElement('canvas');
    tmp.width = video.videoWidth || 640;
    tmp.height = video.videoHeight || 480;
    tmp.getContext('2d').drawImage(video, 0, 0, tmp.width, tmp.height);
    const base64 = tmp.toDataURL('image/jpeg', 0.85);

    stopCamera();
    onCapture?.(base64);
  }, [onCapture, stopCamera]);

  // ─── Reset ─────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    setStep(1);
    setFaceDetected(false);
    setDistanceM(null);
    setDistanceOk(false);
    setFaceBox(null);
    setStep1Passed(false);
    step1HoldRef.current = 0;
    setBgScore(null);
    setBgIsPlain(false);
    setBgMessage('');
    setStep2Passed(false);
    setScanDirection('left');
    setScanProgress(0);
    setPersonFound(false);
    setLeftScanDone(false);
    setRightScanDone(false);
    setStep3Passed(false);
    scanFrameCountRef.current = 0;
    scanCleanFramesRef.current = 0;
    setCountdown(-1);
    setCapturing(false);
    setError('');
    startCamera();
  }, [startCamera]);

  // ─── Draw Helpers ──────────────────────────────────────────────────
  function drawFaceBox(ctx, box, isGood) {
    if (!box) return;
    const color = isGood ? '#10b981' : '#6366f1';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    ctx.shadowBlur = 0;

    // Corner accents
    const cornerLen = 15;
    ctx.lineWidth = 3;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + cornerLen); ctx.lineTo(box.x, box.y); ctx.lineTo(box.x + cornerLen, box.y);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(box.x + box.width - cornerLen, box.y); ctx.lineTo(box.x + box.width, box.y); ctx.lineTo(box.x + box.width, box.y + cornerLen);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + box.height - cornerLen); ctx.lineTo(box.x, box.y + box.height); ctx.lineTo(box.x + cornerLen, box.y + box.height);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(box.x + box.width - cornerLen, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height); ctx.lineTo(box.x + box.width, box.y + box.height - cornerLen);
    ctx.stroke();

    ctx.lineWidth = 1;
  }

  // ─── Step Info ─────────────────────────────────────────────────────
  const steps = [
    { id: 1, label: 'Face & Distance', icon: Ruler, done: step1Passed },
    { id: 2, label: 'Background', icon: Monitor, done: step2Passed },
    { id: 3, label: 'Environment', icon: Users, done: step3Passed },
    { id: 4, label: 'Capture', icon: Camera, done: capturing },
  ];

  const distanceLabel = distanceM != null
    ? `${distanceM.toFixed(2)}m`
    : '—';

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Step Progress Bar */}
      <div className="flex items-center gap-1 px-1">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-300 w-full justify-center ${
              s.done
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : step === s.id
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                  : 'bg-slate-900/60 text-slate-600 border border-slate-800'
            }`}>
              {s.done ? (
                <CheckCircle2 size={11} className="text-emerald-400" />
              ) : (
                <s.icon size={11} />
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight size={12} className="text-slate-700 shrink-0 mx-0.5" />
            )}
          </div>
        ))}
      </div>

      {/* Camera Viewport */}
      <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
        <video ref={videoRef} className="hidden" playsInline muted width={640} height={480} />
        <canvas ref={canvasRef} width={640} height={480} className="w-full h-full object-cover" />

        {/* Model Loading Overlay */}
        {!modelsReady && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center gap-3 z-20">
            <div className="relative">
              <Loader2 size={36} className="text-indigo-400 animate-spin" />
              <Sparkles size={14} className="text-indigo-300 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <p className="text-slate-300 text-xs font-semibold">{modelStatus}</p>
            <p className="text-slate-600 text-[10px]">This may take a moment on first load</p>
          </div>
        )}

        {/* Camera Off Overlay */}
        {modelsReady && !cameraActive && !capturing && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 z-20">
            <Camera size={40} className="text-indigo-400 opacity-60" />
            <p className="text-slate-400 text-sm font-semibold">Camera not started</p>
            <button
              onClick={startCamera}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Start Camera
            </button>
          </div>
        )}

        {/* Countdown Overlay */}
        {countdown > 0 && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-30">
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-7xl font-black text-white"
            >
              {countdown}
            </motion.div>
          </div>
        )}

        {/* Capturing Flash */}
        {capturing && (
          <div className="absolute inset-0 bg-white/20 flex flex-col items-center justify-center backdrop-blur-sm z-30">
            <CheckCircle2 size={48} className="text-emerald-400 mb-2" />
            <p className="text-white font-bold text-sm">All checks passed!</p>
            <p className="text-white/60 text-xs">Submitting to verification...</p>
          </div>
        )}

        {/* Live HUD Overlay */}
        {cameraActive && !capturing && (
          <>
            {/* Step 1: Distance Meter */}
            {step === 1 && (
              <div className="absolute top-3 left-3 right-3 flex justify-between items-start z-10">
                <div className={`px-3 py-1.5 rounded-lg text-[11px] font-bold backdrop-blur-md border ${
                  faceDetected
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                    : 'bg-red-950/60 border-red-500/40 text-red-400'
                }`}>
                  <Eye size={11} className="inline mr-1" />
                  {faceDetected ? 'Face Detected' : 'Looking for face...'}
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-[11px] font-bold backdrop-blur-md border ${
                  distanceOk
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                    : 'bg-slate-950/60 border-slate-700 text-slate-300'
                }`}>
                  <Ruler size={11} className="inline mr-1" />
                  {distanceLabel}
                  {distanceM != null && (
                    <span className="ml-1 text-[9px]">
                      {distanceOk ? '✓' : distanceM < 0.5 ? '(move back)' : '(move closer)'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Step 1: Distance Range Bar */}
            {step === 1 && distanceM != null && (
              <div className="absolute bottom-14 left-4 right-4 z-10">
                <div className="bg-slate-950/80 backdrop-blur-md rounded-xl p-2.5 border border-slate-800">
                  <div className="flex justify-between text-[9px] text-slate-500 font-bold mb-1 px-1">
                    <span>0.5m</span>
                    <span className="text-indigo-400">Optimal Range</span>
                    <span>1.5m</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden relative">
                    {/* Green zone */}
                    <div className="absolute inset-y-0 bg-emerald-500/20 rounded-full"
                      style={{ left: '0%', right: '0%' }}
                    />
                    {/* Marker */}
                    <motion.div
                      className={`absolute top-0 h-full w-2 rounded-full ${distanceOk ? 'bg-emerald-400' : 'bg-indigo-400'}`}
                      animate={{
                        left: `${Math.min(Math.max(((distanceM - 0.2) / 1.8) * 100, 0), 100)}%`,
                      }}
                      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Background status */}
            {step === 2 && (
              <div className="absolute top-3 left-3 right-3 z-10">
                <div className={`px-3 py-2 rounded-lg text-[11px] font-bold backdrop-blur-md border flex items-center gap-2 ${
                  bgIsPlain
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-950/60 border-amber-500/40 text-amber-400'
                }`}>
                  <Monitor size={12} />
                  {bgMessage || 'Analyzing background...'}
                  {bgScore != null && (
                    <span className="ml-auto text-[9px] opacity-70">Score: {bgScore}/100</span>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Environment Scan Direction */}
            {step === 3 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="flex flex-col items-center gap-3">
                  {personFound && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-950/80 border border-red-500/50 text-red-400 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 backdrop-blur-md"
                    >
                      <Ban size={14} />
                      Person detected nearby! Please ensure no one is near you.
                    </motion.div>
                  )}

                  <motion.div
                    key={scanDirection}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-950/80 backdrop-blur-md border border-indigo-500/40 rounded-2xl px-6 py-4 flex flex-col items-center gap-2"
                  >
                    <motion.div
                      animate={{ x: scanDirection === 'left' ? [-5, -20, -5] : [5, 20, 5] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      {scanDirection === 'left' ? (
                        <ArrowLeft size={32} className="text-indigo-400" />
                      ) : (
                        <ArrowRight size={32} className="text-indigo-400" />
                      )}
                    </motion.div>
                    <p className="text-white text-sm font-bold">
                      Pan camera to the {scanDirection.toUpperCase()}
                    </p>
                    <p className="text-slate-400 text-[10px]">
                      Verifying no person is nearby
                    </p>

                    {/* Scan progress */}
                    <div className="w-40 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                      <motion.div
                        className="h-full bg-indigo-500 rounded-full"
                        animate={{ width: `${scanProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </motion.div>

                  {/* Scan checkmarks */}
                  <div className="flex gap-3 mt-1">
                    <div className={`flex items-center gap-1 text-[10px] font-bold ${
                      leftScanDone ? 'text-emerald-400' : scanDirection === 'left' ? 'text-indigo-400' : 'text-slate-600'
                    }`}>
                      {leftScanDone ? <CheckCircle2 size={10} /> : <ArrowLeft size={10} />}
                      Left
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] font-bold ${
                      rightScanDone ? 'text-emerald-400' : scanDirection === 'right' ? 'text-indigo-400' : 'text-slate-600'
                    }`}>
                      {rightScanDone ? <CheckCircle2 size={10} /> : <ArrowRight size={10} />}
                      Right
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Status Bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-4 py-2 flex items-center justify-between z-10">
              <p className="text-white/80 text-[10px] font-semibold flex items-center gap-1.5">
                <Shield size={10} className="text-indigo-400" />
                {step === 1 && 'Position your face within 0.5-1.5m of camera'}
                {step === 2 && 'Checking background — stand in front of a plain wall'}
                {step === 3 && `Scan your surroundings — pan ${scanDirection}`}
                {step === 4 && 'All checks passed — capturing...'}
              </p>
              <span className="text-[9px] text-slate-500 font-bold">
                Step {step}/4
              </span>
            </div>
          </>
        )}
      </div>

      {/* Step Detail Cards */}
      <AnimatePresence mode="wait">
        {step >= 1 && !capturing && (
          <motion.div
            key={`step-info-${step}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-sm"
          >
            {step === 1 && (
              <div className="space-y-3">
                <h4 className="text-white font-bold text-sm flex items-center gap-2">
                  <Ruler size={14} className="text-indigo-400" />
                  Step 1: Face & Distance Verification
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Position yourself <strong className="text-white">0.5 to 1.5 meters</strong> from the camera.
                  Keep your face centered and hold steady for 1 second.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <StatusPill label="Face Detected" ok={faceDetected} />
                  <StatusPill label={`Distance ${distanceLabel}`} ok={distanceOk} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <h4 className="text-white font-bold text-sm flex items-center gap-2">
                  <Monitor size={14} className="text-indigo-400" />
                  Step 2: Background Verification
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Please stand in front of a <strong className="text-white">plain wall or door</strong>.
                  Avoid cluttered backgrounds, posters, or busy areas.
                </p>
                <StatusPill label={bgMessage || 'Analyzing...'} ok={bgIsPlain} />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <h4 className="text-white font-bold text-sm flex items-center gap-2">
                  <Users size={14} className="text-indigo-400" />
                  Step 3: Environment Verification
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Slowly pan your camera <strong className="text-white">left and right</strong> to verify
                  no other person is near you. This ensures voting privacy.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <StatusPill label="Left Scan" ok={leftScanDone} />
                  <StatusPill label="Right Scan" ok={rightScanDone} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <h4 className="text-white font-bold text-sm flex items-center gap-2">
                  <Camera size={14} className="text-emerald-400" />
                  Step 4: Auto-Capture
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  All verification checks passed! Your face will be captured automatically
                  and sent for biometric verification.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <StatusPill label="Face ✓" ok />
                  <StatusPill label="Background ✓" ok />
                  <StatusPill label="Environment ✓" ok />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      {error && (
        <div className="bg-red-950/30 border border-red-700/50 text-red-300 rounded-xl p-3 text-xs flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={resetAll}
          className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <RotateCcw size={12} />
          Restart Checks
        </button>
        {onCancel && (
          <button
            onClick={() => { stopCamera(); onCancel(); }}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Privacy Notice */}
      <div className="flex gap-1.5 items-start text-[10px] text-slate-600 px-1">
        <Shield size={12} className="text-indigo-400/60 shrink-0 mt-0.5" />
        <p>
          <strong>Privacy:</strong> All liveness and environment checks run locally in your browser.
          No video is transmitted until the final capture for AWS Rekognition verification.
        </p>
      </div>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────────

function StatusPill({ label, ok }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] font-semibold transition-all ${
      ok
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        : 'bg-slate-900/60 border-slate-800 text-slate-500'
    }`}>
      {ok ? <CheckCircle2 size={10} className="text-emerald-400" /> : <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />}
      <span className="truncate">{label}</span>
    </div>
  );
}

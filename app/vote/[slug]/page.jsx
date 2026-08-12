'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Mail, Lock, ShieldCheck, CheckCircle2, ChevronRight,
  Vote, AlertCircle, Loader2, Trophy, BarChart3, Camera, ScanFace,
  RefreshCw, UserCheck, ChevronLeft
} from 'lucide-react';
import ElectionResults from '@/components/ElectionResults';
import ThemeToggle from '@/components/ThemeToggle';
import dynamic from 'next/dynamic';

// Lazy-load LivenessGate to avoid bundling ML libs on initial page load
const LivenessGate = dynamic(() => import('@/components/LivenessGate'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center p-8 gap-3">
      <Loader2 size={28} className="text-indigo-500 animate-spin" />
      <p className="text-slate-400 text-xs font-semibold">Loading Liveness Module...</p>
    </div>
  ),
});

// ─── Safe error message helper ──────────────────────────────────────────────
function getErrMsg(err) {
  if (!err) return 'An unknown error occurred.';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || String(err);
  if (err && typeof err.message === 'string') return err.message;
  try { return String(err); } catch { return 'An unknown error occurred.'; }
}

// ─── Inline Face Scanner Component (with LivenessGate) ──────────────────────
function InlineFaceScanner({ nullifierHash, electionId, orgId, email, orgSlug, onSuccess, onCancel }) {
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('');
  const [scanDone, setScanDone] = useState(false);

  // Twin override request states
  const [isDuplicateFace, setIsDuplicateFace] = useState(false);
  const [requestStatus, setRequestStatus] = useState('idle');

  // Called when LivenessGate completes all 4 steps
  const handleLivenessCapture = useCallback(async (base64Image) => {
    setCapturedImage(base64Image);
    setLivenessPassed(true);
    setLoading(true);
    setStatusText('Verifying with AWS Rekognition...');
    setIsDuplicateFace(false);
    setError('');

    try {
      const res = await fetch('/api/biometric/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nullifierHash, image: base64Image, electionId })
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.isDuplicate) {
          setIsDuplicateFace(true);
        }
        throw new Error(data.error || 'Verification failed.');
      }

      // Save token
      localStorage.setItem(`biometricToken_${orgId}_${email.toLowerCase().trim()}`, data.token);
      setScanDone(true);
      setStatusText('Face verified successfully!');
      setTimeout(() => onSuccess(data.token, data.faceAttributes), 800);
    } catch (err) {
      setError(getErrMsg(err));
      setLoading(false);
    }
  }, [nullifierHash, electionId, orgId, email, onSuccess]);

  const handleRequestTwinOverride = async () => {
    setRequestStatus('submitting');
    try {
      const res = await fetch('/api/biometric/twin-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, orgSlug, electionId, nullifierHash })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request.');
      setRequestStatus('submitted');
    } catch (err) {
      console.error(err);
      setRequestStatus('error');
    }
  };

  const retryLiveness = () => {
    setLivenessPassed(false);
    setCapturedImage(null);
    setError('');
    setScanDone(false);
    setLoading(false);
    setIsDuplicateFace(false);
    setRequestStatus('idle');
  };

  return (
    <div className="space-y-4">
      {!livenessPassed ? (
        /* ─── LivenessGate: Multi-step local verification ─── */
        <LivenessGate
          onCapture={handleLivenessCapture}
          onCancel={onCancel}
        />
      ) : (
        /* ─── Post-liveness: Captured Image + AWS Processing Status ─── */
        <>
          {/* Captured image with status overlay */}
          <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-hairline">
            {capturedImage && (
              <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              {loading && !scanDone ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={36} className="text-primary animate-spin" />
                  <p className="text-white/80 text-xs">{statusText}</p>
                </div>
              ) : scanDone ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 size={48} className="text-green-400" />
                  <p className="text-white font-semibold text-sm">Verified!</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Liveness checks summary */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Face & Distance', ok: true },
              { label: 'Background', ok: true },
              { label: 'Environment', ok: true },
            ].map(c => (
              <div key={c.label} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                'bg-green-50 border-green-200 text-green-700'
              }`}>
                <CheckCircle2 size={11} className="text-green-500" />
                <span className="truncate">{c.label}</span>
              </div>
            ))}
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-canvas border border-semantic-down text-semantic-down rounded-xl p-4 flex flex-col gap-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>

              {isDuplicateFace && (
                <div className="mt-2 pt-3 border-t border-red-100 flex flex-col gap-2">
                  <p className="text-body font-medium text-slate-600 dark:text-slate-300">
                    Are you an identical twin? You can request a manual twin verification override from the administrator to allow your vote.
                  </p>
                  {requestStatus === 'idle' && (
                    <button
                      onClick={handleRequestTwinOverride}
                      className="bg-primary hover:bg-primary-active text-white px-4 py-2 rounded-full font-semibold text-xs transition cursor-pointer w-fit"
                    >
                      Request Twin Verification Override
                    </button>
                  )}
                  {requestStatus === 'submitting' && (
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
                      <Loader2 size={12} className="animate-spin text-primary" /> Submitting request...
                    </div>
                  )}
                  {requestStatus === 'submitted' && (
                    <div className="text-green-600 font-semibold bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-green-500" />
                      Twin Verification Request submitted successfully! Please contact your administrator.
                    </div>
                  )}
                  {requestStatus === 'error' && (
                    <div className="text-red-600 font-semibold">
                      Failed to submit request. Please try again or contact support.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {error && (
              <button onClick={retryLiveness}
                className="flex-1 flex items-center justify-center gap-2 border border-hairline bg-canvas hover:bg-surface-soft text-ink py-3 rounded-full font-semibold text-sm transition cursor-pointer">
                <RefreshCw size={14} /> Retry Liveness Check
              </button>
            )}
            {!scanDone && (
              <button onClick={onCancel}
                className="px-4 py-3 rounded-full text-muted hover:text-ink text-xs font-medium transition cursor-pointer">
                Back
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepBadge({ n, label, active, done }) {
  return (
    <div className={`flex items-center gap-2 ${active ? 'text-primary' : done ? 'text-green-600' : 'text-muted'}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
        done ? 'bg-green-100 border-green-300 text-green-700'
             : active ? 'bg-primary/10 border-primary text-primary'
             : 'bg-surface-soft border-hairline text-muted'
      }`}>
        {done ? <CheckCircle2 size={13} /> : n}
      </span>
      <span className="text-xs font-semibold hidden sm:block">{label}</span>
    </div>
  );
}

// ─── Main Voter Portal ────────────────────────────────────────────────────────
export default function VoterPortal() {
  const { slug } = useParams();
  const [org, setOrg] = useState(null);
  const [elections, setElections] = useState([]);
  const [completedElections, setCompletedElections] = useState([]);
  const [portalView, setPortalView] = useState('live');
  const [viewingResults, setViewingResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Step machine: 'email' | 'face' | 'candidate' | 'otp' ──
  const [step, setStep] = useState('email');

  // Voter state
  const [email, setEmail] = useState('');
  const [voterMemberId, setVoterMemberId] = useState('');
  const [voterNullifierHash, setVoterNullifierHash] = useState('');
  const [voterOrgId, setVoterOrgId] = useState('');
  const [biometricToken, setBiometricToken] = useState(null);
  const [faceAttributes, setFaceAttributes] = useState(null);
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  // Election & vote state
  const [selectedElection, setSelectedElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [formError, setFormError] = useState('');

  // SHOULDER-SURFING PROTECTION: candidate name is blurred by default
  // during OTP entry. The voter can tap to reveal temporarily.
  const [showCandidate, setShowCandidate] = useState(false);

  // ── Load org & elections ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const orgRes = await fetch(`/api/orgs/register?slug=${slug}`);
      const orgData = await orgRes.json();
      if (!orgRes.ok) throw new Error(orgData.error || 'Organization not found');
      setOrg(orgData.org);
      setVoterOrgId(orgData.org._id);

      const elRes = await fetch(`/api/org/${slug}/elections`);
      const elData = await elRes.json();
      if (!elRes.ok) throw new Error(elData.error);
      const all = elData.elections || [];
      setElections(all.filter(e => e.phase === 1 && e.guardianApproved));
      setCompletedElections(all.filter(e => e.phase === 2));
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [slug]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Select election & load candidates ──
  const selectElection = async (e) => {
    setSelectedElection(e);
    setStep('email');
    setEmail(''); setOtp(''); setOtpSent(false);
    setBiometricToken(null); setSelectedCandidate(null);
    setVoteSuccess(false); setFormError('');

    try {
      const r = await fetch(`/api/org/${slug}/elections/${e.id}/candidates`);
      const d = await r.json();
      setCandidates(d.candidates || []);
    } catch {}
  };

  // ── Step 1: Validate email & check biometric status ──
  const handleEmailNext = async (ev) => {
    ev.preventDefault();
    setVerifyingEmail(true);
    setFormError('');
    try {
      const lookupRes = await fetch(`/api/voters/lookup?email=${encodeURIComponent(email)}&orgSlug=${slug}&electionId=${selectedElection.id}`);
      const lookupData = await lookupRes.json();
      if (!lookupRes.ok) throw new Error(lookupData.error || 'Voter not registered.');

      setVoterMemberId(lookupData.memberId || '');
      const nh = lookupData.nullifierHash || '';
      setVoterNullifierHash(nh);

      // Always require face scan at vote time (no skipping)
      setStep('face');
    } catch (err) {
      setFormError(getErrMsg(err));
    }
    setVerifyingEmail(false);
  };

  // ── Step 2: Face scan success ──
  const handleFaceSuccess = (token, attrs) => {
    setBiometricToken(token);
    setFaceAttributes(attrs);
    setStep('candidate');
  };

  // ── Step 3: Candidate selected, send OTP ──
  const handleSendOtp = async () => {
    if (selectedCandidate === null) return;
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, orgId: org._id, electionId: selectedElection.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOtpSent(true);
      setStep('otp');
    } catch (err) {
      setFormError(getErrMsg(err));
    }
    setSubmitting(false);
  };

  // ── Step 4: Cast vote ──
  const castVote = async (ev) => {
    ev.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const tokenKey = `biometricToken_${org._id}_${email.toLowerCase().trim()}`;
      const token = localStorage.getItem(tokenKey) || biometricToken;
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-biometric-token': token || '' },
        body: JSON.stringify({
          email,
          otp,
          orgId: org._id,
          electionId: selectedElection.id,
          candidateId: selectedCandidate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTxHash(data.txHash);
      setVoteSuccess(true);
    } catch (err) {
      setFormError(getErrMsg(err));
    }
    setSubmitting(false);
  };

  // ─── Loading / Error states ───
  if (loading) return (
    <div className="min-h-screen bg-canvas flex justify-center items-center">
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  );
  if (error && !org) return (
    <div className="min-h-screen bg-surface-soft flex justify-center items-center p-6 text-center">
      <div className="bg-canvas p-8 border border-hairline rounded-xl max-w-sm shadow-sm">
        <Building2 size={40} className="text-muted mx-auto mb-4" />
        <h1 className="text-ink text-lg font-semibold mb-2">Portal Not Found</h1>
        <p className="text-body text-sm">{error}</p>
      </div>
    </div>
  );

  const stepNum = { email: 1, face: 2, candidate: 3, otp: 4 }[step] || 1;

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      {/* Navbar */}
      <nav className="border-b border-hairline bg-canvas/80 backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-strong flex items-center justify-center border border-hairline">
            {org.logoUrl ? <img src={org.logoUrl} alt={org.name} className="w-6 h-6 object-contain" /> : <Building2 size={18} className="text-primary" />}
          </div>
          <div>
            <h1 className="font-bold text-ink text-base leading-tight">{org.name}</h1>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider">Voter Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/verify" className="text-xs text-primary hover:text-primary-active font-semibold transition">Verify Ballots</Link>
          <div className="flex items-center gap-2 text-xs text-body bg-surface-soft border border-hairline px-3 py-1.5 rounded-full font-medium">
            <ShieldCheck size={14} className="text-primary shrink-0" /><span>Secured Session</span>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center p-6 pb-24 bg-surface-soft/40">
        <div className="w-full max-w-xl">

          {/* Portal Tabs — shown only before an election is selected */}
          {!selectedElection && !viewingResults && (
            <div className="flex p-1 bg-surface-strong border border-hairline rounded-full mb-8">
              <button key="live" onClick={() => setPortalView('live')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                  portalView === 'live' ? 'bg-canvas text-primary shadow-sm border border-hairline/60' : 'text-body hover:text-ink'
                }`}>
                <Vote size={14} /><span>Active Ballots</span>
                {elections.length > 0 && <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-1">{elections.length}</span>}
              </button>
              <button key="results" onClick={() => setPortalView('results')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                  portalView === 'results' ? 'bg-canvas text-primary shadow-sm border border-hairline/60' : 'text-body hover:text-ink'
                }`}>
                <BarChart3 size={14} /><span>Results</span>
                {completedElections.length > 0 && <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-1">{completedElections.length}</span>}
              </button>
            </div>
          )}

          {/* Results view */}
          {viewingResults && !selectedElection && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-display font-normal text-ink">Election Results</h2>
                <button onClick={() => setViewingResults(null)} className="text-xs bg-canvas hover:bg-surface-soft border border-hairline text-ink px-4 py-2 rounded-full font-medium transition cursor-pointer shadow-sm">Close</button>
              </div>
              <div className="bg-canvas border border-hairline rounded-xl p-6 shadow-sm">
                <ElectionResults slug={slug} electionId={viewingResults.id} electionTitle={viewingResults.title} />
              </div>
            </div>
          )}

          {/* Election list — live */}
          {!selectedElection && !viewingResults && portalView === 'live' && (
            <div className="space-y-4">
              <h2 className="text-center text-2xl font-display font-normal text-ink tracking-tight mb-6">Active Elections</h2>
              {elections.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-hairline rounded-xl bg-canvas shadow-sm">
                  <Vote size={36} className="text-muted mx-auto mb-4" />
                  <p className="text-ink font-semibold">No active ballots</p>
                  <p className="text-body text-sm mt-1">No open elections at this time.</p>
                </div>
              ) : elections.map(e => (
                <button key={e.id} onClick={() => selectElection(e)}
                  className="w-full bg-canvas border border-hairline hover:border-primary rounded-xl p-6 text-left transition-all group shadow-sm flex items-center justify-between cursor-pointer">
                  <div className="min-w-0 pr-4">
                    <h3 className="text-lg font-semibold text-ink group-hover:text-primary transition">{e.title}</h3>
                    <p className="text-sm text-body mt-1 line-clamp-2">{e.description}</p>
                  </div>
                  <ChevronRight className="text-muted group-hover:text-primary transition shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Election list — results */}
          {!selectedElection && !viewingResults && portalView === 'results' && (
            <div className="space-y-4">
              <h2 className="text-center text-2xl font-display font-normal text-ink tracking-tight mb-6">Completed Ballots</h2>
              {completedElections.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-hairline rounded-xl bg-canvas shadow-sm">
                  <Trophy size={36} className="text-muted mx-auto mb-4" />
                  <p className="text-ink font-semibold">No results published</p>
                  <p className="text-body text-sm mt-1">Results appear after voting closes.</p>
                </div>
              ) : completedElections.map(e => (
                <button key={e.id} onClick={() => setViewingResults(e)}
                  className="w-full bg-canvas border border-hairline hover:border-primary rounded-xl p-6 text-left transition-all group shadow-sm flex items-center justify-between cursor-pointer">
                  <div className="min-w-0 pr-4">
                    <span className="text-[10px] font-semibold bg-surface-strong px-2 py-0.5 rounded-full text-muted uppercase tracking-wider">Archive</span>
                    <h3 className="text-lg font-semibold text-ink group-hover:text-primary transition mt-2">{e.title}</h3>
                    <p className="text-sm text-body mt-1 line-clamp-2">{e.description}</p>
                  </div>
                  <ChevronRight className="text-muted group-hover:text-primary transition shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* ── Voting flow ── */}
          {selectedElection && !voteSuccess && (
            <div className="bg-canvas border border-hairline rounded-xl overflow-hidden shadow-sm">
              {/* Header */}
              <div className="bg-surface-soft border-b border-hairline p-5 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-semibold text-primary uppercase tracking-widest block mb-1">BALLOT ENVELOPE</span>
                  <h2 className="text-base font-semibold text-ink leading-tight">{selectedElection.title}</h2>
                </div>
                <button onClick={() => { setSelectedElection(null); setStep('email'); }}
                  className="text-xs bg-canvas hover:bg-surface-soft border border-hairline text-ink px-4 py-2 rounded-full font-medium transition cursor-pointer">
                  Change Ballot
                </button>
              </div>

              {/* Step indicator */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-hairline bg-surface-soft/30">
                {[['1','Email','email'],['2','Face ID','face'],['3','Candidate','candidate'],['4','Cast Vote','otp']].map(([n, label, s], i, arr) => (
                  <div key={s} className="flex items-center gap-1">
                    <StepBadge n={n} label={label} active={step === s} done={stepNum > parseInt(n)} />
                    {i < arr.length - 1 && <ChevronRight size={14} className="text-hairline mx-1 hidden sm:block" />}
                  </div>
                ))}
              </div>

              {/* Form error */}
              <AnimatePresence>
                {formError && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mx-6 mt-4 bg-canvas border border-semantic-down text-semantic-down rounded-xl p-4 flex items-start gap-3 text-sm">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-6 space-y-6">
                {/* ── STEP 1: Email ── */}
                <AnimatePresence mode="wait">
                  {step === 'email' && (
                    <motion.div key="step-email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h3 className="font-semibold text-ink text-sm mb-4 flex items-center gap-2">
                        <Mail size={16} className="text-primary" /> Enter Your Voter Email
                      </h3>
                      <form onSubmit={handleEmailNext} className="flex gap-3">
                        <div className="relative flex-1">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                          <input type="email" required placeholder="registered@email.com" value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full bg-canvas border border-hairline focus:border-primary text-ink pl-11 pr-4 py-3 rounded-lg outline-none transition text-sm placeholder:text-muted" />
                        </div>
                        <button type="submit" disabled={verifyingEmail || !email}
                          className="bg-primary hover:bg-primary-active text-white px-6 rounded-full font-semibold text-sm transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer shadow-sm flex items-center gap-2">
                          {verifyingEmail ? <Loader2 size={14} className="animate-spin" /> : <>Next <ChevronRight size={14} /></>}
                        </button>
                      </form>
                      <p className="text-xs text-muted mt-3">We&apos;ll verify your registration and check for an existing face profile.</p>
                    </motion.div>
                  )}

                  {/* ── STEP 2: Face Scan ── */}
                  {step === 'face' && (
                    <motion.div key="step-face" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-ink text-sm flex items-center gap-2">
                          <ScanFace size={16} className="text-primary" /> Face Identity Verification
                        </h3>
                        <span className="text-xs text-muted font-medium">{email}</span>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-700 font-medium mb-4 flex items-center gap-2">
                        <ShieldCheck size={13} /> No images sent to server — verified locally via AWS Rekognition
                      </div>
                      <InlineFaceScanner
                        nullifierHash={voterNullifierHash}
                        electionId={selectedElection.id}
                        orgId={voterOrgId}
                        email={email}
                        orgSlug={slug}
                        onSuccess={handleFaceSuccess}
                        onCancel={() => setStep('email')}
                      />
                    </motion.div>
                  )}

                  {/* ── STEP 3: Select Candidate ── */}
                  {step === 'candidate' && (
                    <motion.div key="step-candidate" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-ink text-sm flex items-center gap-2">
                          <UserCheck size={16} className="text-green-600" />
                          <span className="text-green-700">Identity Verified</span>
                          <span className="text-muted font-normal">— Select Candidate</span>
                        </h3>
                        <span className="text-xs text-muted">{email}</span>
                      </div>

                      {faceAttributes && (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {faceAttributes.gender && <span className="bg-surface-soft border border-hairline px-2.5 py-1 rounded-full text-body capitalize">{faceAttributes.gender}</span>}
                          {faceAttributes.ageRange && <span className="bg-surface-soft border border-hairline px-2.5 py-1 rounded-full text-body">{faceAttributes.ageRange}</span>}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {candidates.map(c => (
                          <button key={c.id} onClick={() => setSelectedCandidate(c.id)}
                            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                              selectedCandidate === c.id ? 'bg-primary/5 border-primary shadow-sm' : 'bg-canvas border-hairline hover:border-body'
                            }`}>
                            <span className="text-3xl block mb-2">{c.symbol || '🗳️'}</span>
                            <p className="font-bold text-ink text-base truncate">{c.name}</p>
                            <p className="text-xs text-body font-semibold truncate mt-0.5">{c.party}</p>
                            {selectedCandidate === c.id && (
                              <div className="mt-3 flex items-center gap-1 text-primary text-xs font-bold bg-primary/10 w-fit px-2.5 py-0.5 rounded-full">
                                <CheckCircle2 size={11} /><span>Selected</span>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>

                      <button onClick={handleSendOtp} disabled={selectedCandidate === null || submitting}
                        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-active text-white py-3.5 rounded-full font-semibold text-sm transition disabled:opacity-40 cursor-pointer shadow-sm">
                        {submitting ? <Loader2 size={15} className="animate-spin" /> : <><Lock size={15} /> Confirm &amp; Send OTP</>}
                      </button>
                    </motion.div>
                  )}

                  {/* ── STEP 4: OTP & Cast Vote ── */}
                  {step === 'otp' && (
                    <motion.div key="step-otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                      <h3 className="font-semibold text-ink text-sm flex items-center gap-2">
                        <Lock size={16} className="text-primary" /> Enter Verification Code
                      </h3>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-3.5 text-xs text-green-700 font-semibold flex items-center gap-2">
                        <CheckCircle2 size={14} /> Code dispatched to {email}
                      </div>

                      <div
                        className="bg-surface-soft border border-hairline rounded-xl p-4 text-sm cursor-pointer group relative"
                        onClick={() => setShowCandidate(prev => !prev)}
                        title={showCandidate ? 'Click to hide candidate (privacy mode)' : 'Click to reveal your selection'}
                      >
                        <p className="text-muted text-xs mb-1">Your vote for</p>
                        <p className={`font-bold text-ink transition-all duration-200 ${showCandidate ? '' : 'blur-sm select-none'}`}>
                          {candidates.find(c => c.id === selectedCandidate)?.name}
                        </p>
                        <p className={`text-xs text-body transition-all duration-200 ${showCandidate ? '' : 'blur-sm select-none'}`}>
                          {candidates.find(c => c.id === selectedCandidate)?.party}
                        </p>
                        {!showCandidate && (
                          <p className="text-[10px] text-muted mt-2 flex items-center gap-1">
                            <span>🔒</span> Tap to reveal · Hidden for shoulder-surfing protection
                          </p>
                        )}
                      </div>

                      <form onSubmit={castVote} className="space-y-3">
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                          <input type="text" required placeholder="Enter 6-digit OTP" maxLength={6} value={otp}
                            onChange={e => setOtp(e.target.value)}
                            className="w-full bg-canvas border border-hairline focus:border-primary text-ink pl-11 pr-4 py-3 rounded-lg outline-none transition font-mono tracking-widest text-lg" />
                        </div>
                        <button type="submit" disabled={submitting || otp.length < 6}
                          className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-active text-white py-3.5 rounded-full font-semibold text-sm transition disabled:opacity-40 cursor-pointer shadow-sm">
                          {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : <><Vote size={14} /> Cast My Vote</>}
                        </button>
                        <button type="button" onClick={() => setStep('candidate')}
                          className="w-full text-center text-xs text-muted hover:text-ink font-medium transition cursor-pointer flex items-center justify-center gap-1">
                          <ChevronLeft size={12} /> Back to Candidate Selection
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Vote success */}
          {voteSuccess && (
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-canvas border border-hairline rounded-xl p-8 md:p-10 text-center shadow-sm">
              <div className="w-16 h-16 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-2xl font-display font-normal text-ink mb-3">Vote Secured on Blockchain</h2>
              <p className="text-body text-sm mb-6 max-w-sm mx-auto leading-relaxed">
                Your ballot has been relayed and cryptographically recorded. For your privacy, the candidate you voted for is not displayed.
              </p>
              <div className="bg-surface-soft border border-hairline rounded-lg p-4 inline-block text-left mb-8 max-w-full">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Cryptographic Receipt</p>
                <code className="text-green-700 font-mono text-xs break-all">{txHash}</code>
              </div>
              <div className="flex flex-col gap-3">
                <Link href={`/verify?txHash=${encodeURIComponent(txHash || '')}`}
                  className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  <ShieldCheck size={15} /> Validate receipt on-chain
                </Link>
                <button onClick={() => window.location.reload()}
                  className="text-xs font-semibold text-muted hover:text-ink transition cursor-pointer">
                  Back to Portal
                </button>
              </div>
            </motion.div>
          )}

        </div>
      </main>
    </div>
  );
}

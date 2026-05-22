'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Mail, KeyRound, CheckCircle, Loader2, ShieldCheck, Vote, AlertCircle } from 'lucide-react';

// ── Step components ───────────────────────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = ['Enter Email', 'Verify OTP', 'Cast Vote'];
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-[#6366f1] text-white' : 'bg-[#1e293b] text-[#475569]'}`}>
            {i < step ? <CheckCircle size={14} /> : i + 1}
          </div>
          <span className={`text-xs font-semibold hidden sm:block ${i === step ? 'text-white' : 'text-[#475569]'}`}>{s}</span>
          {i < steps.length - 1 && <div className={`w-8 h-px ${i < step ? 'bg-green-500' : 'bg-[#1e293b]'}`} />}
        </div>
      ))}
    </div>
  );
}

function Card({ children }) {
  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-8 w-full max-w-md mx-auto shadow-2xl">
      {children}
    </div>
  );
}

function Err({ msg }) {
  return msg ? (
    <div className="flex gap-2 items-start bg-red-900/20 border border-red-700 text-red-300 rounded-xl p-3 mt-4 text-sm">
      <AlertCircle size={14} className="shrink-0 mt-0.5" />{msg}
    </div>
  ) : null;
}

// ── Vote Success ──────────────────────────────────────────────────────────────
function VoteSuccess({ txHash, candidateName }) {
  return (
    <Card>
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck size={32} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Vote Cast!</h2>
        <p className="text-[#64748b] text-sm mb-5">Your vote for <strong className="text-white">{candidateName}</strong> has been recorded on the blockchain.</p>
        <div className="bg-[#0f172a] rounded-xl p-4 text-left">
          <p className="text-[#64748b] text-xs mb-1">Transaction Hash</p>
          <p className="font-mono text-[#a5b4fc] text-xs break-all">{txHash}</p>
        </div>
        <p className="text-[#475569] text-xs mt-4">Your vote is anonymous and immutable. No one can alter it.</p>
      </div>
    </Card>
  );
}

// ── Main Voter Portal ─────────────────────────────────────────────────────────
export default function VoterPortalPage() {
  const { slug } = useParams();
  const [org, setOrg] = useState(null);
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);

  const [step, setStep] = useState(0); // 0=email, 1=otp, 2=vote
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [countdown, setCountdown] = useState(300);

  // Load org + active elections
  useEffect(() => {
    fetch(`/api/orgs/register?slug=${slug}`).then(r => r.json()).then(d => {
      setOrg(d.org);
      fetch(`/api/org/${slug}/elections`).then(r => r.json()).then(d => {
        const active = (d.elections || []).filter(e => e.phase === 1);
        setElections(active);
        if (active.length === 1) setSelectedElection(active[0]);
      });
    });
  }, [slug]);

  // OTP countdown
  useEffect(() => {
    if (step !== 1 || !otpExpiry) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.floor((new Date(otpExpiry) - Date.now()) / 1000));
      setCountdown(left);
      if (left === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [step, otpExpiry]);

  const sendOTP = async () => {
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/auth/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, orgId: org._id, electionId: selectedElection?.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setOtpExpiry(d.expiresAt);
      setCountdown(300);
      setStep(1);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const verifyOTP = async () => {
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, otp, orgId: org._id,
          electionId: selectedElection?.id,
          candidateId: selectedCandidate?.id,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSuccess({ txHash: d.txHash, candidateName: selectedCandidate?.name });
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  if (success) return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4 py-10">
      <VoteSuccess {...success} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-[#1e293b] px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center">
          <Vote size={15} className="text-white" />
        </div>
        <div>
          <p className="text-white font-black text-sm leading-none">{org?.name || slug}</p>
          <p className="text-[#64748b] text-xs">Secure Voting · Aegis Protocol</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md mb-6 text-center">
          <h1 className="text-3xl font-black text-white mb-2">Cast Your Vote</h1>
          <p className="text-[#64748b] text-sm">Verify your email to vote. No wallet or crypto needed.</p>
        </div>

        <StepIndicator step={step} />

        {/* Step 0: Select Election + Enter Email */}
        {step === 0 && (
          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[#6366f1]/20 rounded-xl"><Mail size={18} className="text-[#a5b4fc]" /></div>
              <div>
                <h2 className="text-white font-black">Enter your email</h2>
                <p className="text-[#64748b] text-xs">Must be registered by your org admin</p>
              </div>
            </div>

            {elections.length > 1 && (
              <div className="mb-4">
                <label className="block text-xs text-[#64748b] mb-1.5">Select Election</label>
                <select value={selectedElection?._id || ''} onChange={e => setSelectedElection(elections.find(el => el._id === e.target.value))}
                  className="w-full bg-[#0f172a] border border-[#334155] text-white px-4 py-2.5 rounded-xl outline-none text-sm">
                  <option value="">Choose election…</option>
                  {elections.map(el => <option key={el._id || el.id} value={el._id || el.id}>{el.title}</option>)}
                </select>
              </div>
            )}

            {elections.length === 0 && (
              <div className="bg-[#0f172a] rounded-xl p-4 mb-4 text-center">
                <p className="text-[#64748b] text-sm">No active elections right now.</p>
              </div>
            )}

            <label className="block text-xs text-[#64748b] mb-1.5">Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              onKeyDown={e => e.key === 'Enter' && sendOTP()}
              className="w-full bg-[#0f172a] border border-[#334155] focus:border-[#6366f1] text-white px-4 py-3 rounded-xl outline-none transition text-sm" />
            <Err msg={error} />
            <button onClick={sendOTP} disabled={!email || !selectedElection || loading}
              className="mt-4 w-full bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              {loading ? 'Sending OTP…' : 'Send OTP to Email'}
            </button>
          </Card>
        )}

        {/* Step 1: OTP + Select Candidate */}
        {step === 1 && (
          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-500/20 rounded-xl"><KeyRound size={18} className="text-amber-400" /></div>
              <div>
                <h2 className="text-white font-black">Enter OTP</h2>
                <p className="text-[#64748b] text-xs">Sent to {email} · Expires in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</p>
              </div>
            </div>

            {/* Candidates */}
            {selectedElection?.candidates?.length > 0 && (
              <div className="mb-5">
                <label className="block text-xs text-[#64748b] mb-2">Select Candidate</label>
                <div className="space-y-2">
                  {selectedElection.candidates.map(c => (
                    <button key={c.id} onClick={() => setSelectedCandidate(c)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${selectedCandidate?.id === c.id ? 'border-[#6366f1] bg-[#6366f1]/10' : 'border-[#334155] hover:border-[#6366f1]/50'}`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedCandidate?.id === c.id ? 'border-[#6366f1]' : 'border-[#475569]'}`}>
                        {selectedCandidate?.id === c.id && <div className="w-2 h-2 rounded-full bg-[#6366f1]" />}
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">{c.name}</p>
                        <p className="text-[#64748b] text-xs">{c.party} {c.symbol}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="block text-xs text-[#64748b] mb-1.5">6-Digit OTP</label>
            <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456" maxLength={6}
              className="w-full bg-[#0f172a] border border-[#334155] focus:border-[#6366f1] text-white px-4 py-3 rounded-xl outline-none transition text-sm text-center text-2xl font-black tracking-widest" />
            <Err msg={error} />
            <button onClick={verifyOTP} disabled={otp.length !== 6 || !selectedCandidate || loading}
              className="mt-4 w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {loading ? 'Casting Vote…' : 'Confirm & Cast Vote'}
            </button>
            <button onClick={() => { setStep(0); setOtp(''); setError(''); }} className="mt-2 w-full text-[#64748b] hover:text-white text-xs py-2 transition">
              ← Change email
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}

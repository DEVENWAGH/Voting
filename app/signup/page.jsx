'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Mail, Lock, Eye, EyeOff, Loader2, AlertCircle,
  Building2, GraduationCap, Briefcase, Globe2, Cpu,
  CheckCircle2, User, Vote, ShieldCheck, RefreshCw
} from 'lucide-react';

const ORG_TYPES = [
  { value: 'college',   label: 'University / College', icon: GraduationCap },
  { value: 'company',   label: 'Company / Startup',    icon: Briefcase },
  { value: 'community', label: 'Community / NGO',       icon: Globe2 },
  { value: 'dao',       label: 'DAO / Crypto Org',      icon: Cpu },
  { value: 'other',     label: 'Other',                 icon: Building2 },
];

const STEPS = [
  { label: 'Your account' },
  { label: 'Your organization' },
  { label: 'Verify email' },
];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep]         = useState(1);
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]       = useState('');

  // Step 1
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword]     = useState('');
  const [confirmPw, setConfirmPw]   = useState('');

  // Step 2
  const [orgName, setOrgName]         = useState('');
  const [orgType, setOrgType]         = useState('');
  const [description, setDescription] = useState('');

  // Step 3
  const [otp, setOtp]         = useState('');
  const [resending, setResending] = useState(false);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch {
      setError('Google sign-up failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  // Step 1 → Step 2
  const nextStep1 = (e) => {
    e.preventDefault();
    setError('');
    if (!adminEmail || !password || !confirmPw) { setError('Please fill in all fields.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    setStep(2);
  };

  // Step 2 → submit org, get OTP → Step 3
  const nextStep2 = async (e) => {
    e.preventDefault();
    setError('');
    if (!orgName || !orgType) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/org-auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName, orgType, description, adminEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed.');
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const resendOtp = async () => {
    setResending(true); setError('');
    try {
      const res = await fetch('/api/org-auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName, orgType, description, adminEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOtp('');
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  // Step 3 → verify OTP → auto sign-in
  const verifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError('Please enter the 6-digit OTP.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/org-auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed.');

      // Auto sign-in
      const signInRes = await signIn('credentials', { email: adminEmail, password, redirect: false });
      if (signInRes?.error) {
        router.push('/login');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:36px_36px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl">

          {/* Logo */}
          <div className="flex flex-col items-center mb-7 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-950/60">
              <Vote size={26} className="text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-black text-white tracking-tight">Create your org</h1>
              <p className="text-slate-400 text-sm mt-1">Free forever · No credit card needed</p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center mb-7">
            {STEPS.map((s, idx) => {
              const n = idx + 1;
              const done = step > n;
              const active = step === n;
              return (
                <div key={n} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                      done   ? 'bg-indigo-500 border-indigo-500 text-white'
                      : active ? 'bg-indigo-950 border-indigo-400 text-indigo-300'
                      : 'bg-slate-950 border-slate-700 text-slate-600'
                    }`}>
                      {done ? <CheckCircle2 size={14} /> : n}
                    </div>
                    <span className={`text-xs font-medium hidden sm:block ${active ? 'text-slate-200' : 'text-slate-600'}`}>
                      {s.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className="flex-1 h-px mx-2 bg-slate-800" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Google button (step 1 only) */}
          {step === 1 && (
            <>
              <button
                id="google-signup-btn"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-semibold py-3 px-4 rounded-xl transition mb-5 disabled:opacity-60 shadow"
              >
                {googleLoading ? <Loader2 size={18} className="animate-spin text-slate-600" /> : <GoogleIcon />}
                Sign up with Google
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-slate-600 text-xs font-medium">or with email</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl p-3 mb-5 text-red-300 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Step 1: Account ── */}
          {step === 1 && (
            <form onSubmit={nextStep1} className="space-y-4">
              <Field label="Admin Email" icon={<Mail size={15} />}>
                <input
                  id="signup-email" type="email" value={adminEmail} required
                  onChange={e => setAdminEmail(e.target.value)}
                  placeholder="you@yourorg.com"
                  className="input pl-10"
                />
              </Field>
              <Field label="Password" icon={<Lock size={15} />}>
                <input
                  id="signup-password" type={showPw ? 'text' : 'password'} value={password} required
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="input pl-10 pr-11"
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </Field>
              <Field label="Confirm Password" icon={<Lock size={15} />}>
                <input
                  id="signup-confirm-password" type={showPw ? 'text' : 'password'} value={confirmPw} required
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat password"
                  className="input pl-10"
                />
              </Field>
              <button id="signup-next-btn" type="submit"
                className="w-full btn-primary py-3.5">
                Continue →
              </button>
            </form>
          )}

          {/* ── Step 2: Organization ── */}
          {step === 2 && (
            <form onSubmit={nextStep2} className="space-y-4">
              <Field label="Organization Name" icon={<User size={15} />}>
                <input
                  id="signup-org-name" type="text" value={orgName} required
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Acme University, My Company…"
                  className="input pl-10"
                />
              </Field>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Organization Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {ORG_TYPES.map(({ value, label, icon: Icon }) => (
                    <button key={value} type="button" onClick={() => setOrgType(value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition text-left ${
                        orgType === value
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-600'
                      }`}>
                      <Icon size={14} className="shrink-0" />
                      <span className="text-xs">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  Description <span className="text-slate-700 normal-case">(optional)</span>
                </label>
                <textarea
                  id="signup-description" value={description} rows={3}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of your organization…"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-white px-4 py-3 rounded-xl outline-none transition text-sm placeholder:text-slate-600 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => { setStep(1); setError(''); }}
                  className="flex-1 border border-slate-700 hover:border-slate-500 text-slate-300 font-semibold py-3.5 rounded-xl transition text-sm">
                  ← Back
                </button>
                <button id="signup-submit-btn" type="submit" disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 btn-primary py-3.5">
                  {loading ? <><Loader2 size={15} className="animate-spin" /> Sending OTP…</> : 'Send OTP →'}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 3: Email OTP Verification ── */}
          {step === 3 && (
            <form onSubmit={verifyOtp} className="space-y-5">
              {/* Info card */}
              <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-2xl p-4 text-center space-y-1">
                <ShieldCheck size={22} className="text-indigo-400 mx-auto" />
                <p className="text-white font-semibold text-sm">Check your inbox</p>
                <p className="text-slate-400 text-xs">
                  We sent a 6-digit OTP to <span className="text-indigo-300 font-mono">{adminEmail}</span>
                </p>
                <p className="text-slate-600 text-xs">Expires in 10 minutes</p>
              </div>

              {/* OTP input */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Enter OTP</label>
                <input
                  id="signup-otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-white px-4 py-4 rounded-xl outline-none transition text-2xl font-black tracking-[0.4em] text-center placeholder:text-slate-700 placeholder:text-base placeholder:tracking-normal"
                />
              </div>

              <button id="signup-verify-btn" type="submit" disabled={loading || otp.length !== 6}
                className="w-full flex items-center justify-center gap-2 btn-primary py-3.5 disabled:opacity-50">
                {loading ? <><Loader2 size={15} className="animate-spin" /> Verifying…</> : <><ShieldCheck size={15} /> Verify & Create Account</>}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <button type="button" onClick={() => { setStep(2); setOtp(''); setError(''); }}
                  className="hover:text-slate-400 transition">← Change details</button>
                <button type="button" onClick={resendOtp} disabled={resending}
                  className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition disabled:opacity-50">
                  {resending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Resend OTP
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-slate-500 text-sm mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition">Sign in</Link>
          </p>
        </div>

        <p className="text-center mt-5 text-slate-600 text-xs">
          <Link href="/" className="hover:text-slate-400 transition">← Back to homepage</Link>
        </p>
      </div>

      {/* Scoped utility classes */}
      <style jsx global>{`
        .input {
          width: 100%;
          background: rgba(2, 6, 23, 0.8);
          border: 1px solid rgb(30, 41, 59);
          color: white;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          outline: none;
          transition: border-color 0.15s;
          font-size: 0.875rem;
        }
        .input:focus { border-color: #6366f1; }
        .input::placeholder { color: rgb(71, 85, 105); }
        .btn-primary {
          background: linear-gradient(to right, #6366f1, #7c3aed);
          color: white;
          font-weight: 700;
          border-radius: 0.75rem;
          transition: all 0.15s;
          box-shadow: 0 10px 30px -10px rgba(99,102,241,0.4);
        }
        .btn-primary:hover:not(:disabled) {
          background: linear-gradient(to right, #4f46e5, #6d28d9);
        }
      `}</style>
    </div>
  );
}

function Field({ label, icon, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">{icon}</div>
        {children}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

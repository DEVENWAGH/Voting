'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, Eye, EyeOff, Loader2, AlertCircle,
  Building2, GraduationCap, Briefcase, Globe2, Cpu,
  CheckCircle2, User, Vote, ShieldCheck, RefreshCw
} from 'lucide-react';

const ORG_TYPES = [
  { value: 'college',   label: 'University', icon: GraduationCap },
  { value: 'company',   label: 'Company',    icon: Briefcase },
  { value: 'community', label: 'Community',  icon: Globe2 },
  { value: 'dao',       label: 'DAO',        icon: Cpu },
  { value: 'other',     label: 'Other',      icon: Building2 },
];

const STEPS = [
  { label: 'Admin Account' },
  { label: 'Organization' },
  { label: 'Verification' },
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

  const nextStep1 = (e) => {
    e.preventDefault();
    setError('');
    if (!adminEmail || !password || !confirmPw) { setError('Please fill in all fields.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPw) { setError('Passwords do not match.'); return; }
    setStep(2);
  };

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
    <div className="min-h-screen bg-surface-soft flex items-center justify-center p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="w-full max-w-[480px] bg-canvas border border-hairline rounded-xl p-8 md:p-10 shadow-sm"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8 space-y-4">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <Vote size={18} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-display font-normal text-ink tracking-tight">Create organization</h1>
            <p className="text-body text-sm mt-1">Institutional on-chain voting setup</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-8 justify-between border-b border-hairline pb-4">
          {STEPS.map((s, idx) => {
            const n = idx + 1;
            const done = step > n;
            const active = step === n;
            return (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${
                  done     ? 'bg-primary border-primary text-white'
                  : active ? 'bg-canvas border-primary text-primary font-bold'
                  : 'bg-surface-strong border-hairline text-muted'
                }`}>
                  {done ? <CheckCircle2 size={12} /> : n}
                </div>
                <span className={`text-xs font-semibold ${active ? 'text-ink' : 'text-muted'} hidden sm:block`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Errors */}
        {error && (
          <div className="flex items-start gap-2.5 bg-canvas border border-semantic-down rounded-xl p-3 mb-6 text-semantic-down text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Forms with animated transition */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Google signup */}
              <button
                id="google-signup-btn"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 bg-canvas hover:bg-surface-soft border border-hairline text-ink font-semibold py-3 px-4 rounded-full transition-all disabled:opacity-60 text-sm cursor-pointer mb-5"
              >
                {googleLoading ? <Loader2 size={16} className="animate-spin text-muted" /> : <GoogleIcon />}
                Sign up with Google
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-hairline" />
                <span className="text-muted text-xs font-medium uppercase tracking-wider">or email</span>
                <div className="flex-1 h-px bg-hairline" />
              </div>

              <form onSubmit={nextStep1} className="space-y-4">
                <Field label="Admin Email" icon={<Mail size={15} />}>
                  <input
                    id="signup-email" type="email" value={adminEmail} required
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="email@organization.com"
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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition cursor-pointer">
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
                  className="w-full bg-primary hover:bg-primary-active text-white font-semibold py-3.5 px-6 rounded-full transition-all text-sm cursor-pointer shadow-sm">
                  Continue
                </button>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <form onSubmit={nextStep2} className="space-y-5">
                <Field label="Organization Name" icon={<User size={15} />}>
                  <input
                    id="signup-org-name" type="text" value={orgName} required
                    onChange={e => setOrgName(e.target.value)}
                    placeholder="Acme University, DAO name…"
                    className="input pl-10"
                  />
                </Field>

                <div>
                  <label className="block text-xs font-semibold text-body mb-2.5 uppercase tracking-wider">Organization Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ORG_TYPES.map(({ value, label, icon: Icon }) => (
                      <button key={value} type="button" onClick={() => setOrgType(value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-semibold transition text-left cursor-pointer ${
                          orgType === value
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-hairline bg-canvas text-body hover:border-body'
                        }`}>
                        <Icon size={14} className="shrink-0" />
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-body mb-2 uppercase tracking-wider">
                    Description <span className="text-muted normal-case font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="signup-description" value={description} rows={3}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Brief description of the organization..."
                    className="w-full bg-canvas border border-hairline focus:border-primary text-ink px-4 py-3 rounded-lg outline-none transition text-sm placeholder:text-muted resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={() => { setStep(1); setError(''); }}
                    className="flex-1 bg-surface-strong hover:bg-hairline text-ink font-semibold py-3.5 rounded-full transition-all text-sm cursor-pointer">
                    Back
                  </button>
                  <button id="signup-submit-btn" type="submit" disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-active text-white font-semibold py-3.5 rounded-full transition-all text-sm cursor-pointer shadow-sm">
                    {loading ? <><Loader2 size={14} className="animate-spin" /> OTP...</> : 'Send OTP'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <form onSubmit={verifyOtp} className="space-y-6">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-1">
                  <ShieldCheck size={22} className="text-primary mx-auto" />
                  <p className="text-ink font-semibold text-sm">Check your inbox</p>
                  <p className="text-body text-xs leading-relaxed">
                    We sent a 6-digit verification code to <br />
                    <span className="text-primary font-mono font-medium">{adminEmail}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-body mb-2 uppercase tracking-wider text-center">Verification Code</label>
                  <input
                    id="signup-otp"
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full bg-canvas border border-hairline focus:border-primary text-ink px-4 py-3 rounded-lg outline-none transition text-2xl font-mono font-medium tracking-[0.4em] text-center placeholder:text-muted placeholder:tracking-normal"
                  />
                </div>

                <button id="signup-verify-btn" type="submit" disabled={loading || otp.length !== 6}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-active text-white font-semibold py-3.5 px-6 rounded-full transition-all text-sm cursor-pointer shadow-sm">
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Verifying...</> : 'Verify & Create'}
                </button>

                <div className="flex items-center justify-between text-xs font-semibold">
                  <button type="button" onClick={() => { setStep(2); setOtp(''); setError(''); }}
                    className="text-muted hover:text-ink transition cursor-pointer">Edit organization</button>
                  <button type="button" onClick={resendOtp} disabled={resending}
                    className="flex items-center gap-1 text-primary hover:text-primary-active transition disabled:opacity-50 cursor-pointer">
                    {resending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    Resend Code
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-body text-sm mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline font-semibold transition">Sign in</Link>
        </p>

        <p className="text-center mt-6 text-xs">
          <Link href="/" className="text-muted hover:text-ink transition">← Back to homepage</Link>
        </p>
      </motion.div>

      {/* Styled utilities mapped to Tailwind CSS 4 */}
      <style jsx global>{`
        .input {
          width: 100%;
          background: #ffffff;
          border: 1px solid #dee1e6;
          color: #0a0b0d;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          outline: none;
          transition: border-color 0.15s;
          font-size: 0.875rem;
        }
        .input:focus { border-color: #0052ff; border-width: 1px; }
        .input::placeholder { color: #7c828a; }
      `}</style>
    </div>
  );
}

function Field({ label, icon, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-body mb-2 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none">{icon}</div>
        {children}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

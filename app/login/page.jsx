'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, Vote } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]       = useState('');

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError('Invalid email or password. Please try again.');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch {
      setError('Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-soft flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="w-full max-w-[440px] bg-canvas border border-hairline rounded-xl p-8 md:p-10 shadow-sm"
      >
        {/* Logo and header */}
        <div className="flex flex-col items-center mb-8 space-y-4">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <Vote size={18} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-display font-normal text-ink tracking-tight">Sign in to Block Vote</h1>
            <p className="text-body text-sm mt-1">Manage elections for your organization</p>
          </div>
        </div>

        {/* Google sign-in */}
        <button
          id="google-signin-btn"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-3 bg-canvas hover:bg-surface-soft border border-hairline text-ink font-semibold py-3 px-4 rounded-full transition-all disabled:opacity-60 text-sm cursor-pointer"
        >
          {googleLoading ? (
            <Loader2 size={16} className="animate-spin text-muted" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-hairline" />
          <span className="text-muted text-xs font-medium uppercase tracking-wider">or email</span>
          <div className="flex-1 h-px bg-hairline" />
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2.5 bg-canvas border border-semantic-down rounded-xl p-3 mb-5 text-semantic-down text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form fields */}
        <form onSubmit={handleCredentials} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-body mb-2 uppercase tracking-wider">Email address</label>
            <div className="relative">
              <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@organization.com"
                required
                className="w-full bg-canvas border border-hairline focus:border-primary text-ink pl-11 pr-4 py-3 rounded-lg outline-none transition text-sm placeholder:text-muted"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-body uppercase tracking-wider">Password</label>
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full bg-canvas border border-hairline focus:border-primary text-ink pl-11 pr-11 py-3 rounded-lg outline-none transition text-sm placeholder:text-muted"
              />
              <button
                type="button"
                onClick={() => setShowPw(p => !p)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition cursor-pointer"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-active text-white font-semibold py-3.5 px-6 rounded-full transition-all disabled:opacity-50 text-sm cursor-pointer shadow-sm"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-body text-sm mt-6">
          New to Block Vote?{' '}
          <Link href="/signup" className="text-primary hover:underline font-semibold transition">
            Create an account
          </Link>
        </p>

        <p className="text-center mt-6 text-xs">
          <Link href="/" className="text-muted hover:text-ink transition">← Back to homepage</Link>
        </p>
      </motion.div>
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

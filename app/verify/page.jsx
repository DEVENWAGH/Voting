'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShieldCheck, Search, Loader2, CheckCircle2, AlertCircle,
  ExternalLink, Vote, ChevronLeft, Hash, Building2,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function VerifyVotePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    }>
      <VerifyVoteContent />
    </Suspense>
  );
}

function VerifyVoteContent() {
  const searchParams = useSearchParams();
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const prefill = searchParams.get('txHash');
    if (prefill) setTxHash(prefill);
  }, [searchParams]);

  const verify = async (e) => {
    e.preventDefault();
    const hash = txHash.trim();
    if (!hash) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/audit/verify?txHash=${encodeURIComponent(hash)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      
      {/* Navbar */}
      <nav className="border-b border-hairline bg-canvas/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-2 text-sm text-body hover:text-ink transition font-semibold">
          <ChevronLeft size={16} /> 
          <span>Block Vote</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full font-semibold">
            <ShieldCheck size={14} /> 
            <span>Audit Explorer</span>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-xl mx-auto px-6 py-16 w-full">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-full bg-surface-strong border border-hairline flex items-center justify-center mx-auto mb-5 text-primary">
            <Hash size={20} />
          </div>
          <h1 className="text-3xl font-display font-normal tracking-tight mb-3 text-ink">Verify On-Chain Vote</h1>
          <p className="text-body text-sm leading-relaxed max-w-sm mx-auto">
            Audit your vote receipt. Query the Ethereum ledger to confirm your ballot was logged securely, anonymously, and correctly.
          </p>
        </div>

        <form onSubmit={verify} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-body uppercase tracking-wider">
              Transaction Hash
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="0x..."
                className="w-full bg-canvas border border-hairline focus:border-primary text-ink pl-11 pr-4 py-3.5 rounded-lg outline-none font-mono text-sm placeholder:text-muted placeholder:font-sans"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !txHash.trim()}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-active text-white font-semibold py-3.5 rounded-full transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            <span>{loading ? 'Verifying...' : 'Verify on Blockchain'}</span>
          </button>
        </form>

        {error && (
          <div className="mt-6 bg-canvas border border-semantic-down rounded-xl p-4 flex items-start gap-3 text-sm text-semantic-down">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Verification failed</p>
              <p className="text-xs opacity-80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-8 border rounded-xl p-6 space-y-5 shadow-sm ${
              result.verified
                ? 'bg-canvas border-green-200'
                : 'bg-canvas border-amber-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {result.verified ? (
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0 border border-green-100">
                  <CheckCircle2 size={18} />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 border border-amber-100">
                  <AlertCircle size={18} />
                </div>
              )}
              <div>
                <p className="font-semibold text-ink text-base">
                  {result.verified ? 'Receipt Verified' : 'Unverified Receipt'}
                </p>
                <p className="text-body text-xs mt-0.5">{result.message}</p>
              </div>
            </div>

            <div className="bg-surface-soft border border-hairline rounded-lg p-4 space-y-3 text-xs">
              <div className="flex justify-between gap-4 border-b border-hairline pb-2.5">
                <span className="text-muted">Transaction ID</span>
                <code className="text-green-700 font-mono break-all text-right select-all">{result.txHash}</code>
              </div>
              {result.blockNumber != null && (
                <div className="flex justify-between border-b border-hairline pb-2.5">
                  <span className="text-muted">Block Height</span>
                  <span className="text-ink font-mono font-medium">{result.blockNumber}</span>
                </div>
              )}
              {result.timestamp && (
                <div className="flex justify-between border-b border-hairline pb-2.5">
                  <span className="text-muted">Timestamp</span>
                  <span className="text-ink font-medium">{new Date(result.timestamp).toLocaleString()}</span>
                </div>
              )}
              {result.electionTitle && (
                <div className="flex justify-between gap-4 border-b border-hairline pb-2.5">
                  <span className="text-muted">Election Title</span>
                  <span className="text-ink text-right font-medium">{result.electionTitle}</span>
                </div>
              )}
              {result.orgName && (
                <div className="flex justify-between gap-4 border-b border-hairline pb-2.5">
                  <span className="text-muted flex items-center gap-1"><Building2 size={11} /> Organization</span>
                  <span className="text-ink font-medium">{result.orgName}</span>
                </div>
              )}
              {result.candidateName && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted flex items-center gap-1"><Vote size={11} /> Choice</span>
                  <span className="text-primary font-semibold">{result.candidateName}</span>
                </div>
              )}
            </div>

            {result.electionId != null && result.verified && (
              <Link
                href={`/elections/${result.electionId}`}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold"
              >
                <span>View public audit charts</span> 
                <ExternalLink size={12} />
              </Link>
            )}
          </motion.div>
        )}

        <p className="text-center text-muted text-xs mt-10">
          Transactions are stored in Ethereum public ledger. No personal data is stored on-chain.
        </p>
      </main>
    </div>
  );
}

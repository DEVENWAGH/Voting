'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Mail, Lock, ShieldCheck, CheckCircle2, ChevronRight,
  Vote, AlertCircle, Loader2, Trophy, BarChart3
} from 'lucide-react';
import ElectionResults from '@/components/ElectionResults';
import ThemeToggle from '@/components/ThemeToggle';

export default function VoterPortal() {
  const { slug } = useParams();
  const [org, setOrg] = useState(null);
  const [elections, setElections] = useState([]);
  const [completedElections, setCompletedElections] = useState([]);
  const [portalView, setPortalView] = useState('live'); // live | results
  const [viewingResults, setViewingResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Auth & flow state
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Voting state
  const [selectedElection, setSelectedElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [txHash, setTxHash] = useState(null);

  // 1. Load Org & Live Elections
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const orgRes = await fetch(`/api/orgs/register?slug=${slug}`);
      const orgData = await orgRes.json();
      if (!orgRes.ok) throw new Error(orgData.error || 'Organization not found');
      setOrg(orgData.org);

      const elRes = await fetch(`/api/org/${slug}/elections`);
      const elData = await elRes.json();
      if (!elRes.ok) throw new Error(elData.error);

      const all = elData.elections || [];
      const live = all.filter((e) => e.phase === 1 && e.guardianApproved);
      const completed = all.filter((e) => e.phase === 2);
      setElections(live);
      setCompletedElections(completed);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Select Election & Load Candidates
  const selectElection = async (e) => {
    setSelectedElection(e);
    try {
      const r = await fetch(`/api/org/${slug}/elections/${e.id}/candidates`);
      const d = await r.json();
      setCandidates(d.candidates || []);
    } catch {}
  };

  // 3. Request OTP
  const requestOtp = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          orgId: org._id,
          electionId: selectedElection.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOtpSent(true);
    } catch (err) {
      setError(err.message);
    }
    setVerifying(false);
  };

  // 4. Verify OTP & Cast Vote
  const castVote = async (e) => {
    e.preventDefault();
    if (selectedCandidate === null || selectedCandidate === undefined) {
      setError('Please select a candidate first.');
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setError(err.message);
    }
    setVerifying(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex justify-center items-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error && !org) {
    return (
      <div className="min-h-screen bg-surface-soft flex justify-center items-center p-6 text-center">
        <div className="bg-canvas p-8 border border-hairline rounded-xl max-w-sm shadow-sm">
          <Building2 size={40} className="text-muted mx-auto mb-4" />
          <h1 className="text-ink text-lg font-semibold mb-2">Portal Not Found</h1>
          <p className="text-body text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      
      {/* Top Navbar */}
      <nav className="border-b border-hairline bg-canvas/80 backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-strong flex items-center justify-center border border-hairline">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="w-6 h-6 object-contain" />
            ) : (
              <Building2 size={18} className="text-primary" />
            )}
          </div>
          <div>
            <h1 className="font-bold text-ink text-base leading-tight">{org.name}</h1>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider">Voter Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/verify" className="text-xs text-primary hover:text-primary-active font-semibold transition">
            Verify Ballots
          </Link>
          <div className="flex items-center gap-2 text-xs text-body bg-surface-soft border border-hairline px-3 py-1.5 rounded-full font-medium">
            <ShieldCheck size={14} className="text-primary shrink-0" />
            <span>Secured Session</span>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 pb-24 bg-surface-soft/40">
        <div className="w-full max-w-xl">
          
          {/* Portal Tabs */}
          {!selectedElection && !viewingResults && (
            <div className="flex p-1 bg-surface-strong border border-hairline rounded-full mb-8">
              <button
                onClick={() => setPortalView('live')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                  portalView === 'live'
                    ? 'bg-canvas text-primary shadow-sm border border-hairline/60'
                    : 'text-body hover:text-ink'
                }`}
              >
                <Vote size={14} /> 
                <span>Active Ballots</span>
                {elections.length > 0 && (
                  <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-1">{elections.length}</span>
                )}
              </button>
              <button
                onClick={() => setPortalView('results')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                  portalView === 'results'
                    ? 'bg-canvas text-primary shadow-sm border border-hairline/60'
                    : 'text-body hover:text-ink'
                }`}
              >
                <BarChart3 size={14} /> 
                <span>Results</span>
                {completedElections.length > 0 && (
                  <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-1">{completedElections.length}</span>
                )}
              </button>
            </div>
          )}

          {/* Results Details */}
          {viewingResults && !selectedElection && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-display font-normal text-ink">Elections Results</h2>
                <button
                  onClick={() => setViewingResults(null)}
                  className="text-xs bg-canvas hover:bg-surface-soft border border-hairline text-ink px-4 py-2 rounded-full font-medium transition cursor-pointer shadow-sm"
                >
                  Close Results
                </button>
              </div>
              <div className="bg-canvas border border-hairline rounded-xl p-6 shadow-sm">
                <ElectionResults slug={slug} electionId={viewingResults.id} electionTitle={viewingResults.title} />
              </div>
            </div>
          )}

          {/* Tab 1: Live elections */}
          {!selectedElection && !viewingResults && portalView === 'live' && (
            <div className="space-y-4">
              <h2 className="text-center text-2xl font-display font-normal text-ink tracking-tight mb-6">Active Elections</h2>
              {elections.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-hairline rounded-xl bg-canvas shadow-sm">
                  <Vote size={36} className="text-muted mx-auto mb-4" />
                  <p className="text-ink font-semibold">No active ballots</p>
                  <p className="text-body text-sm mt-1">There are no open elections available to vote on at this time.</p>
                </div>
              ) : (
                elections.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => selectElection(e)}
                    className="w-full bg-canvas border border-hairline hover:border-primary rounded-xl p-6 text-left transition-all group shadow-sm flex items-center justify-between cursor-pointer"
                  >
                    <div className="min-w-0 pr-4">
                      <h3 className="text-lg font-semibold text-ink group-hover:text-primary transition">
                        {e.title}
                      </h3>
                      <p className="text-sm text-body mt-1 line-clamp-2">
                        {e.description}
                      </p>
                    </div>
                    <ChevronRight className="text-muted group-hover:text-primary transition shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}

          {/* Results list */}
          {!selectedElection && !viewingResults && portalView === 'results' && (
            <div className="space-y-4">
              <h2 className="text-center text-2xl font-display font-normal text-ink tracking-tight mb-6">Completed Ballots</h2>
              {completedElections.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-hairline rounded-xl bg-canvas shadow-sm">
                  <Trophy size={36} className="text-muted mx-auto mb-4" />
                  <p className="text-ink font-semibold">No results published</p>
                  <p className="text-body text-sm mt-1">Outcome data will appear once the active voting phase has concluded.</p>
                </div>
              ) : (
                completedElections.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setViewingResults(e)}
                    className="w-full bg-canvas border border-hairline hover:border-primary rounded-xl p-6 text-left transition-all group shadow-sm flex items-center justify-between cursor-pointer"
                  >
                    <div className="min-w-0 pr-4">
                      <span className="text-[10px] font-semibold bg-surface-strong px-2 py-0.5 rounded-full text-muted uppercase tracking-wider">
                        Archive
                      </span>
                      <h3 className="text-lg font-semibold text-ink group-hover:text-primary transition mt-2">
                        {e.title}
                      </h3>
                      <p className="text-sm text-body mt-1 line-clamp-2">{e.description}</p>
                    </div>
                    <ChevronRight className="text-muted group-hover:text-primary transition shrink-0" />
                  </button>
                ))
              )}
            </div>
          )}

          {/* Ballot Submission Form */}
          {selectedElection && !voteSuccess && (
            <div className="bg-canvas border border-hairline rounded-xl overflow-hidden shadow-sm">
              
              <div className="bg-surface-soft border-b border-hairline p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-semibold text-primary uppercase tracking-widest block mb-1">BALLOT ENVELOPE</span>
                  <h2 className="text-lg font-semibold text-ink leading-tight">{selectedElection.title}</h2>
                </div>
                <button
                  onClick={() => {
                    setSelectedElection(null);
                    setOtpSent(false);
                    setCandidates([]);
                  }}
                  className="text-xs bg-canvas hover:bg-surface-soft border border-hairline text-ink px-4 py-2 rounded-full font-medium transition cursor-pointer"
                >
                  Change Ballot
                </button>
              </div>

              <div className="p-6 md:p-8 space-y-8">
                {error && (
                  <div className="bg-canvas border border-semantic-down text-semantic-down rounded-xl p-4 flex items-start gap-3 text-sm">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Candidate Selector */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-ink flex items-center gap-2.5 text-sm">
                    <span className="w-5.5 h-5.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold font-mono">
                      1
                    </span>
                    Select Candidate
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {candidates.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCandidate(c.id)}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          selectedCandidate === c.id
                            ? 'bg-primary/5 border-primary shadow-sm'
                            : 'bg-canvas border-hairline hover:border-body'
                        }`}
                      >
                        <span className="text-3xl block mb-2">{c.symbol || '🗳️'}</span>
                        <p className="font-bold text-ink text-base truncate">{c.name}</p>
                        <p className="text-xs text-body font-semibold truncate mt-0.5">{c.party}</p>
                        
                        {selectedCandidate === c.id && (
                          <div className="mt-3 flex items-center gap-1 text-primary text-xs font-bold bg-primary/10 w-fit px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 size={11} /> 
                            <span>Selected</span>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Identity verification */}
                <div className={`space-y-4 transition duration-300 ${selectedCandidate !== null ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                  <h3 className="font-semibold text-ink flex items-center gap-2.5 text-sm">
                    <span className="w-5.5 h-5.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold font-mono">
                      2
                    </span>
                    Verify Identity
                  </h3>

                  {!otpSent ? (
                    <form onSubmit={requestOtp} className="flex gap-3">
                      <div className="relative flex-1">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                        <input
                          type="email"
                          required
                          placeholder="registered@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-canvas border border-hairline focus:border-primary text-ink pl-11 pr-4 py-3 rounded-lg outline-none transition text-sm placeholder:text-muted"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={verifying || !email}
                        className="bg-primary hover:bg-primary-active text-white px-6 rounded-full font-semibold text-sm transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer shadow-sm"
                      >
                        {verifying ? <Loader2 size={14} className="animate-spin" /> : 'Send OTP'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={castVote} className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3.5 text-xs text-green-700 font-semibold flex items-center gap-2">
                        <CheckCircle2 size={14} /> 
                        <span>Verification code dispatched to {email}</span>
                      </div>
                      
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                          <input
                            type="text"
                            required
                            placeholder="123456"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="w-full bg-canvas border border-hairline focus:border-primary text-ink pl-11 pr-4 py-3 rounded-lg outline-none transition font-mono tracking-widest text-lg"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={verifying || otp.length < 6}
                          className="flex items-center gap-2 bg-primary hover:bg-primary-active text-white px-6 rounded-full font-semibold text-sm transition-all shadow-sm disabled:opacity-50 whitespace-nowrap cursor-pointer"
                        >
                          {verifying ? (
                            <><Loader2 size={14} className="animate-spin" /> Transacting...</>
                          ) : (
                            <><Vote size={14} /> Submit Vote</>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Success screen */}
          {voteSuccess && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-canvas border border-hairline rounded-xl p-8 md:p-10 text-center shadow-sm"
            >
              <div className="w-16 h-16 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-2xl font-display font-normal text-ink mb-3">Vote Securing on Blockchain</h2>
              
              <p className="text-body text-sm mb-6 max-w-sm mx-auto leading-relaxed">
                Your ballot for <strong className="text-ink font-semibold">{candidates.find((c) => c.id === selectedCandidate)?.name}</strong> has been received by relayer node. Cryptographic validation receipt has been forwarded.
              </p>

              <div className="bg-surface-soft border border-hairline rounded-lg p-4 inline-block text-left mb-8 max-w-full">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Cryptographic Receipt Hash</p>
                <code className="text-green-700 font-mono text-xs break-all selection:bg-green-150">
                  {txHash}
                </code>
              </div>

              <div className="flex flex-col gap-3">
                <Link
                  href={`/verify?txHash=${encodeURIComponent(txHash || '')}`}
                  className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  <ShieldCheck size={15} /> 
                  <span>Validate receipt on-chain</span>
                </Link>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs font-semibold text-muted hover:text-ink transition cursor-pointer"
                >
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

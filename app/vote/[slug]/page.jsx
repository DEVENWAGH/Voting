"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Building2,
  Mail,
  Lock,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Vote,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

export default function VoterPortal() {
  const { slug } = useParams();
  const [org, setOrg] = useState(null);
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Auth & flow state
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
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
      // Get Org info
      const orgRes = await fetch(`/api/orgs/register?slug=${slug}`);
      const orgData = await orgRes.json();
      if (!orgRes.ok)
        throw new Error(orgData.error || "Organization not found");
      setOrg(orgData.org);

      // Get Elections scoped to this org
      const elRes = await fetch(`/api/org/${slug}/elections`);
      const elData = await elRes.json();
      if (!elRes.ok) throw new Error(elData.error);

      // Filter for live elections (Phase 1 = Voting) AND guardian approved
      const live = (elData.elections || []).filter(
        (e) => e.phase === 1 && e.guardianApproved,
      );
      setElections(live);
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
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    // Fix: selectedCandidate can be 0 (first candidate), so check for null explicitly
    if (selectedCandidate === null || selectedCandidate === undefined) {
      setError("Please select a candidate first");
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  if (loading)
    return (
      <div className="min-h-screen bg-[#020617] flex justify-center items-center">
        <Loader2 size={36} className="animate-spin text-indigo-500" />
      </div>
    );

  if (error && !org)
    return (
      <div className="min-h-screen bg-[#020617] flex justify-center items-center p-6 text-center">
        <div>
          <Building2 size={48} className="text-slate-800 mx-auto mb-4" />
          <h1 className="text-white text-xl font-bold mb-2">
            Portal Not Found
          </h1>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#020617] text-white relative flex flex-col">
      {/* Top Navbar */}
      <nav className="border-b border-white/5 bg-slate-950/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-500/20 flex items-center justify-center">
            {org.logoUrl ? (
              <img
                src={org.logoUrl}
                alt={org.name}
                className="w-6 h-6 object-contain"
              />
            ) : (
              <Building2 size={20} className="text-indigo-400" />
            )}
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{org.name}</h1>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Voter Portal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full font-medium">
          <ShieldCheck size={14} className="text-green-500" /> Secured by Aegis
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 pb-20">
        <div className="w-full max-w-xl">
          {/* STEP 1: Select Election */}
          {!selectedElection && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <h2 className="text-2xl font-black mb-6 text-center">
                Live Elections
              </h2>
              {elections.length === 0 ? (
                <div className="text-center py-16 border border-slate-800 border-dashed rounded-2xl bg-slate-900/30">
                  <Vote size={48} className="text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-400 font-semibold">
                    No active elections
                  </p>
                  <p className="text-slate-500 text-sm mt-1">
                    Check back later when an election is live.
                  </p>
                </div>
              ) : (
                elections.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => selectElection(e)}
                    className="w-full bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-left transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition">
                          {e.title}
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">
                          {e.description}
                        </p>
                      </div>
                      <ChevronRight className="text-slate-600 group-hover:text-indigo-400 transition" />
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* STEP 2: Voting Flow */}
          {selectedElection && !voteSuccess && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl animate-in zoom-in-95">
              <div className="bg-slate-950/80 border-b border-slate-800 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-indigo-400 font-bold uppercase tracking-wider mb-1">
                    Casting Ballot
                  </p>
                  <h2 className="text-xl font-bold">
                    {selectedElection.title}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setSelectedElection(null);
                    setOtpSent(false);
                    setCandidates([]);
                  }}
                  className="text-xs text-slate-500 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition shrink-0"
                >
                  Change Election
                </button>
              </div>

              <div className="p-6 sm:p-8 space-y-8">
                {/* Error Banner */}
                {error && (
                  <div className="bg-red-950/60 border border-red-800 text-red-300 rounded-xl p-4 flex items-start gap-3 text-sm">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}

                {/* Select Candidate */}
                <div className="space-y-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-950 text-indigo-400 flex items-center justify-center text-xs border border-indigo-500/20">
                      1
                    </span>{" "}
                    Select your candidate
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {candidates.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCandidate(c.id)}
                        className={`p-4 rounded-2xl border text-left transition ${
                          selectedCandidate === c.id
                            ? "bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20"
                            : "bg-slate-950/50 border-slate-800 hover:border-slate-600"
                        }`}
                      >
                        <div className="text-2xl mb-2">{c.symbol || "🗳️"}</div>
                        <p className="font-bold text-white text-base truncate">
                          {c.name}
                        </p>
                        <p className="text-xs text-slate-400 font-semibold truncate">
                          {c.party}
                        </p>
                        {selectedCandidate === c.id && (
                          <div className="mt-3 flex items-center gap-1.5 text-indigo-400 text-xs font-bold bg-indigo-950/50 w-fit px-2 py-1 rounded-md">
                            <CheckCircle2 size={12} /> Selected
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Identity Verification */}
                <div
                  className={`space-y-4 transition duration-500 ${selectedCandidate !== null ? "opacity-100" : "opacity-40 pointer-events-none"}`}
                >
                  <h3 className="font-bold flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-950 text-indigo-400 flex items-center justify-center text-xs border border-indigo-500/20">
                      2
                    </span>{" "}
                    Verify your identity
                  </h3>

                  {!otpSent ? (
                    <form onSubmit={requestOtp} className="flex gap-3">
                      <div className="relative flex-1">
                        <Mail
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                          size={18}
                        />
                        <input
                          type="email"
                          required
                          placeholder="Enter your registered email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 text-white pl-11 pr-4 py-3 rounded-xl outline-none transition text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={verifying || !email}
                        className="bg-slate-100 hover:bg-white text-slate-900 px-6 rounded-xl font-bold text-sm transition disabled:opacity-50 whitespace-nowrap"
                      >
                        {verifying ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          "Send OTP"
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={castVote} className="space-y-4">
                      <div className="bg-green-950/30 border border-green-800/50 rounded-xl p-4 text-sm text-green-400 flex items-center gap-2">
                        <CheckCircle2 size={16} /> OTP sent to {email}
                      </div>
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <Lock
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                            size={18}
                          />
                          <input
                            type="text"
                            required
                            placeholder="Enter 6-digit OTP"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 text-white pl-11 pr-4 py-3 rounded-xl outline-none transition font-mono tracking-widest text-lg"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={verifying || otp.length < 6}
                          className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white px-8 rounded-xl font-bold transition shadow-lg shadow-indigo-900/50 disabled:opacity-50 whitespace-nowrap"
                        >
                          {verifying ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />{" "}
                              Verifying…
                            </>
                          ) : (
                            <>
                              <Vote size={18} /> Cast Vote
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Success */}
          {voteSuccess && (
            <div className="bg-slate-900/60 border border-green-800 rounded-3xl p-10 text-center animate-in zoom-in">
              <div className="w-20 h-20 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="text-green-400" />
              </div>
              <h2 className="text-3xl font-black text-white mb-3">
                Vote Cast Successfully
              </h2>
              <p className="text-slate-400 mb-8 max-w-md mx-auto">
                Your vote for{" "}
                <strong className="text-white">
                  {candidates.find((c) => c.id === selectedCandidate)?.name}
                </strong>{" "}
                has been cryptographically secured on the blockchain.
              </p>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 inline-block text-left mb-8">
                <p className="text-xs text-slate-500 uppercase font-semibold mb-1">
                  Transaction Hash (Receipt)
                </p>
                <code className="text-green-400 font-mono text-sm break-all">
                  {txHash}
                </code>
              </div>
              <br />
              <button
                onClick={() => window.location.reload()}
                className="text-sm font-bold text-slate-400 hover:text-white transition underline underline-offset-4"
              >
                Return Home
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  PHASE, PHASE_COLOR, formatDate, serializeElection, serializeCandidate,
} from '@/lib/contract';
import {
  Loader2, Trophy, ChevronLeft, AlertCircle, Calendar, Vote, User
} from 'lucide-react';
import Link from 'next/link';
import { ethers } from 'ethers';

// Read-only contract fetching (no wallet required)
async function getReadContract() {
  const abi = (await import('@/lib/contracts/VotingV1.json', { assert: { type: 'json' } })).default.abi;
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545');
  return new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS, abi, provider);
}

export default function PublicElectionDetailPage() {
  const { id } = useParams();
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [results, setResults] = useState([]);
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      
      const contract = await getReadContract();

      const electionRaw = await contract.getElection(id);
      const e = serializeElection(electionRaw);
      setElection(e);

      // We only care about full details in Phase 2 (Completed)
      // Otherwise, we just show the basics.
      if (e.phase === 2) {
        const resRaw = await contract.getElectionResults(id);
        const sortedRes = resRaw.map(serializeCandidate).sort((a, b) => b.voteCount - a.voteCount);
        setResults(sortedRes);
        
        try {
          const winnerRaw = await contract.getWinner(id);
          setWinner(serializeCandidate(winnerRaw));
        } catch (we) {
          // It's possible there is a tie or 0 votes total
          console.warn('Could not determine single winner:', we);
        }
      } else {
        const cands = await contract.getCandidates(id);
        setCandidates(cands.map(serializeCandidate));
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load election details. ID may be invalid or node is offline.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex justify-center items-center">
        <Loader2 className="animate-spin text-indigo-500" size={44} />
      </div>
    );
  }

  if (!election || error) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <p className="text-xl text-white font-bold mb-2">Election not found</p>
        <p className="text-slate-400 mb-6">{error || 'This election does not exist on the blockchain.'}</p>
        <Link href="/elections" className="text-indigo-400 hover:text-indigo-300 font-bold px-6 py-2.5 bg-indigo-500/10 rounded-full transition">
          ← Back to Ledger
        </Link>
      </div>
    );
  }

  const phase = election.phase;

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* Navbar */}
      <nav className="border-b border-white/5 bg-slate-950/80 px-6 md:px-16 py-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-xl">
        <Link href="/elections" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition">
          <ChevronLeft size={16} /> Back to Ledger
        </Link>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full font-mono">
          ID: {id}
        </div>
      </nav>

      <div className="px-6 md:px-16 py-10 max-w-5xl mx-auto">
        
        {/* Election header */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 md:p-10 mb-8 backdrop-blur-xl relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-1 ${phase === 2 ? 'bg-gradient-to-r from-green-400 to-cyan-500' : 'bg-slate-800'}`} />
          
          <div className={`inline-flex text-xs font-bold px-3 py-1 rounded-full border mb-6 ${PHASE_COLOR[phase].replace('bg-', 'bg-').replace('border-', 'border-').replace('text-', 'text-')}`}>
            {PHASE[phase]}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">{election.title}</h1>
          <p className="text-slate-400 text-lg mb-8 max-w-3xl leading-relaxed">{election.description}</p>
          
          <div className="flex flex-wrap gap-4 text-sm font-medium">
            <div className="flex items-center gap-2 bg-slate-950/50 border border-slate-800 px-4 py-2 rounded-xl text-slate-300">
              <Calendar size={16} className="text-indigo-400" />
              <span>Starts: <span className="text-white">{formatDate(election.startTime)}</span></span>
            </div>
            <div className="flex items-center gap-2 bg-slate-950/50 border border-slate-800 px-4 py-2 rounded-xl text-slate-300">
              <Calendar size={16} className="text-indigo-400" />
              <span>Ends: <span className="text-white">{formatDate(election.endTime)}</span></span>
            </div>
          </div>
        </div>

        {/* Phase 0 & 1 Content */}
        {(phase === 0 || phase === 1) && (
          <div className="text-center py-16 bg-slate-900/30 border border-slate-800 border-dashed rounded-3xl">
            <Vote size={48} className="text-slate-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">
              {phase === 0 ? 'Registration in Progress' : 'Voting is Live'}
            </h2>
            <p className="text-slate-400 max-w-md mx-auto">
              {phase === 0 
                ? 'Candidates are currently being added. Results will be available once the election is completed.'
                : 'Voting is currently active. To protect voter privacy, live tallies are hidden until the election ends.'}
            </p>
            {phase === 1 && (
              <p className="mt-4 text-sm text-indigo-400 font-semibold">
                If you are a registered voter, check your email for the voting link provided by your organization.
              </p>
            )}
          </div>
        )}

        {/* Phase 2 Content — Results */}
        {phase === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Winner banner */}
            {winner ? (
              <div className="bg-gradient-to-br from-yellow-900/30 to-amber-900/10 border border-yellow-700/50 rounded-3xl p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 text-center md:text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />
                
                <div className="w-24 h-24 rounded-full bg-yellow-950 border-2 border-yellow-500/30 flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                  <Trophy size={48} className="text-yellow-400" />
                </div>
                <div>
                  <p className="text-yellow-500 text-sm font-black uppercase tracking-widest mb-2 flex items-center justify-center md:justify-start gap-2">
                    Winner Declared
                  </p>
                  <h2 className="text-4xl font-black text-white mb-2">{winner.name}</h2>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <span className="text-amber-200 font-semibold bg-amber-950/50 px-3 py-1 rounded-lg border border-amber-800/50">
                      {winner.party}
                    </span>
                    <span className="text-white font-bold bg-slate-900 border border-slate-700 px-3 py-1 rounded-lg">
                      {winner.voteCount} valid vote{winner.voteCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 text-center">
                <p className="text-slate-400 font-semibold">No definitive winner could be declared (tie or zero votes).</p>
              </div>
            )}

            {/* Results table */}
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Vote className="text-indigo-400" size={24} /> Official Final Tally
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {results.map((c, rank) => {
                  const maxVotes = Math.max(...results.map(r => r.voteCount), 1);
                  const percentage = ((c.voteCount / maxVotes) * 100).toFixed(1);
                  const isWinner = winner && c.id === winner.id;
                  
                  return (
                    <div key={c.id} className={`bg-slate-900/60 border rounded-2xl p-6 relative overflow-hidden ${
                      isWinner ? 'border-yellow-600/50 shadow-[0_0_15px_rgba(234,179,8,0.05)]' : 'border-slate-800'
                    }`}>
                      {isWinner && <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500" />}
                      
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl border ${
                            isWinner ? 'bg-yellow-950/50 border-yellow-500/20' : 'bg-slate-950 border-slate-800'
                          }`}>
                            {c.symbol || <User size={20} className="text-slate-500" />}
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-lg leading-tight">{c.name}</h3>
                            <p className="text-xs text-slate-400 font-medium">{c.party}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-2xl font-black ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
                            {c.voteCount}
                          </span>
                          <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider">Votes</span>
                        </div>
                      </div>
                      
                      {/* Vote bar */}
                      <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${
                            isWinner ? 'bg-yellow-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

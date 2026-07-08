'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  PHASE, PHASE_COLOR, formatDate, serializeElection, serializeCandidate,
} from '@/lib/contract';
import {
  Loader2, Trophy, ChevronLeft, AlertCircle, Calendar, Vote, User
} from 'lucide-react';
import Link from 'next/link';
import { ethers } from 'ethers';
import ThemeToggle from '@/components/ThemeToggle';

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

      if (e.phase === 2) {
        const resRaw = await contract.getElectionResults(id);
        const sortedRes = resRaw.map(serializeCandidate).sort((a, b) => b.voteCount - a.voteCount);
        setResults(sortedRes);
        
        try {
          const winnerRaw = await contract.getWinner(id);
          setWinner(serializeCandidate(winnerRaw));
        } catch (we) {
          console.warn('Could not determine winner:', we);
        }
      } else {
        const cands = await contract.getCandidates(id);
        setCandidates(cands.map(serializeCandidate));
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load election details. ID may be invalid or blockchain node is unreachable.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex justify-center items-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!election || error) {
    return (
      <div className="min-h-screen bg-surface-soft flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-canvas border border-hairline rounded-xl p-8 max-w-md shadow-sm">
          <AlertCircle size={40} className="text-semantic-down mx-auto mb-4" />
          <p className="text-xl text-ink font-semibold mb-2">Record Not Found</p>
          <p className="text-body text-sm mb-6">{error || 'This ballot ID does not exist on-chain.'}</p>
          <Link href="/elections" className="inline-flex bg-primary hover:bg-primary-active text-white font-semibold px-6 py-2.5 rounded-full text-sm transition-all shadow-sm">
            ← Return to Directory
          </Link>
        </div>
      </div>
    );
  }

  const phase = election.phase;

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      
      {/* Navbar */}
      <nav className="border-b border-hairline bg-canvas/80 backdrop-blur-md px-6 md:px-16 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/elections" className="flex items-center gap-2 text-sm text-body hover:text-ink transition font-semibold">
          <ChevronLeft size={16} /> 
          <span>Elections Directory</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="flex items-center gap-2 text-xs text-muted bg-surface-soft border border-hairline px-3 py-1.5 rounded-full font-mono font-medium">
            BALLOT ID: {id}
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="px-6 md:px-16 py-12 max-w-4xl mx-auto w-full">
        
        {/* Banner */}
        <div className="bg-canvas border border-hairline rounded-xl p-8 md:p-10 mb-8 shadow-sm relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-1 ${phase === 2 ? 'bg-gradient-to-r from-emerald-400 to-primary/85' : 'bg-primary/25'}`} />
          
          <div className="mb-4">
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
              phase === 2 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
              phase === 1 ? 'text-amber-700 bg-amber-50 border-amber-200' :
                            'text-primary bg-primary/5 border-primary/25'
            }`}>
              {phase === 2 ? 'Completed' : phase === 1 ? 'Voting Active' : 'Registration'}
            </span>
          </div>

          <h1 className="text-3xl md:text-4xl font-display font-normal tracking-tight text-ink mb-4">{election.title}</h1>
          <p className="text-body text-base leading-relaxed mb-6 max-w-2xl">{election.description}</p>
          
          <div className="flex flex-wrap gap-3 text-xs font-semibold">
            <div className="flex items-center gap-2 bg-surface-soft border border-hairline px-4 py-2 rounded-full text-body font-mono">
              <Calendar size={14} className="text-primary" />
              <span>Starts: <span className="text-ink">{formatDate(election.startTime)}</span></span>
            </div>
            <div className="flex items-center gap-2 bg-surface-soft border border-hairline px-4 py-2 rounded-full text-body font-mono">
              <Calendar size={14} className="text-primary" />
              <span>Ends: <span className="text-ink">{formatDate(election.endTime)}</span></span>
            </div>
          </div>
        </div>

        {/* Dynamic phases layout */}
        {(phase === 0 || phase === 1) && (
          <div className="text-center py-16 bg-surface-soft/40 border border-dashed border-hairline rounded-xl shadow-sm">
            <Vote size={36} className="text-muted mx-auto mb-4" />
            <h2 className="text-xl font-display font-normal text-ink mb-2">
              {phase === 0 ? 'Ballot Initialization' : 'Voting is Underway'}
            </h2>
            <p className="text-body text-sm max-w-md mx-auto leading-relaxed px-4">
              {phase === 0 
                ? 'The ballot registry is currently being initialized. Dynamic updates will appear here once official polling starts.'
                : 'Ballot lines are open. To maintain voter secrecy, tallies remain encrypted until the election completes.'}
            </p>
            {phase === 1 && (
              <div className="mt-6 bg-primary/5 border border-primary/20 rounded-lg p-4 max-w-sm mx-auto text-xs text-primary font-semibold">
                Please follow the authentication link sent to your registered email to cast your ballot.
              </div>
            )}
          </div>
        )}

        {/* Phase 2: Completed Tally */}
        {phase === 2 && (
          <div className="space-y-8">
            
            {/* Winner Badge */}
            {winner ? (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-canvas border border-accent-yellow rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 shadow-sm relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-full bg-surface-soft border border-hairline flex items-center justify-center shrink-0 text-amber-500 shadow-sm">
                  <Trophy size={28} />
                </div>
                <div className="text-center md:text-left min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-accent-yellow uppercase tracking-widest block mb-1">
                    WINNING CANDIDATE
                  </span>
                  <h2 className="text-2xl font-semibold text-ink truncate leading-tight">{winner.name}</h2>
                  
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2">
                    <span className="text-xs font-semibold bg-surface-strong px-2.5 py-0.5 rounded-full text-ink">
                      {winner.party}
                    </span>
                    <span className="text-xs font-semibold font-mono bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                      {winner.voteCount} votes cast
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-canvas border border-hairline rounded-xl p-6 text-center text-body text-sm shadow-sm">
                No definitive winner declared (zero ballots cast or tie-break required).
              </div>
            )}

            {/* Results Grid */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                <Vote size={18} className="text-primary" />
                Official Audit Tallies
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.map((c, rank) => {
                  const maxVotes = Math.max(...results.map(r => r.voteCount), 1);
                  const percentage = ((c.voteCount / maxVotes) * 100).toFixed(1);
                  const isWinner = winner && c.id === winner.id;
                  
                  return (
                    <div key={c.id} className={`bg-canvas border rounded-xl p-5 relative overflow-hidden shadow-sm transition-all ${
                      isWinner ? 'border-accent-yellow' : 'border-hairline hover:border-body'
                    }`}>
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-surface-strong border border-hairline flex items-center justify-center text-lg overflow-hidden shrink-0">
                            {c.symbol ? c.symbol : <User size={18} className="text-muted" />}
                          </div>
                          <div>
                            <h3 className="font-semibold text-ink text-sm leading-tight">{c.name}</h3>
                            <p className="text-[11px] text-body mt-0.5">{c.party}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-display font-normal text-ink font-mono block leading-none">
                            {c.voteCount}
                          </span>
                          <span className="text-[9px] font-semibold text-muted uppercase tracking-wider mt-1 block">Votes</span>
                        </div>
                      </div>
                      
                      {/* Spring Progress */}
                      <div className="h-2 bg-surface-strong rounded-full overflow-hidden relative z-10">
                        <motion.div
                          className={`h-full rounded-full ${isWinner ? 'bg-accent-yellow' : 'bg-primary'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ type: 'spring', stiffness: 50, damping: 15 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

    </div>
  );
}

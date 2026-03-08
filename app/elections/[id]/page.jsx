'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import {
  PHASE, PHASE_COLOR, formatDate, serializeElection, serializeCandidate,
} from '@/lib/contract';
import {
  Loader2, Vote, CheckCircle, Trophy, Users, ChevronLeft, AlertCircle, ScrollText,
} from 'lucide-react';
import Link from 'next/link';

export default function ElectionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { contract, readContract, account } = useWallet();

  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [results, setResults] = useState([]);
  const [winner, setWinner] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');
  const [voteSuccess, setVoteSuccess] = useState(false);

  useEffect(() => {
    if (!account) { router.replace('/connect-wallet'); return; }
    loadData();
  }, [readContract, account, id]);

  const loadData = async () => {
    if (!readContract || !id) return;
    try {
      setLoading(true);
      setError('');

      const electionRaw = await readContract.getElection(id);
      const e = serializeElection(electionRaw);
      setElection(e);

      const cands = await readContract.getCandidates(id);
      setCandidates(cands.map(serializeCandidate));

      if (account) {
        const voted = await readContract.hasVoted(id, account);
        setHasVoted(voted);

        const voter = await readContract.voters(account);
        setIsRegistered(voter.isRegistered);
      }

      if (e.phase === 2) {
        const resRaw = await readContract.getElectionResults(id);
        setResults(resRaw.map(serializeCandidate));
        const winnerRaw = await readContract.getWinner(id);
        setWinner(serializeCandidate(winnerRaw));
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load election details.');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async () => {
    if (selectedCandidate === null) return;
    try {
      setVoting(true);
      setError('');
      const tx = await contract.castVote(id, selectedCandidate);
      await tx.wait();
      setVoteSuccess(true);
      setHasVoted(true);
      await loadData();
    } catch (err) {
      console.error(err);
      const msg = err?.reason || err?.data?.message || err?.message || '';
      if (msg.includes('not registered')) setError('You must register as a voter first.');
      else if (msg.includes('Already voted')) setError('You have already voted in this election.');
      else if (msg.includes('not in Voting phase')) setError('This election is not in the Voting phase.');
      else setError('Failed to cast vote. Please try again.');
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex justify-center items-center bg-gray-950">
        <Loader2 className="animate-spin text-green-400" size={44} />
      </div>
    );
  }

  if (!election) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-gray-950 text-gray-400">
        <p className="text-xl mb-4">Election not found.</p>
        <Link href="/elections" className="text-green-400 hover:underline">← Back to Elections</Link>
      </div>
    );
  }

  const phase = election.phase;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-950 text-white px-6 md:px-16 py-10">
      {/* Back */}
      <Link href="/elections" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-green-400 mb-6 transition">
        <ChevronLeft size={16} /> All Elections
      </Link>

      {/* Election header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-8">
        <div className={`inline-flex text-xs font-bold px-3 py-1 rounded-full border mb-4 ${PHASE_COLOR[phase]}`}>
          {PHASE[phase]}
        </div>
        <h1 className="text-4xl font-extrabold mb-3">{election.title}</h1>
        <p className="text-gray-300 mb-4 max-w-2xl">{election.description}</p>
        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
          <span>📅 Start: {formatDate(election.startTime)}</span>
          <span>📅 End: {formatDate(election.endTime)}</span>
          <span>👥 Candidates: {candidates.length}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-900/20 border border-red-700 text-red-300 rounded-xl p-4 mb-6 text-sm">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* === REGISTRATION PHASE === */}
      {phase === 0 && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-2xl p-8 text-center">
          <ScrollText size={48} className="text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-blue-300 mb-2">Registration Phase</h2>
          <p className="text-gray-400">
            This election is currently in the Registration phase. The Election Commission is adding candidates.
            Voting will begin when the Commission transitions to the Voting phase.
          </p>
        </div>
      )}

      {/* === VOTING PHASE === */}
      {phase === 1 && (
        <>
          {/* Not registered */}
          {!isRegistered && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-2xl p-6 mb-6 flex items-start gap-3">
              <AlertCircle size={20} className="text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-300">You are not a registered voter</p>
                <p className="text-sm text-gray-400 mt-1">
                  You must{' '}
                  <Link href="/register" className="text-green-400 hover:underline">register as a voter</Link>
                  {' '}before you can cast a vote.
                </p>
              </div>
            </div>
          )}

          {/* Already voted */}
          {isRegistered && (hasVoted || voteSuccess) && (
            <div className="bg-green-900/20 border border-green-700 rounded-2xl p-6 mb-6 flex items-center gap-3">
              <CheckCircle size={24} className="text-green-400" />
              <p className="text-green-300 font-semibold">You have already cast your vote in this election.</p>
            </div>
          )}

          {/* Voting form */}
          {isRegistered && !hasVoted && !voteSuccess && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1">Cast Your Vote</h2>
              <p className="text-gray-400 text-sm mb-6">Select a candidate and confirm your vote. This action is irreversible.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCandidate(c.id)}
                    className={`text-left bg-gray-900 border rounded-2xl p-6 transition cursor-pointer ${
                      selectedCandidate === c.id
                        ? 'border-green-500 ring-2 ring-green-500/30 bg-green-900/10'
                        : 'border-gray-700 hover:border-green-600'
                    }`}
                  >
                    <div className="text-3xl mb-3">{c.symbol || '🗳️'}</div>
                    <h3 className="text-lg font-bold">{c.name}</h3>
                    <p className="text-green-400 text-sm font-medium">{c.party}</p>
                    {c.manifesto && (
                      <p className="text-gray-400 text-xs mt-2 line-clamp-3">{c.manifesto}</p>
                    )}
                    {selectedCandidate === c.id && (
                      <div className="mt-3 flex items-center gap-1 text-green-400 text-xs font-bold">
                        <CheckCircle size={14} /> Selected
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {selectedCandidate !== null && (
                <div className="mt-8 text-center">
                  <button
                    onClick={handleVote}
                    disabled={voting}
                    className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-60 px-10 py-3 rounded-xl text-lg font-semibold transition shadow-lg shadow-green-900/30"
                  >
                    {voting ? (
                      <><Loader2 className="animate-spin" size={20} /> Casting Vote...</>
                    ) : (
                      <><Vote size={20} /> Confirm Vote for {candidates.find(c => c.id === selectedCandidate)?.name}</>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Candidates view for already-voted */}
          {(hasVoted || voteSuccess) && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {candidates.map((c) => (
                <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                  <div className="text-3xl mb-3">{c.symbol || '🗳️'}</div>
                  <h3 className="text-lg font-bold">{c.name}</h3>
                  <p className="text-green-400 text-sm font-medium">{c.party}</p>
                  {c.manifesto && <p className="text-gray-400 text-xs mt-2 line-clamp-3">{c.manifesto}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* === COMPLETED PHASE — Results === */}
      {phase === 2 && winner && (
        <>
          {/* Winner banner */}
          <div className="bg-yellow-900/20 border border-yellow-600 rounded-2xl p-8 mb-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <Trophy size={56} className="text-yellow-400 shrink-0" />
            <div>
              <p className="text-yellow-300 text-sm font-bold uppercase tracking-wider mb-1">🏆 Winner</p>
              <h2 className="text-3xl font-extrabold">{winner.name}</h2>
              <p className="text-green-400 font-semibold">{winner.party}</p>
              <p className="text-gray-300 mt-1">
                {winner.voteCount} vote{winner.voteCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Results table */}
          <h2 className="text-2xl font-bold mb-5">Full Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {results
              .slice()
              .sort((a, b) => b.voteCount - a.voteCount)
              .map((c, rank) => (
                <div
                  key={c.id}
                  className={`bg-gray-900 border rounded-2xl p-6 ${
                    c.id === winner.id ? 'border-yellow-600' : 'border-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{c.symbol || '🗳️'}</span>
                      {rank === 0 && <Trophy size={16} className="text-yellow-400" />}
                    </div>
                    <span className={`text-lg font-bold ${c.id === winner.id ? 'text-yellow-400' : 'text-green-400'}`}>
                      {c.voteCount} votes
                    </span>
                  </div>
                  <h3 className="text-lg font-bold">{c.name}</h3>
                  <p className="text-green-400 text-sm font-medium">{c.party}</p>

                  {/* Vote bar */}
                  {results.length > 0 && (
                    <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{
                          width: `${
                            Math.max(...results.map(r => r.voteCount)) === 0
                              ? 0
                              : (c.voteCount / Math.max(...results.map(r => r.voteCount))) * 100
                          }%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

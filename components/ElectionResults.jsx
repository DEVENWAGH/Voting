'use client';

import { useState, useEffect } from 'react';
import { Trophy, Vote, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const OP_LABELS = {
  register_voter: 'Voter Registration',
  cast_vote: 'Vote Cast',
  create_election: 'Create Election',
  add_candidate: 'Add Candidate',
  transition_phase: 'Phase Transition',
};

export function operationLabel(op) {
  return OP_LABELS[op] || op;
}

export default function ElectionResults({ slug, electionId, electionTitle, compact = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug || electionId == null) return;
    setLoading(true);
    setError('');
    fetch(`/api/org/${slug}/elections/${electionId}/results`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success && d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, electionId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-canvas border border-semantic-down rounded-xl p-4 flex items-start gap-3 text-sm text-semantic-down">
        <AlertCircle size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Error retrieving results</p>
          <p className="text-xs opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { candidates, winner, totalVotes } = data;
  const maxVotes = Math.max(...candidates.map((c) => c.voteCount), 1);

  return (
    <div className={compact ? 'space-y-4' : 'space-y-8'}>
      {!compact && (
        <div className="flex items-center justify-between border-b border-hairline pb-4">
          <h3 className="font-display font-normal text-xl tracking-tight text-ink flex items-center gap-2">
            <Vote size={18} className="text-primary" />
            Official Results — {electionTitle || data.election?.title}
          </h3>
          <span className="text-xs font-mono font-medium bg-surface-strong px-2.5 py-1 rounded-full text-ink">
            {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {winner && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-canvas border border-accent-yellow rounded-xl p-5 flex items-center gap-4 shadow-sm"
        >
          <div className="w-12 h-12 rounded-full bg-surface-soft border border-hairline flex items-center justify-center text-2xl shrink-0">
            {winner.symbol || '🏆'}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-accent-yellow font-semibold uppercase tracking-wider flex items-center gap-1">
              <Trophy size={12} /> Winner Declared
            </p>
            <p className="text-ink font-normal text-xl truncate">{winner.name}</p>
            <p className="text-body text-sm font-mono">{winner.party} · {winner.voteCount} votes</p>
          </div>
        </motion.div>
      )}

      <div className="space-y-4">
        {candidates.map((c, rank) => {
          const pct = totalVotes > 0 ? ((c.voteCount / totalVotes) * 100).toFixed(1) : '0.0';
          const barWidth = ((c.voteCount / maxVotes) * 100).toFixed(1);
          const isWinner = winner && c.id === winner.id;

          return (
            <div
              key={c.id}
              className={`relative overflow-hidden rounded-xl border p-4 transition-all ${
                isWinner
                  ? 'bg-canvas border-accent-yellow/40 shadow-sm'
                  : 'bg-canvas border-hairline hover:border-body/30'
              }`}
            >
              {/* Animated Progress Bar */}
              <motion.div
                className="absolute inset-y-0 left-0 bg-primary/5 origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Number(barWidth) / 100 }}
                transition={{ type: 'spring', stiffness: 80, damping: 15, delay: rank * 0.1 }}
                style={{ width: '100%' }}
              />

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-muted font-mono text-sm w-6">#{rank + 1}</span>
                  <span className="text-2xl">{c.symbol || '🗳️'}</span>
                  <div className="min-w-0">
                    <p className="font-normal text-ink text-base truncate">{c.name}</p>
                    <p className="text-xs text-muted truncate">{c.party}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-medium text-ink text-lg leading-none">{c.voteCount}</p>
                  <p className="text-xs font-mono text-muted mt-1">{pct}%</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

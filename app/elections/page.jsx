'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, Calendar, ShieldCheck, ChevronRight,
  BarChart3, Trophy, Building2, Vote,
} from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export default function PublicResultsPage() {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'completed' | 'live'

  const loadElections = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/elections/public');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setElections(data.elections || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load elections. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadElections();
  }, [loadElections]);

  const filtered = elections.filter(e => {
    if (filter === 'completed') return e.phase === 2;
    if (filter === 'live') return e.phase === 1;
    return true;
  });

  const completedCount = elections.filter(e => e.phase === 2).length;
  const liveCount = elections.filter(e => e.phase === 1).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex justify-center items-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      
      {/* Header */}
      <nav className="border-b border-hairline bg-canvas/80 backdrop-blur-md px-6 md:px-16 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <BarChart3 className="text-white" size={16} />
          </div>
          <div>
            <h1 className="font-bold text-ink text-base leading-tight">Public Ledger</h1>
            <p className="text-xs text-muted font-semibold uppercase tracking-wider">Blockchain-Verified Elections</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/verify" className="text-xs text-primary hover:text-primary-active font-semibold transition">
            Verify Ballots
          </Link>
          <div className="flex items-center gap-2 text-xs text-body bg-surface-soft border border-hairline px-3 py-1.5 rounded-full font-medium">
            <ShieldCheck size={14} className="text-primary shrink-0" />
            <span>Verifiable Records</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="px-6 md:px-16 py-12 max-w-7xl mx-auto w-full">
        
        {/* Intro */}
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-display font-normal tracking-tight mb-3 text-ink">Elections Directory</h2>
          <p className="text-body text-sm leading-relaxed">
            All polls hosted on Block Vote are registered publicly on-chain. Results are verified cryptographically and cannot be altered. Search through completed and active elections.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { id: 'all', label: `All elections (${elections.length})` },
            { id: 'completed', label: `Completed (${completedCount})`, icon: Trophy },
            { id: 'live', label: `Live (${liveCount})`, icon: Vote },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full border transition-all cursor-pointer ${
                filter === f.id
                  ? 'bg-primary/10 text-primary border-primary/20 shadow-sm'
                  : 'bg-canvas text-body border-hairline hover:border-body'
              }`}
            >
              {f.icon && <f.icon size={13} />}
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-canvas border border-semantic-down rounded-xl p-4 mb-8 text-sm text-semantic-down">
            {error}
          </div>
        )}

        {filtered.length === 0 && !error ? (
          <div className="flex flex-col items-center gap-3 py-24 text-body border border-dashed border-hairline rounded-xl bg-surface-soft/35">
            <BarChart3 size={36} className="text-muted" />
            <p className="text-ink font-semibold">No records found</p>
            <p className="text-xs text-muted">
              {filter === 'completed' ? 'There are no completed elections yet.' :
               filter === 'live' ? 'No elections are currently voting live.' :
               'Directory is empty. Create an election on the dashboard to register it.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((election, idx) => {
              const isCompleted = election.phase === 2;
              const isLive = election.phase === 1;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  key={election._id || election.electionId}
                >
                  <Link
                    href={`/elections/${election.electionId}`}
                    className="group bg-canvas border border-hairline hover:border-primary rounded-xl p-6 flex flex-col h-full transition-all shadow-sm relative overflow-hidden"
                  >
                    {isCompleted && (
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-primary/80" />
                    )}
                    {isLive && (
                      <div className="absolute top-0 left-0 w-full h-1 bg-amber-400 animate-pulse" />
                    )}

                    <div className="flex justify-between items-start mb-5">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        isCompleted
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : isLive
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : 'text-primary bg-primary/5 border-primary/25'
                      }`}>
                        {isCompleted ? 'Completed' : isLive ? 'Voting Live' : 'Registering'}
                      </span>
                      <span className="text-[10px] font-mono text-muted">ID: {election.electionId}</span>
                    </div>

                    <h2 className="text-lg font-semibold text-ink group-hover:text-primary transition line-clamp-2 mb-2 leading-tight">
                      {election.title}
                    </h2>
                    <p className="text-body text-xs line-clamp-3 mb-4 flex-1 leading-relaxed">
                      {election.description}
                    </p>

                    {election.orgName && (
                      <div className="flex items-center gap-1.5 text-xs text-muted mb-4 font-semibold">
                        <Building2 size={12} className="text-primary" />
                        <span>{election.orgName}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-hairline mt-auto">
                      <div className="flex flex-col gap-1 text-[11px] text-muted font-medium font-mono">
                        {isCompleted && election.totalVotes != null && (
                          <div className="flex items-center gap-1.5 text-ink font-semibold">
                            <Trophy size={11} className="text-amber-500" />
                            <span>{election.totalVotes} votes cast</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} />
                          <span>
                            {election.endTime
                              ? new Date(election.endTime).toLocaleDateString()
                              : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-surface-strong group-hover:bg-primary flex items-center justify-center transition-all">
                        <ChevronRight size={14} className="text-ink group-hover:text-white transition-all" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

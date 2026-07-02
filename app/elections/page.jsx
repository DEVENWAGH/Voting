'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  List, Loader2, Calendar, ShieldCheck, ChevronRight,
  BarChart3, Trophy, Building2, Vote, Filter
} from 'lucide-react';
import Link from 'next/link';

export default function PublicResultsPage() {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'completed' | 'live'

  const loadElections = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch from MongoDB API which respects org scoping
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
      <div className="min-h-screen bg-[#020617] flex justify-center items-center">
        <Loader2 className="animate-spin text-indigo-500" size={44} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* Header */}
      <nav className="border-b border-white/5 bg-slate-950/80 px-6 md:px-16 py-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <BarChart3 className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-black text-xl leading-tight">Public Results</h1>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Blockchain-Verified Elections</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full font-medium">
          <ShieldCheck size={14} className="text-green-500" /> Fully Transparent
        </div>
      </nav>

      <div className="px-6 md:px-16 py-10 max-w-7xl mx-auto">
        {/* Hero */}
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-black mb-3 text-white">Election Results & History</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            All elections on Block Vote are recorded on the Ethereum blockchain. Results are publicly verifiable
            and cannot be tampered with. Browse completed and live elections across all organizations.
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { id: 'all', label: `All (${elections.length})` },
            { id: 'completed', label: `Completed (${completedCount})`, icon: Trophy },
            { id: 'live', label: `Live (${liveCount})`, icon: Vote },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border font-semibold transition ${
                filter === f.id
                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-600'
              }`}
            >
              {f.icon && <f.icon size={13} />}
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-900 text-red-300 rounded-2xl p-6 mb-8 text-sm">
            {error}
          </div>
        )}

        {filtered.length === 0 && !error ? (
          <div className="flex flex-col items-center gap-4 py-24 text-slate-500 border border-slate-800 border-dashed rounded-3xl bg-slate-900/30">
            <BarChart3 size={48} />
            <p className="text-xl font-semibold">No elections found</p>
            <p className="text-sm">
              {filter === 'completed' ? 'No completed elections yet.' :
               filter === 'live' ? 'No elections are currently live.' :
               'Elections will appear here once created by organizations.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((election) => {
              const isCompleted = election.phase === 2;
              const isLive = election.phase === 1;

              return (
                <Link
                  key={election._id || election.electionId}
                  href={`/elections/${election.electionId}`}
                  className="group bg-slate-900/40 border border-slate-800 hover:border-indigo-500/50 rounded-3xl p-6 flex flex-col transition hover:-translate-y-1 relative overflow-hidden backdrop-blur-xl"
                >
                  {isCompleted && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-cyan-500" />
                  )}
                  {isLive && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse" />
                  )}

                  <div className="flex justify-between items-start mb-5">
                    <div className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      isCompleted
                        ? 'text-green-400 bg-green-900/30 border-green-700'
                        : isLive
                          ? 'text-amber-400 bg-amber-900/30 border-amber-700'
                          : 'text-blue-400 bg-blue-900/30 border-blue-700'
                    }`}>
                      {isCompleted ? 'Completed' : isLive ? 'Voting Live' : 'Registration'}
                    </div>
                    <span className="text-xs font-mono text-slate-600">ID: {election.electionId}</span>
                  </div>

                  <h2 className="text-xl font-bold text-white group-hover:text-indigo-300 transition line-clamp-2 mb-2">
                    {election.title}
                  </h2>
                  <p className="text-slate-400 text-sm line-clamp-3 mb-4 flex-1">
                    {election.description}
                  </p>

                  {/* Org badge */}
                  {election.orgName && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
                      <Building2 size={12} className="text-indigo-400" />
                      {election.orgName}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <div className="flex flex-col gap-1 text-xs text-slate-500 font-medium">
                      {isCompleted && election.totalVotes != null && (
                        <div className="flex items-center gap-1.5">
                          <Trophy size={12} className="text-yellow-500" />
                          {election.totalVotes} vote{election.totalVotes !== 1 ? 's' : ''} cast
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} />
                        {election.endTime
                          ? new Date(election.endTime).toLocaleDateString()
                          : '—'}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-800 group-hover:bg-indigo-500 flex items-center justify-center transition">
                      <ChevronRight size={16} className="text-slate-400 group-hover:text-white" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

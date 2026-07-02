'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart3, TrendingUp, Users, Activity, Clock, Award, AlertCircle, RefreshCw, Calendar, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';

export default function AnalyticsDashboardPage() {
  const [elections, setElections] = useState([]);
  const [selectedElectionId, setSelectedElectionId] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [candidatesMap, setCandidatesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(10); // seconds
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [prevVoteCount, setPrevVoteCount] = useState(0);
  const [countAnimation, setCountAnimation] = useState(false);

  // 1. Fetch all elections
  useEffect(() => {
    fetch('/api/elections')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data && d.data.length > 0) {
          setElections(d.data);
          // Set to active/latest election by default
          const active = d.data.find(e => e.phase === 1) || d.data[d.data.length - 1];
          setSelectedElectionId(active.electionId);
        } else {
          setError('No elections found in the system.');
          setLoading(false);
        }
      })
      .catch(err => {
        setError('Failed to load elections.');
        setLoading(false);
      });
  }, []);

  // 2. Fetch analytics + candidate mappings
  const loadAnalytics = useCallback(async (electionId, silent = false) => {
    if (electionId === null) return;
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    
    try {
      // Fetch election details (for candidate names/info)
      const electionRes = await fetch(`/api/elections/${electionId}`);
      const electionData = await electionRes.json();
      
      const candidatesInfo = {};
      if (electionData.success && electionData.data && electionData.data.candidates) {
        electionData.data.candidates.forEach(c => {
          candidatesInfo[c.candidateId] = c;
        });
        setCandidatesMap(candidatesInfo);
      }

      // Fetch aggregated analytics data from MongoDB (Serverless Analytics feature)
      const analyticsRes = await fetch(`/api/analytics/${electionId}`);
      const analyticsDataJson = await analyticsRes.json();
      
      if (analyticsDataJson.success && analyticsDataJson.data) {
        const data = analyticsDataJson.data;
        
        // Animated vote counter logic
        setPrevVoteCount(prev => {
          if (silent && data.stats.totalVotes > prev) {
            setCountAnimation(true);
            setTimeout(() => setCountAnimation(false), 1000);
          }
          return data.stats.totalVotes;
        });
        
        setAnalyticsData(data);
        setError('');
      } else {
        setError(analyticsDataJson.error || 'Failed to fetch analytics.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection to analytics service lost.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Trigger loading analytics when selected election changes
  useEffect(() => {
    if (selectedElectionId !== null) {
      loadAnalytics(selectedElectionId);
    }
  }, [selectedElectionId, loadAnalytics]);

  // 3. Auto-refresh loop
  useEffect(() => {
    if (selectedElectionId === null) return;
    
    const interval = setInterval(() => {
      loadAnalytics(selectedElectionId, true);
    }, refreshInterval * 1000);
    
    return () => clearInterval(interval);
  }, [selectedElectionId, refreshInterval, loadAnalytics]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center">
        <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-400 text-sm font-semibold tracking-wide">Compiling Real-Time Aggregations...</p>
      </div>
    );
  }

  const stats = analyticsData?.stats;
  const hourly = analyticsData?.hourlyDistribution || [];
  const breakdown = analyticsData?.candidateBreakdown || [];
  const activity = analyticsData?.recentActivity || [];
  const election = analyticsData?.election;

  // Calculations for Pure SVG charts
  // Bar Chart calculations
  const maxVotes = Math.max(...breakdown.map(b => b.votes), 1);
  
  // Time-Series (Line Chart) calculations
  const chartHeight = 160;
  const chartWidth = 500;
  const maxHourlyCount = Math.max(...hourly.map(h => h.count), 1);
  const padding = 25;
  const points = hourly.map((h, i) => {
    const x = padding + (i / Math.max(hourly.length - 1, 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - (h.count / maxHourlyCount) * (chartHeight - padding * 2);
    return { x, y, hour: new Date(h.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), count: h.count };
  });

  const linePath = points.length > 0 
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - padding} L ${points[0].x} ${chartHeight - padding} Z`
    : '';

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col font-sans">
      {/* Top Banner / Navigation */}
      <header className="border-b border-slate-900 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md bg-slate-950/50 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BarChart3 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-extrabold text-base leading-none">Cloud Analytics Hub</h1>
            <p className="text-slate-500 text-xs">Real-Time MongoDB Aggregated Metrics</p>
          </div>
          <span className="flex h-2 w-2 relative ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        </div>

        {/* Election Selector & Auto Refresh Control */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-400">
            <Calendar size={13} className="text-indigo-400" />
            <select value={selectedElectionId || ''} onChange={e => setSelectedElectionId(Number(e.target.value))}
              className="bg-transparent border-none outline-none text-white font-semibold pr-4 cursor-pointer">
              {elections.map(el => (
                <option key={el.electionId} value={el.electionId} className="bg-slate-950 text-white">
                  {el.title} ({el.phase === 1 ? 'Voting' : el.phase === 2 ? 'Completed' : 'Registration'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <button onClick={() => loadAnalytics(selectedElectionId)} disabled={isRefreshing}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition flex items-center gap-1">
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <select value={refreshInterval} onChange={e => setRefreshInterval(Number(e.target.value))}
              className="bg-transparent border-none outline-none text-white font-semibold px-2 cursor-pointer text-xs">
              <option value="5" className="bg-slate-950">5s refresh</option>
              <option value="10" className="bg-slate-950">10s refresh</option>
              <option value="30" className="bg-slate-950">30s refresh</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Election Metadata Card */}
        {election && (
          <div className="bg-gradient-to-r from-indigo-950/20 via-slate-900/40 to-violet-950/20 border border-slate-900 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest px-2.5 py-1 rounded-full bg-indigo-950/40 border border-indigo-900/30">
                  {election.phase === 0 ? 'Phase: Registration' : election.phase === 1 ? 'Phase: Live Voting' : 'Phase: Completed'}
                </span>
                <h2 className="text-2xl font-black text-white mt-3.5">{election.title}</h2>
                <p className="text-slate-400 text-sm mt-1 max-w-2xl">{election.description}</p>
              </div>
              <div className="flex flex-col gap-1 text-xs text-slate-500 font-medium">
                <p className="flex items-center gap-1.5"><Clock size={13} /> Started: {new Date(election.startTime * 1000).toLocaleString()}</p>
                <p className="flex items-center gap-1.5"><Clock size={13} /> Closes: {new Date(election.endTime * 1000).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex gap-2 items-center bg-red-950/20 border border-red-700/50 text-red-300 rounded-xl p-4 text-sm">
            <AlertCircle size={16} className="shrink-0" />{error}
          </div>
        )}

        {/* ─── Grid 1: Key Performance Indicators ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Total Votes Cast */}
          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl backdrop-blur-xl hover:border-slate-800 transition flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Ballots Cast</p>
              <h3 className={`text-3xl font-black text-white transition-all duration-300 ${countAnimation ? 'text-indigo-400 scale-105' : ''}`}>
                {stats?.totalVotes || 0}
              </h3>
            </div>
            <div className="p-3.5 bg-indigo-600/10 rounded-2xl border border-indigo-500/10"><Users size={22} className="text-indigo-400" /></div>
          </div>

          {/* Card 2: Turnout Velocity */}
          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl backdrop-blur-xl hover:border-slate-800 transition flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Voting Velocity</p>
              <h3 className="text-3xl font-black text-emerald-400">{stats?.votesPerMinute || 0} <span className="text-xs text-slate-500 font-medium">/min</span></h3>
            </div>
            <div className="p-3.5 bg-emerald-600/10 rounded-2xl border border-emerald-500/10"><TrendingUp size={22} className="text-emerald-400" /></div>
          </div>

          {/* Card 3: Votes last Hour */}
          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl backdrop-blur-xl hover:border-slate-800 transition flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active last 1 Hour</p>
              <h3 className="text-3xl font-black text-white">{stats?.votesLast1h || 0}</h3>
            </div>
            <div className="p-3.5 bg-violet-600/10 rounded-2xl border border-violet-500/10"><Activity size={22} className="text-violet-400" /></div>
          </div>

          {/* Card 4: Candidates Count */}
          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl backdrop-blur-xl hover:border-slate-800 transition flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Peak Hour Activity</p>
              <h3 className="text-base font-black text-indigo-300 truncate max-w-[170px]">
                {stats?.peakHour ? `${new Date(stats.peakHour.hour).toLocaleTimeString([], { hour: '2-digit' })} (${stats.peakHour.votes} votes)` : 'No activity'}
              </h3>
            </div>
            <div className="p-3.5 bg-indigo-600/10 rounded-2xl border border-indigo-500/10"><Clock size={22} className="text-indigo-400" /></div>
          </div>
        </div>

        {/* ─── Grid 2: Charts & Leaderboard ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Column A: Charts (Bar + Time Series) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Chart 1: Candidate Vote Distribution */}
            <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl backdrop-blur-xl">
              <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                <Award size={18} className="text-indigo-400" /> Candidate Vote Breakdown
              </h3>
              
              {breakdown.length === 0 ? (
                <div className="h-40 flex items-center justify-center border border-dashed border-slate-800 rounded-xl">
                  <p className="text-slate-500 text-xs font-semibold">Waiting for votes to be cast...</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {breakdown.map(b => {
                    const cand = candidatesMap[b.candidateId];
                    const percent = stats?.totalVotes ? Math.round((b.votes / stats.totalVotes) * 100) : 0;
                    return (
                      <div key={b.candidateId} className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-white flex items-center gap-2">
                            {cand?.photoUrl ? (
                              <img src={cand.photoUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-slate-800" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-indigo-950 flex items-center justify-center text-[10px] text-indigo-300 font-extrabold uppercase">
                                {cand?.name ? cand.name.substring(0, 2) : 'C'}
                              </div>
                            )}
                            {cand?.name || `Candidate #${b.candidateId}`}
                            <span className="text-[10px] text-slate-500 font-medium">({cand?.party || 'Independent'})</span>
                          </span>
                          <span className="text-slate-400">{b.votes} votes ({percent}%)</span>
                        </div>
                        <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-900">
                          <div className="bg-gradient-to-r from-indigo-500 to-violet-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chart 2: Hourly Vote Trend (Time Series) */}
            <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl backdrop-blur-xl">
              <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-400" /> Hourly Turnout Curve
              </h3>

              {hourly.length < 2 ? (
                <div className="h-44 flex items-center justify-center border border-dashed border-slate-800 rounded-xl">
                  <p className="text-slate-500 text-xs font-semibold">More data required to compile line trend...</p>
                </div>
              ) : (
                <div className="w-full">
                  {/* Pure SVG Line Chart */}
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto max-h-52 overflow-visible">
                    <defs>
                      <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Horizontal grid lines */}
                    <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#1e293b" strokeDasharray="3 3" />
                    <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#1e293b" />
                    
                    {/* Area path */}
                    <path d={areaPath} fill="url(#chart-area-grad)" />
                    
                    {/* Line path */}
                    <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5" />
                    
                    {/* Circles on datapoints */}
                    {points.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="4.5" fill="#020617" stroke="#8b5cf6" strokeWidth="2" />
                        <text x={p.x} y={chartHeight - 8} fontSize="8" fill="#475569" textAnchor="middle" fontWeight="bold">
                          {p.hour}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              )}
            </div>

          </div>

          {/* Column B: Recent Activity Timeline */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl backdrop-blur-xl h-full flex flex-col max-h-[580px]">
              <h3 className="text-lg font-black mb-6 flex items-center gap-2 border-b border-slate-850 pb-4">
                <Activity size={18} className="text-indigo-400" /> Recent Vote Activities
              </h3>

              {activity.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl">
                  <Activity size={24} className="text-slate-600 mb-2 animate-pulse" />
                  <p className="text-slate-500 text-xs font-semibold">No transactions recorded yet.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar">
                  {activity.map((act, index) => {
                    const cand = candidatesMap[act.candidateId];
                    return (
                      <div key={act.txHash || index} className="flex gap-3 text-xs leading-relaxed border-l-2 border-slate-800 pl-4 relative">
                        <div className="absolute -left-1.5 top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 shadow shadow-indigo-500/40 border border-slate-900" />
                        <div className="flex-1 space-y-1">
                          <p className="text-slate-300">
                            Vote casted for <strong className="text-white font-bold">{cand?.name || `Candidate #${act.candidateId}`}</strong>
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                            <span className="truncate max-w-[130px]">{act.txHash}</span>
                            <span>·</span>
                            <span>Blk #{act.blockNumber || '---'}</span>
                          </div>
                          <p className="text-[10px] text-slate-600 font-semibold flex items-center gap-1">
                            <Clock size={10} /> {new Date(act.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

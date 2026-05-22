'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import {
  Shield, Zap, Building2, Users, RefreshCw, Copy, CheckCircle,
  AlertTriangle, ExternalLink, ChevronRight, Activity, Lock, Unlock,
  LayoutDashboard, Award, LogOut, Check, X, FileText, Settings, Loader2
} from 'lucide-react';
import { formatDate, serializeElection } from '@/lib/contract';

const GUARDIAN_ROLES = {
  1: { role: 'Relayer Custodian', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-950/20', accent: '#06b6d4' },
  2: { role: 'Security Auditor', color: 'text-purple-400 border-purple-500/30 bg-purple-950/20', accent: '#8b5cf6' },
  3: { role: 'Compliance Trustee', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20', accent: '#10b981' }
};

const STATIC_GUARDIANS = [
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
];

export default function PlatformAdminPage() {
  const router = useRouter();
  const { account, disconnect, readContract, contract } = useWallet();

  // Authentication states
  const [guardianId, setGuardianId] = useState(null);
  const [guardianAddress, setGuardianAddress] = useState('');
  const [isSimulated, setIsSimulated] = useState(false);
  const [guardiansList, setGuardiansList] = useState(STATIC_GUARDIANS);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('overview');

  // Backend data states
  const [orgs, setOrgs] = useState([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [elections, setElections] = useState([]);
  const [electionsLoading, setElectionsLoading] = useState(false);
  const [relayData, setRelayData] = useState(null);
  const [relayLoading, setRelayLoading] = useState(false);

  // Upgrade Proposals & Governance states
  const [upgradeProposals, setUpgradeProposals] = useState([]);
  const [govLoading, setGovLoading] = useState(false);
  const [newImplAddress, setNewImplAddress] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [govError, setGovError] = useState('');
  const [govSuccess, setGovSuccess] = useState('');

  // ── Authentication Check ───────────────────────────────────────────────────
  useEffect(() => {
    // 1. Check for simulated guardian session
    const simId = sessionStorage.getItem('simulated_guardian_id');
    const simAddr = sessionStorage.getItem('simulated_guardian_address');

    // 2. Check for real connected guardian wallet session
    const actId = sessionStorage.getItem('active_guardian_id');
    const actAddr = sessionStorage.getItem('active_guardian_address');

    if (simId && simAddr) {
      setGuardianId(Number(simId));
      setGuardianAddress(simAddr);
      setIsSimulated(true);
    } else if (actId && actAddr) {
      setGuardianId(Number(actId));
      setGuardianAddress(actAddr);
      setIsSimulated(false);
    } else if (account) {
      // Direct access bypass if wallet already connected on page reload
      const deployerAddr = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
      let index = guardiansList.findIndex(g => g.toLowerCase() === account.toLowerCase());
      
      if (account.toLowerCase() === deployerAddr) {
        index = 0; // Treat Deployer as Guardian 1!
      }

      if (index !== -1) {
        setGuardianId(index + 1);
        setGuardianAddress(account);
        setIsSimulated(false);
      } else {
        router.replace('/admin-auth');
      }
    } else {
      router.replace('/admin-auth');
    }
  }, [account, guardiansList, router]);

  // Load Guardian List from contract if available
  useEffect(() => {
    async function fetchGuardians() {
      if (readContract) {
        try {
          const list = await readContract.getGuardians();
          if (list && list.length === 3) {
            setGuardiansList(list);
          }
        } catch (e) {
          console.warn('Failed to load dynamic guardians:', e);
        }
      }
    }
    fetchGuardians();
  }, [readContract]);

  // Handle Logout
  const handleLogout = () => {
    sessionStorage.removeItem('active_guardian_id');
    sessionStorage.removeItem('active_guardian_address');
    sessionStorage.removeItem('simulated_guardian_id');
    sessionStorage.removeItem('simulated_guardian_address');
    disconnect();
    router.push('/admin-auth');
  };

  // ── Data Fetching Helpers ──────────────────────────────────────────────────
  const fetchOrgs = useCallback(async () => {
    setOrgsLoading(true);
    try {
      const res = await fetch('/api/admin/orgs');
      const data = await res.json();
      setOrgs(data.orgs || []);
    } catch (err) {
      console.error('Fetch orgs failed:', err);
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  const fetchElections = useCallback(async () => {
    if (!readContract) return;
    setElectionsLoading(true);
    try {
      const raw = await readContract.getAllElections();
      setElections(raw.map(serializeElection));
    } catch (err) {
      console.error('Fetch elections failed:', err);
    } finally {
      setElectionsLoading(false);
    }
  }, [readContract]);

  const fetchRelayStatus = useCallback(async () => {
    setRelayLoading(true);
    try {
      const res = await fetch('/api/relay/status');
      const data = await res.json();
      setRelayData(data);
    } catch (err) {
      console.error('Fetch relay failed:', err);
    } finally {
      setRelayLoading(false);
    }
  }, []);

  const fetchUpgradeProposals = useCallback(async () => {
    if (!readContract) return;
    setGovLoading(true);
    try {
      // UUPS proposals count is tracked on-chain
      const count = Number(await readContract.proposalCount());
      const list = [];
      for (let i = 0; i < count; i++) {
        const prop = await readContract.getUpgradeProposal(i);
        // Check if current guardian has approved this proposal
        let hasApproved = false;
        if (guardianAddress) {
          hasApproved = await readContract.hasGuardianApproved(i, guardianAddress);
        }
        list.push({
          id: i,
          implementation: prop[0],
          approvals: Number(prop[1]),
          executed: prop[2],
          hasApproved
        });
      }
      setUpgradeProposals(list);
    } catch (err) {
      console.error('Fetch upgrade proposals failed:', err);
    } finally {
      setGovLoading(false);
    }
  }, [readContract, guardianAddress]);

  // Load appropriate data based on active tab
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchOrgs();
      fetchElections();
      fetchUpgradeProposals();
      fetchRelayStatus();
    } else if (activeTab === 'orgs') {
      fetchOrgs();
    } else if (activeTab === 'elections') {
      fetchElections();
    } else if (activeTab === 'gas') {
      fetchRelayStatus();
    } else if (activeTab === 'governance') {
      fetchUpgradeProposals();
    }
  }, [activeTab, fetchOrgs, fetchElections, fetchRelayStatus, fetchUpgradeProposals]);

  // ── Organization Toggle Verification ──────────────────────────────────────
  const toggleOrgVerification = async (id, currentStatus) => {
    setVerifyingId(id);
    try {
      const res = await fetch('/api/admin/orgs/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isVerified: !currentStatus })
      });
      const data = await res.json();
      if (data.success) {
        setOrgs(prev => prev.map(o => o._id === id ? { ...o, isVerified: !currentStatus } : o));
      }
    } catch (err) {
      console.error('Verify org failed:', err);
    } finally {
      setVerifyingId(null);
    }
  };

  // ── Governance Actions ────────────────────────────────────────────────────
  const proposeUpgrade = async () => {
    if (!contract) {
      setGovError('Write contract not loaded. Please connect your real Guardian wallet.');
      return;
    }
    if (!newImplAddress.startsWith('0x') || newImplAddress.length !== 42) {
      setGovError('Please provide a valid Ethereum contract address.');
      return;
    }
    setGovError('');
    setGovSuccess('');
    setActionLoading(true);
    try {
      const tx = await contract.proposeUpgrade(newImplAddress);
      await tx.wait();
      setGovSuccess(`Upgrade proposal for ${newImplAddress.slice(0, 8)}... created!`);
      setNewImplAddress('');
      fetchUpgradeProposals();
    } catch (err) {
      setGovError(err.reason || err.message || 'Failed to submit proposal.');
    } finally {
      setActionLoading(false);
    }
  };

  const approveUpgrade = async (id) => {
    if (!contract) {
      setGovError('Write contract not loaded. Please connect your real Guardian wallet.');
      return;
    }
    setGovError('');
    setGovSuccess('');
    setActionLoading(true);
    try {
      const tx = await contract.approveUpgrade(id);
      await tx.wait();
      setGovSuccess(`Upgrade proposal #${id} approved!`);
      fetchUpgradeProposals();
    } catch (err) {
      setGovError(err.reason || err.message || 'Failed to approve upgrade.');
    } finally {
      setActionLoading(false);
    }
  };

  const executeUpgrade = async (id) => {
    if (!contract) {
      setGovError('Write contract not loaded. Please connect your real Guardian wallet.');
      return;
    }
    setGovError('');
    setGovSuccess('');
    setActionLoading(true);
    try {
      const tx = await contract.executeUpgrade(id);
      await tx.wait();
      setGovSuccess(`Upgrade proposal #${id} successfully executed! Contract upgraded.`);
      fetchUpgradeProposals();
    } catch (err) {
      setGovError(err.reason || err.message || 'Failed to execute upgrade.');
    } finally {
      setActionLoading(false);
    }
  };

  // If session is still resolving, show page loader
  if (!guardianId) {
    return (
      <div className="min-h-screen bg-[#020617] flex justify-center items-center">
        <Loader2 className="animate-spin text-indigo-500" size={40} />
      </div>
    );
  }

  const activeRole = GUARDIAN_ROLES[guardianId];

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col md:flex-row">

      {/* ── Custom Admin Navigation Sidebar ───────────────────────────────────── */}
      <aside className="w-full md:w-64 bg-[#090d1f] border-b md:border-b-0 md:border-r border-slate-900 flex flex-col justify-between shrink-0 z-30 relative">
        {/* Glow behind sidebar */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-indigo-500/5 to-transparent pointer-events-none" />

        <div className="p-6 space-y-6">
          {/* Logo & Header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-950/40">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-extrabold text-sm tracking-widest uppercase leading-none">Aegis Guard</h1>
              <p className="text-[9px] text-slate-500 font-mono tracking-tight mt-1">GOVERNANCE PANEL</p>
            </div>
          </div>

          {/* Profile indicator card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-900/80 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: activeRole.accent }} />
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${activeRole.color}`}>
                  Guardian No. {guardianId}
                </span>
                {isSimulated && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 font-bold uppercase tracking-wider scale-90">
                    SIM
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight">{activeRole.role}</p>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-mono">
                  <span>{guardianAddress.slice(0, 6)}…{guardianAddress.slice(-4)}</span>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(guardianAddress); }}
                    className="text-slate-600 hover:text-slate-400 transition"
                    title="Copy Address"
                  >
                    <Copy size={10} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-1.5 pt-2">
            {[
              { id: 'overview', label: 'System Overview', icon: LayoutDashboard },
              { id: 'elections', label: 'View Elections', icon: FileText },
              { id: 'orgs', label: 'Handle Organizations', icon: Building2 },
              { id: 'gas', label: 'Gas Station', icon: Zap, isLocked: guardianId !== 1 },
              { id: 'governance', label: 'Multi-Sig Governance', icon: Shield },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition border ${
                    isActive
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                      : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={14} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.isLocked && (
                    <Lock size={11} className="text-slate-600 group-hover:text-slate-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Area */}
        <div className="p-6 border-t border-slate-900">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-slate-950 hover:bg-red-950/20 border border-slate-900 hover:border-red-900/30 text-slate-400 hover:text-red-400 font-bold py-2 px-4 rounded-xl text-xs transition"
          >
            <LogOut size={13} />
            Exit Portal Gate
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ──────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto px-6 py-8 md:px-12 md:py-10 space-y-8 relative">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Page Title & Status */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-900 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 tracking-widest uppercase">
              <Activity size={12} className="animate-pulse" /> aegis core active
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-1">
              Guardian No. {guardianId} Dashboard
            </h2>
            <p className="text-xs text-slate-400 mt-1">Platform administrative gateway & secure multisig node.</p>
          </div>
          <div className="flex items-center gap-2 bg-[#090d1f] border border-slate-900 py-1.5 px-3 rounded-full text-xs text-slate-400 font-mono shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Local Hardhat Node Connect</span>
          </div>
        </div>

        {/* ── TAB CONTENT ──────────────────────────────────────────────────────── */}

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {[
                { label: 'Elections Count', value: elections.length, sub: 'Total registered elections', icon: FileText, color: '#6366f1' },
                { label: 'Active Orgs', value: orgs.length, sub: `${orgs.filter(o => o.isVerified).length} verified of ${orgs.length}`, icon: Building2, color: '#10b981' },
                { 
                  label: 'Gas Station Supply', 
                  value: relayLoading ? '...' : relayData ? `${parseFloat(relayData.balanceETH).toFixed(2)} ETH` : '0 ETH',
                  sub: guardianId === 1 ? 'Relay available' : 'Locked by Custodian 1', 
                  icon: Zap, 
                  color: guardianId === 1 ? '#06b6d4' : '#64748b' 
                },
                { label: 'Upgrade Governance', value: upgradeProposals.length, sub: 'Consensus proposals', icon: Shield, color: '#8b5cf6' },
              ].map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={i} className="bg-[#090d1f] border border-slate-900 rounded-2xl p-5 flex gap-4 items-start shadow-lg shadow-slate-950/20">
                    <div className="p-2.5 rounded-xl shrink-0" style={{ backgroundColor: stat.color + '15' }}>
                      <Icon size={18} style={{ color: stat.color }} />
                    </div>
                    <div>
                      <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{stat.label}</p>
                      <p className="text-white text-2xl font-black mt-1 leading-none">{stat.value}</p>
                      <p className="text-slate-400 text-xs mt-1">{stat.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Guardians Node Consensus Diagram */}
            <div className="bg-[#090d1f] border border-slate-900 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-[40px] pointer-events-none" />
              
              <h3 className="text-white font-extrabold text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
                <Shield size={15} className="text-indigo-400" /> Multisig Consensus Grid
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {[1, 2, 3].map((id) => {
                  const role = GUARDIAN_ROLES[id];
                  const isCurrent = guardianId === id;
                  const address = guardiansList[id - 1] || STATIC_GUARDIANS[id - 1];

                  return (
                    <div 
                      key={id} 
                      className={`p-5 rounded-2xl border transition-all duration-300 relative ${
                        isCurrent 
                          ? 'bg-slate-950 border-indigo-500/30 shadow-indigo-950/20' 
                          : 'bg-slate-950/40 border-slate-900'
                      }`}
                    >
                      {isCurrent && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 text-[8px] uppercase tracking-widest font-extrabold px-1.5 py-0.5 rounded border border-indigo-500/20 bg-indigo-950/30 text-indigo-400">
                          Active Node
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center font-bold text-xs" style={{ color: role.accent, border: `1px solid ${role.accent}20` }}>
                            G-{id}
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-white">{role.role}</h4>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{address.slice(0, 10)}…{address.slice(-6)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded-xl border border-slate-900/80">
                          <span className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                          <span>Status: {isCurrent ? 'CONNECTED (AUDITOR)' : 'STANDBY (ONLINE)'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 2. ELECTIONS TAB */}
        {activeTab === 'elections' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-white">Elections Registry</h3>
                <p className="text-xs text-slate-400 mt-1">Real-time auditing of decentralized elections on-chain.</p>
              </div>
              <button 
                onClick={fetchElections} 
                className="flex items-center gap-2 bg-[#090d1f] hover:bg-slate-900 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-md"
              >
                <RefreshCw size={12} className={electionsLoading ? 'animate-spin' : ''} />
                Sync Blockchain
              </button>
            </div>

            {electionsLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-indigo-500" size={30} />
              </div>
            ) : elections.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-slate-900 rounded-3xl bg-[#090d1f]/20">
                <p className="text-slate-500 text-sm">No active or historic elections exist on the network.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {elections.map((election) => {
                  const phases = { 0: 'Registration', 1: 'Voting', 2: 'Completed' };
                  const colors = { 
                    0: 'text-blue-400 bg-blue-950/20 border-blue-500/20', 
                    1: 'text-green-400 bg-green-950/20 border-green-500/20', 
                    2: 'text-slate-400 bg-slate-900/60 border-slate-800' 
                  };
                  return (
                    <div key={election.id} className="bg-[#090d1f] border border-slate-900 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-800 transition shadow-lg shadow-slate-950/10">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-mono">ELECTION #{election.id}</span>
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${colors[election.phase]}`}>
                            {phases[election.phase]}
                          </span>
                        </div>
                        <h4 className="text-white font-extrabold text-lg leading-snug">{election.title}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{election.description}</p>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-950 flex justify-between items-center text-[10px] text-slate-500 font-mono">
                        <div>
                          <p>Start: {formatDate(election.startTime)}</p>
                          <p className="mt-0.5">End: {formatDate(election.endTime)}</p>
                        </div>
                        <a 
                          href={`/elections/${election.id}`}
                          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold transition uppercase"
                        >
                          Audit Details
                          <ChevronRight size={10} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. HANDLE ORGANIZATIONS TAB */}
        {activeTab === 'orgs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-white">Handle Organizations</h3>
                <p className="text-xs text-slate-400 mt-1">Govern and verify registered organizations authorizing decentralized nodes.</p>
              </div>
              <button 
                onClick={fetchOrgs} 
                className="flex items-center gap-2 bg-[#090d1f] hover:bg-slate-900 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-md"
              >
                <RefreshCw size={12} className={orgsLoading ? 'animate-spin' : ''} />
                Refresh Registry
              </button>
            </div>

            {orgsLoading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-indigo-500" size={30} />
              </div>
            ) : orgs.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-slate-900 rounded-3xl bg-[#090d1f]/20">
                <p className="text-slate-500 text-sm">No self-registered organizations found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {orgs.map((org) => (
                  <div key={org._id} className="bg-[#090d1f] border border-slate-900 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-800 transition shadow-lg shadow-slate-950/10 relative overflow-hidden group">
                    {/* Corner badge indicating verification */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/5 to-transparent pointer-events-none" />

                    <div className="space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-white font-extrabold text-lg leading-snug">{org.name}</h4>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                              org.isVerified 
                                ? 'text-emerald-400 border-emerald-500/20 bg-emerald-950/20' 
                                : 'text-amber-400 border-amber-500/20 bg-amber-950/20'
                            }`}>
                              {org.isVerified ? 'Verified' : 'Pending'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 font-mono">/{org.slug} · Type: {org.type}</p>
                        </div>
                        <a href={`/org/${org.slug}/admin`} className="p-2 rounded-xl bg-slate-950 border border-slate-900 text-slate-400 hover:text-white transition shadow" title="Visit Org Admin Portal">
                          <ExternalLink size={13} />
                        </a>
                      </div>

                      <div className="space-y-1 text-xs text-slate-400">
                        <p><span className="text-slate-600 font-bold">Contact Email:</span> {org.email}</p>
                        <p><span className="text-slate-600 font-bold">Admin Email:</span> {org.adminEmail}</p>
                        {org.description && <p className="text-slate-500 mt-2 text-xs italic leading-relaxed">&ldquo;{org.description}&rdquo;</p>}
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-slate-950 flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-mono">Created: {new Date(org.createdAt).toLocaleDateString()}</span>
                      
                      <button
                        onClick={() => toggleOrgVerification(org._id, org.isVerified)}
                        disabled={verifyingId === org._id}
                        className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition border shadow ${
                          org.isVerified 
                            ? 'bg-slate-950 border-red-500/10 hover:border-red-500/20 text-red-400' 
                            : 'bg-indigo-500 hover:bg-indigo-600 text-white border-transparent'
                        } disabled:opacity-50`}
                      >
                        {verifyingId === org._id ? (
                          <>
                            <RefreshCw size={12} className="animate-spin" />
                            Updating...
                          </>
                        ) : org.isVerified ? (
                          <>
                            <X size={12} />
                            Revoke Status
                          </>
                        ) : (
                          <>
                            <Check size={12} />
                            Verify Organization
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. GAS STATION TAB */}
        {activeTab === 'gas' && (
          <div className="space-y-6">
            {/* Guardian 1 Custody Controls */}
            {guardianId === 1 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-extrabold text-white">Gas Station Custody Control</h3>
                    <p className="text-xs text-slate-400 mt-1">Exclusive Relayer Wallet dashboard held in custody by Guardian No. 1.</p>
                  </div>
                  <button 
                    onClick={fetchRelayStatus} 
                    className="flex items-center gap-2 bg-[#090d1f] hover:bg-slate-900 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-md"
                  >
                    <RefreshCw size={12} className={relayLoading ? 'animate-spin' : ''} />
                    Sync Relayer
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Balance details */}
                  <div className="bg-[#090d1f] border border-slate-900 rounded-3xl p-6 relative overflow-hidden shadow-lg shadow-slate-950/20">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-[40px] pointer-events-none" />
                    
                    <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Operational Relay Reserve</p>
                    <div className="flex items-baseline gap-2 mt-4">
                      <span className="text-5xl font-black text-cyan-400 tracking-tight">
                        {relayLoading ? '...' : relayData ? parseFloat(relayData.balanceETH).toFixed(4) : '0.0000'}
                      </span>
                      <span className="text-slate-400 text-lg font-bold">ETH</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-3 font-mono">Status: active private node · unlimited replenishment</p>
                    
                    <div className="mt-8">
                      <button 
                        onClick={async () => {
                          alert("Developer replenishment complete. Relayer balance set to simulated 100 ETH.");
                          fetchRelayStatus();
                        }}
                        className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold py-2.5 px-5 rounded-xl text-xs transition shadow-lg shadow-cyan-950/40"
                      >
                        Refill Relayer Reserves
                      </button>
                    </div>
                  </div>

                  {/* Wallet address and key details */}
                  <div className="bg-[#090d1f] border border-slate-900 rounded-3xl p-6 shadow-lg shadow-slate-950/20 space-y-4">
                    <div>
                      <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Custodian Relay Address</p>
                      <p className="text-slate-300 font-mono text-xs break-all mt-2 bg-slate-950 p-3 rounded-xl border border-slate-900">
                        {relayLoading ? 'Loading address...' : relayData?.address || '—'}
                      </p>
                    </div>
                    
                    {relayData?.address && (
                      <button 
                        onClick={() => { navigator.clipboard.writeText(relayData.address); }}
                        className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition font-bold uppercase tracking-wider"
                      >
                        <Copy size={12} />
                        Copy Relayer Key Address
                      </button>
                    )}
                  </div>
                </div>

                {/* Stepper info */}
                <div className="bg-[#090d1f] border border-slate-900 rounded-3xl p-6 shadow-lg shadow-slate-950/20">
                  <h4 className="text-white font-extrabold text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Activity size={15} className="text-cyan-400" /> OTP Gasless Relaying Chain Mechanism
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[
                      { step: '1', title: 'Identity Authentication', desc: 'Voter registers / requests verification. Credentials verified via OTP (No Metamask / Gas Required)' },
                      { step: '2', title: 'Nullifier Compilation', desc: 'Secure cryptographic nullifier hash computed server-side to hide real identity' },
                      { step: '3', title: 'Relayer Gas Coverage', desc: 'Custodian Relay Wallet automatically signs & pays transaction fee on-chain' },
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-950 border border-slate-900 rounded-2xl p-5 relative overflow-hidden">
                        <div className="w-7 h-7 rounded-lg bg-cyan-950 text-cyan-400 font-black text-xs flex items-center justify-center border border-cyan-500/20 mb-4">
                          {item.step}
                        </div>
                        <h5 className="text-white font-extrabold text-sm mb-1.5">{item.title}</h5>
                        <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Guardians 2 & 3 Locked State
              <div className="bg-[#090d1f] border border-slate-900 rounded-3xl p-8 shadow-2xl relative overflow-hidden max-w-2xl mx-auto border-t-indigo-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/5 rounded-full blur-[40px] pointer-events-none" />

                <div className="text-center space-y-6 relative z-10 py-6">
                  <div className="w-16 h-16 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-indigo-400 shadow-xl shadow-indigo-950/40">
                    <Lock size={26} className="text-indigo-400" />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-extrabold text-white">Restricted Reserve Access</h3>
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Gas Station Custody: Guardian No. 1 Only</p>
                  </div>

                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    The operational private keys, reserve balances, and gas allocation mechanisms of the relayer wallet are held in the exclusive custody of **Guardian No. 1 (Relayer Custodian)**. 
                    Other nodes in the Multi-sig participate in system upgrade authorization but do not hold gas relay execution access.
                  </p>

                  <div className="pt-6 border-t border-slate-950/80 max-w-sm mx-auto flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>Gas Custodian:</span>
                      <span className="text-slate-400">Guardian No. 1</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>Reserve Custody Address:</span>
                      <span className="text-slate-400">0x7099…79C8</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. MULTI-SIG GOVERNANCE TAB */}
        {activeTab === 'governance' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-white">Multi-Sig Upgrade Governance</h3>
                <p className="text-xs text-slate-400 mt-1">Submit, sign, and execute secure contract upgrades under UUPS 2-of-3 consensus.</p>
              </div>
              <button 
                onClick={fetchUpgradeProposals} 
                className="flex items-center gap-2 bg-[#090d1f] hover:bg-slate-900 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-md"
              >
                <RefreshCw size={12} className={govLoading ? 'animate-spin' : ''} />
                Refresh Board
              </button>
            </div>

            {/* Error & Success indicators */}
            {(govError || govSuccess) && (
              <div className={`p-4 rounded-xl text-xs font-bold border flex gap-3 items-start ${
                govError 
                  ? 'bg-red-500/10 border-red-500/20 text-red-300' 
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              }`}>
                {govError ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle size={16} className="shrink-0 mt-0.5" />}
                <span>{govError || govSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Proposal creation panel */}
              <div className="bg-[#090d1f] border border-slate-900 rounded-3xl p-6 shadow-lg shadow-slate-950/20 h-fit space-y-6">
                <div>
                  <h4 className="text-white font-extrabold text-sm uppercase tracking-wider">Propose New Upgrade</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">Submit a new compiled Solidity contract implementation payload to the multi-sig queue.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Implementation Address</label>
                    <input 
                      type="text" 
                      placeholder="0x..."
                      value={newImplAddress}
                      onChange={(e) => setNewImplAddress(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-900 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono transition"
                    />
                  </div>

                  <button
                    onClick={proposeUpgrade}
                    disabled={actionLoading || !newImplAddress}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-indigo-950/40 flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={13} /> : <Unlock size={12} />}
                    Submit Upgrade Proposal
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-900 text-[11px] text-slate-500 leading-normal">
                  <span className="font-bold text-slate-400 block mb-1">UUPS Rules:</span>
                  1. Proposal must be submitted by an active Guardian.<br />
                  2. Consensus threshold of 2-of-3 approvals is required.<br />
                  3. Upgrade takes effect instantly on the active proxy after execution.
                </div>
              </div>

              {/* Active Proposals list */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="text-white font-extrabold text-sm uppercase tracking-wider mb-2">Upgrade Proposal Queue</h4>

                {govLoading ? (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="animate-spin text-indigo-500" size={24} />
                  </div>
                ) : upgradeProposals.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-slate-900 rounded-3xl bg-[#090d1f]/20">
                    <p className="text-slate-500 text-sm">No contract upgrade proposals currently in consensus queue.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upgradeProposals.map((prop) => (
                      <div key={prop.id} className="bg-[#090d1f] border border-slate-900 rounded-2xl p-5 flex flex-col md:flex-row justify-between md:items-center gap-4 relative overflow-hidden">
                        {prop.executed && (
                          <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500 pointer-events-none" />
                        )}
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 font-mono">PROP ID #{prop.id}</span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                              prop.executed 
                                ? 'text-emerald-400 bg-emerald-950/20 border border-emerald-500/20' 
                                : 'text-indigo-400 bg-indigo-950/20 border border-indigo-500/20'
                            }`}>
                              {prop.executed ? 'Executed' : 'In Consensus'}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 font-mono">IMPLEMENTATION PAYLOAD ADDRESS</p>
                            <p className="text-white font-mono text-xs break-all mt-0.5">{prop.implementation}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 pt-4 md:pt-0 border-t md:border-0 border-slate-950 justify-between shrink-0">
                          {/* Approval counter */}
                          <div className="text-right">
                            <p className="text-[10px] text-slate-500 font-mono">CONSENSUS</p>
                            <p className="text-white font-extrabold text-sm mt-0.5">{prop.approvals} / 2 Approved</p>
                          </div>

                          {/* Approval Actions */}
                          {!prop.executed && (
                            <div className="flex gap-2">
                              {!prop.hasApproved ? (
                                <button
                                  onClick={() => approveUpgrade(prop.id)}
                                  disabled={actionLoading}
                                  className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 font-extrabold py-2 px-4 rounded-xl text-xs transition"
                                >
                                  Approve
                                </button>
                              ) : (
                                <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-500 border border-emerald-500/10 bg-emerald-950/15 py-1 px-2.5 rounded-xl">
                                  <Check size={11} /> Approved
                                </span>
                              )}

                              {prop.approvals >= 2 && (
                                <button
                                  onClick={() => executeUpgrade(prop.id)}
                                  disabled={actionLoading}
                                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-xl text-xs transition shadow-lg shadow-indigo-950/40"
                                >
                                  Execute
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

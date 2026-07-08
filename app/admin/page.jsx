'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import {
  Shield, Building2, BatteryCharging, RefreshCw, LogOut,
  AlertCircle, CheckCircle, Loader2, Clock, CheckCircle2,
  UserCheck, Trophy, BarChart3, Fuel, Plus, Play, Trash2, Database
} from 'lucide-react';
import ElectionResults from '@/components/ElectionResults';
import ThemeToggle from '@/components/ThemeToggle';

const APPROVAL_THRESHOLD = 2;

const TABS = [
  { id: 'approvals', label: 'Elections approvals', icon: Clock },
  { id: 'results', label: 'Public records', icon: Trophy },
  { id: 'orgs', label: 'Organizations register', icon: Building2 },
  { id: 'gas', label: 'Gas logistics', icon: BatteryCharging },
  { id: 'gov', label: 'Governance protocol', icon: Shield },
];

function Toast({ type, msg }) {
  const isErr = type === 'error';
  const bg = isErr ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700';
  const Icon = isErr ? AlertCircle : CheckCircle;
  return (
    <div className={`flex items-start gap-2.5 border rounded-lg p-3.5 mb-4 text-sm ${bg}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}

// ── Approvals Tab ────────────────────────────────────────────────────────────
function ApprovalsTab({ account }) {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/elections?filter=pending');
      const d = await r.json();
      setElections(d.elections || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (electionId, action) => {
    setMsg(null);
    setActioning(electionId);
    try {
      const r = await fetch('/api/admin/elections/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ electionId, guardianAddress: account, action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: d.message });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setActioning(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-hairline pb-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Pending Approvals</h3>
          <p className="text-xs text-body mt-0.5">Guardians must co-sign requests to transition elections live.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas cursor-pointer">
          <RefreshCw size={12} /> Sync
        </button>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : elections.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-hairline rounded-xl bg-canvas">
          <CheckCircle2 size={36} className="text-primary mx-auto mb-3" />
          <p className="text-ink font-semibold">Approvals list clear</p>
          <p className="text-body text-xs mt-1">There are no pending Go-Live requests at this time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {elections.map((e) => {
            const hasApproved = e.approvedBy?.some(addr => addr.toLowerCase() === account.toLowerCase());
            return (
              <div key={e._id || e.id} className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-ink text-base">{e.title}</h4>
                    <p className="text-body text-xs mt-0.5">{e.description}</p>
                    <p className="text-muted text-[10px] mt-1 uppercase font-semibold">Org Slug: {e.orgSlug} · Ballot ID: {e.id}</p>
                  </div>
                  <span className="text-xs font-mono font-semibold bg-surface-strong px-2.5 py-1 rounded-full text-ink">
                    Approvals: {e.approvalsCount || 0} / {APPROVAL_THRESHOLD}
                  </span>
                </div>

                {e.approvedBy?.length > 0 && (
                  <div className="bg-surface-soft p-3 rounded-lg border border-hairline">
                    <p className="text-[10px] font-semibold text-body uppercase tracking-wider mb-1.5">Approved Guardians</p>
                    <div className="space-y-1 font-mono text-[10px] text-body">
                      {e.approvedBy.map((addr, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <CheckCircle2 size={10} className="text-primary" />
                          <span>{addr}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {hasApproved ? (
                    <span className="text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-4 py-2 rounded-full flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> Signed by You
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAction(e.id, 'approve')}
                      disabled={actioning === e.id}
                      className="bg-primary hover:bg-primary-active text-white text-xs font-semibold px-4 py-2 rounded-full cursor-pointer transition shadow-sm"
                    >
                      {actioning === e.id ? <Loader2 size={12} className="animate-spin" /> : 'Co-sign Release'}
                    </button>
                  )}
                  <button
                    onClick={() => handleAction(e.id, 'reject')}
                    disabled={actioning === e.id}
                    className="border border-red-250 hover:bg-red-50 text-semantic-down text-xs font-semibold px-4 py-2 rounded-full cursor-pointer transition"
                  >
                    Reject Ballot
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Results Tab ──────────────────────────────────────────────────────────────
function ResultsTab({ slug }) {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedElection, setSelectedElection] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/elections?filter=completed');
      const d = await r.json();
      setElections(d.elections || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-hairline pb-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Completed Elections</h3>
          <p className="text-xs text-body mt-0.5">Browse final outcomes stored on-chain.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas cursor-pointer">
          <RefreshCw size={12} /> Sync
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : elections.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-hairline rounded-xl bg-canvas">
          <Trophy size={36} className="text-muted mx-auto mb-3" />
          <p className="text-ink font-semibold">No records archived</p>
          <p className="text-body text-xs mt-1">There are no completed elections registered on-chain.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {elections.map((e) => (
              <button
                key={e._id || e.id}
                onClick={() => setSelectedElection(e)}
                className={`w-full text-left p-4 rounded-lg border transition ${
                  selectedElection?.id === e.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-hairline bg-canvas hover:border-body'
                }`}
              >
                <h4 className="font-semibold text-ink text-sm leading-snug">{e.title}</h4>
                <p className="text-body text-[11px] mt-0.5 truncate">{e.description}</p>
                <p className="text-[10px] text-muted font-mono mt-1">ID: {e.id} · Org: {e.orgSlug}</p>
              </button>
            ))}
          </div>

          <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm">
            {selectedElection ? (
              <ElectionResults slug={selectedElection.orgSlug} electionId={selectedElection.id} electionTitle={selectedElection.title} compact />
            ) : (
              <div className="h-full flex flex-col justify-center items-center text-center py-12">
                <BarChart3 size={32} className="text-muted mb-2 animate-pulse" />
                <p className="text-body text-xs">Select an election from the list to display official tally charts.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Orgs Tab ──────────────────────────────────────────────────────────────────
function OrgsTab() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/orgs');
      const d = await r.json();
      setOrgs(d.organizations || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleVerify = async (orgId, isVerified) => {
    setMsg(null);
    setActioning(orgId);
    try {
      const r = await fetch('/api/admin/orgs/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, isVerified }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: d.message });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setActioning(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-hairline pb-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Organizations Register</h3>
          <p className="text-xs text-body mt-0.5">Control registration validation for platform organizations.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas cursor-pointer">
          <RefreshCw size={12} /> Sync
        </button>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : orgs.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-hairline rounded-xl bg-canvas">
          <Building2 size={36} className="text-muted mx-auto mb-3" />
          <p className="text-ink font-semibold">Register is empty</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-hairline rounded-xl bg-canvas">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-body text-xs">
                <th className="text-left px-5 py-3 font-semibold">Name / Slug</th>
                <th className="text-left px-5 py-3 font-semibold">Admin Account</th>
                <th className="text-left px-5 py-3 font-semibold">Category</th>
                <th className="text-left px-5 py-3 font-semibold">Verify Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {orgs.map((o) => (
                <tr key={o._id} className="hover:bg-surface-soft/40 transition">
                  <td className="px-5 py-3">
                    <p className="text-ink font-semibold text-sm">{o.name}</p>
                    <p className="text-body font-mono text-[10px] mt-0.5">Slug: {o.slug}</p>
                  </td>
                  <td className="px-5 py-3 text-body font-mono text-xs">{o.adminEmail}</td>
                  <td className="px-5 py-3 text-body text-xs capitalize">{o.type || 'Organization'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                        o.verified ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {o.verified ? 'Verified' : 'Pending Approval'}
                      </span>
                      {o.verified ? (
                        <button
                          onClick={() => handleVerify(o._id, false)}
                          disabled={actioning === o._id}
                          className="text-[10px] text-semantic-down hover:underline font-semibold cursor-pointer"
                        >
                          Revoke
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVerify(o._id, true)}
                          disabled={actioning === o._id}
                          className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                        >
                          Approve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Gas Logistics Tab ─────────────────────────────────────────────────────────
function GasTab() {
  const [gasData, setGasData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [funding, setFunding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/gas');
      const d = await r.json();
      setGasData(d);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const triggerFunding = () => {
    window.open('https://cloud.google.com/application/web3/faucet/ethereum/sepolia', '_blank');
  };

  const getGasStatus = (balanceStr) => {
    const bal = parseFloat(balanceStr || '0');
    if (bal >= 0.1) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Healthy Reserve
        </span>
      );
    } else if (bal > 0.02) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Low Reserve
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Action Required
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-hairline pb-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Gas Logistics</h3>
          <p className="text-xs text-body mt-0.5">Monitor system reserves for Relayer node voter transactions.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas cursor-pointer">
          <RefreshCw size={12} /> Sync
        </button>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Relayer Reserve */}
            <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm">
              <h4 className="text-xs font-semibold text-body uppercase tracking-wider mb-4 flex items-center gap-2">
                <Fuel size={14} className="text-primary" /> Relayer Gas Reserve
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Account Address</span>
                  <code className="text-ink font-mono text-xs">{gasData?.relayerAddress}</code>
                </div>
                <div className="flex justify-between border-t border-hairline pt-3 items-center">
                  <span className="text-muted">Current Balance</span>
                  <span className="text-ink font-bold font-mono text-xs">{gasData?.relayerBalanceETH} ETH</span>
                </div>
                <div className="flex justify-between border-t border-hairline pt-3 items-center">
                  <span className="text-muted">Reserve Status</span>
                  {getGasStatus(gasData?.relayerBalanceETH)}
                </div>
              </div>
            </div>

            {/* Gas Station Multisig */}
            <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm">
              <h4 className="text-xs font-semibold text-body uppercase tracking-wider mb-4 flex items-center gap-2">
                <Database size={14} className="text-primary" /> Gas Station Reserve
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Account Address</span>
                  <code className="text-ink font-mono text-xs">{gasData?.gasStationAddress}</code>
                </div>
                <div className="flex justify-between border-t border-hairline pt-3 items-center">
                  <span className="text-muted">Current Balance</span>
                  <span className="text-ink font-bold font-mono text-xs">{gasData?.gasStationBalanceETH} ETH</span>
                </div>
                <div className="flex justify-between border-t border-hairline pt-3 items-center">
                  <span className="text-muted">Reserve Status</span>
                  {getGasStatus(gasData?.gasStationBalanceETH)}
                </div>
              </div>
            </div>

          </div>

          <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm text-center space-y-4">
            <h4 className="text-sm font-semibold text-ink">Refuel System Gas Station</h4>
            <p className="text-body text-xs max-w-md mx-auto">
              If reserves run low, request Sepolia testnet ETH from the official Google Cloud Web3 Faucet to maintain uninterrupted voter validation relays.
            </p>
            <button
              onClick={triggerFunding}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-active text-white text-xs font-semibold px-6 py-2.5 rounded-full cursor-pointer shadow-sm transition"
            >
              <Fuel size={12} />
              <span>Get Sepolia ETH (Faucet)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Governance Tab ────────────────────────────────────────────────────────────
function GovTab() {
  const { contract, readContract, account } = useWallet();
  const [govData, setGovData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentVersion, setCurrentVersion] = useState('1.0.0');
  const [proposalCount, setProposalCount] = useState(0);
  const [proposals, setProposals] = useState([]);
  
  // Propose Upgrade State
  const [newImpl, setNewImpl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/governance');
      const d = await r.json();
      setGovData(d);

      if (readContract) {
        // Read version
        try {
          const ver = await readContract.version();
          setCurrentVersion(ver);
        } catch (e) {
          console.warn('version error:', e);
        }

        // Read proposal count
        try {
          const pCount = await readContract.proposalCount();
          setProposalCount(Number(pCount));
          
          const props = [];
          for (let i = 0; i < Number(pCount); i++) {
            const p = await readContract.getUpgradeProposal(i);
            // p is: [address impl, uint256 approvals, bool executed]
            let approvedByMe = false;
            if (account) {
              approvedByMe = await readContract.hasGuardianApproved(i, account);
            }
            props.push({
              id: i,
              impl: p[0] || p.impl,
              approvals: Number(p[1] || p.approvals),
              executed: p[2] || p.executed,
              approvedByMe,
            });
          }
          setProposals(props.reverse()); // Show newest first
        } catch (e) {
          console.warn('proposals read error:', e);
        }
      }
    } catch {}
    setLoading(false);
  }, [readContract, account]);

  useEffect(() => { load(); }, [load]);

  const handlePropose = async (e) => {
    e.preventDefault();
    if (!newImpl || !contract) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const tx = await contract.proposeUpgrade(newImpl);
      setMsg({ type: 'success', text: 'Upgrade Proposed. Waiting for transaction confirmation...' });
      await tx.wait();
      setMsg({ type: 'success', text: 'Upgrade proposed successfully on-chain! Guardians must now co-sign.' });
      setNewImpl('');
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.reason || err.message || 'Upgrade proposal failed.' });
    }
    setSubmitting(false);
  };

  const handleApprove = async (id) => {
    if (!contract) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const tx = await contract.approveUpgrade(id);
      setMsg({ type: 'success', text: 'Signing approval... Please confirm in MetaMask.' });
      await tx.wait();
      setMsg({ type: 'success', text: `Proposal #${id} approved successfully!` });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.reason || err.message || 'Approval transaction failed.' });
    }
    setSubmitting(false);
  };

  const handleExecute = async (id) => {
    if (!contract) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const tx = await contract.executeUpgrade(id);
      setMsg({ type: 'success', text: 'Executing UUPS upgrade transaction...' });
      await tx.wait();
      setMsg({ type: 'success', text: `UUPS upgrade executed successfully! Proxy contract logic is now upgraded.` });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.reason || err.message || 'Execution transaction failed.' });
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-hairline pb-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Governance & UUPS Protocol</h3>
          <p className="text-xs text-body mt-0.5">Underlying Solidity smart contracts config parameters & live upgrade portal.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-1.5 rounded-full bg-canvas cursor-pointer">
          <RefreshCw size={12} /> Sync
        </button>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : (
        <div className="space-y-6">
          {/* Specs */}
          <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4 text-sm">
            <div className="flex justify-between border-b border-hairline pb-2">
              <span className="text-muted font-medium">Platform Proxy Address</span>
              <code className="text-ink font-mono text-xs select-all">{govData?.contractAddress}</code>
            </div>
            <div className="flex justify-between border-b border-hairline pb-2">
              <span className="text-muted font-medium">UUPS Implementation Address</span>
              <code className="text-ink font-mono text-xs select-all">{govData?.implementationAddress}</code>
            </div>
            <div className="flex justify-between border-b border-hairline pb-2">
              <span className="text-muted font-medium">Contract Version</span>
              <span className="text-primary font-bold font-mono text-xs">v{currentVersion}</span>
            </div>
            <div className="flex justify-between border-b border-hairline pb-2">
              <span className="text-muted font-medium">Multi-Sig Co-signers</span>
              <span className="text-ink font-mono font-medium">{govData?.guardiansCount || 3} Guardians</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted font-medium">Consensus Threshold</span>
              <span className="text-ink font-mono font-medium">{govData?.threshold || 2} Signatures</span>
            </div>
          </div>

          {/* Propose Form */}
          <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold text-ink text-sm">Propose New Implementation</h4>
              {govData?.implementationAddress && currentVersion !== '1.0.0' && (
                <button
                  type="button"
                  onClick={() => {
                    setNewImpl(govData.implementationAddress);
                    setMsg({ type: 'success', text: `V1 Address pre-filled: ${govData.implementationAddress}. Click 'Submit Proposal' to initiate the rollback.` });
                  }}
                  className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                >
                  ↩️ Rollback to V1
                </button>
              )}
            </div>
            <form onSubmit={handlePropose} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                placeholder="Paste V2 Implementation Address (0x...)"
                value={newImpl}
                onChange={(e) => setNewImpl(e.target.value)}
                disabled={submitting}
                className="flex-1 bg-canvas border border-hairline rounded-full px-4 py-2.5 text-xs text-ink focus:outline-none focus:border-primary transition"
              />
              <button
                type="submit"
                disabled={submitting || !contract}
                className="bg-primary hover:bg-primary-active disabled:opacity-50 text-white text-xs font-semibold px-6 py-2.5 rounded-full cursor-pointer shadow-sm transition"
              >
                {submitting ? <Loader2 size={12} className="animate-spin" /> : 'Submit Proposal'}
              </button>
            </form>
          </div>

          {/* Upgrade Proposals List */}
          <div className="space-y-4">
            <h4 className="font-semibold text-ink text-sm">Active Upgrade Proposals ({proposalCount})</h4>
            {proposals.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-hairline rounded-xl bg-canvas text-body text-xs">
                No contract upgrade proposals registered yet.
              </div>
            ) : (
              <div className="space-y-3">
                {proposals.map((p) => (
                  <div key={p.id} className="bg-canvas border border-hairline rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink">Proposal #{p.id}</span>
                        {p.executed ? (
                          <span className="text-[10px] bg-green-50 border border-green-200 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                            Executed (Logic Upgraded)
                          </span>
                        ) : p.approvals >= 2 ? (
                          <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold px-2 py-0.5 rounded-full animate-pulse">
                            Ready to Execute
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                            Pending Consensuses ({p.approvals}/2)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-body">
                        New Logic Address: <code className="font-mono bg-surface-soft px-1.5 py-0.5 rounded text-ink text-[10px]">{p.impl}</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!p.executed && (
                        <>
                          {p.approvedByMe ? (
                            <span className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 size={11} /> Approved
                            </span>
                          ) : (
                            <button
                              onClick={() => handleApprove(p.id)}
                              disabled={submitting}
                              className="bg-primary hover:bg-primary-active text-white text-xs font-semibold px-4 py-1.5 rounded-full cursor-pointer transition shadow-sm"
                            >
                              Approve
                            </button>
                          )}
                          {p.approvals >= 2 && (
                            <button
                              onClick={() => handleExecute(p.id)}
                              disabled={submitting}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-1.5 rounded-full cursor-pointer transition shadow-sm"
                            >
                              Execute Upgrade
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const router = useRouter();
  const { account, readContract, provider, disconnect } = useWallet();
  const [guardian, setGuardian] = useState(null);
  const [activeTab, setActiveTab] = useState('approvals');
  const [guardiansList, setGuardiansList] = useState([]);
  const [networkName, setNetworkName] = useState('Checking network...');

  // Get network name from active MetaMask provider
  useEffect(() => {
    if (provider) {
      provider.getNetwork()
        .then(net => {
          const chainId = Number(net.chainId);
          if (chainId === 11155111) {
            setNetworkName(`Sepolia Testnet (ID: ${chainId})`);
          } else if (chainId === 1337 || chainId === 31337) {
            setNetworkName(`Hardhat Local (ID: ${chainId})`);
          } else {
            setNetworkName(net.name || `Chain ${chainId}`);
          }
        })
        .catch(() => setNetworkName('Unknown Network'));
    } else {
      setNetworkName('Offline (RPC default)');
    }
  }, [provider]);

  // Fetch latest guardians list from contract
  useEffect(() => {
    if (readContract && typeof readContract.getGuardians === 'function') {
      readContract.getGuardians()
        .then(list => {
          if (list?.length === 3) setGuardiansList(list);
        })
        .catch(err => console.warn(err));
    }
  }, [readContract]);

  // Sync MetaMask account changes with sessionStorage guardian profile
  useEffect(() => {
    if (!account) {
      // If wallet disconnected, check if we have a session, otherwise redirect
      const address = sessionStorage.getItem('active_guardian_address');
      const id = sessionStorage.getItem('active_guardian_id');
      if (!address || !id) {
        router.replace('/admin-auth');
      } else {
        setGuardian({ id, address });
      }
      return;
    }

    const checkAccount = () => {
      const list = guardiansList.length > 0 ? guardiansList : [
        process.env.NEXT_PUBLIC_GUARDIAN_1 || '0xcda674D670C0b9Fc8C5037a21F00C8D7Db380f9A',
        process.env.NEXT_PUBLIC_GUARDIAN_2 || '0xBf0353eA5cD869e3707B326722Cf8492A0201fbB',
        process.env.NEXT_PUBLIC_GUARDIAN_3 || '0x7b359a8ca8a9419d6Ed0392641B6BE18df79dE84'
      ];
      const idx = list.findIndex(g => g.toLowerCase() === account.toLowerCase());

      if (idx !== -1) {
        const gId = String(idx + 1);
        sessionStorage.setItem('active_guardian_id', gId);
        sessionStorage.setItem('active_guardian_address', account);
        setGuardian({ id: gId, address: account });
      } else {
        // If switched to an unauthorized account, boot to auth gate
        sessionStorage.removeItem('active_guardian_id');
        sessionStorage.removeItem('active_guardian_address');
        setGuardian(null);
        router.replace('/admin-auth');
      }
    };

    checkAccount();
  }, [account, guardiansList, router]);

  const handleLogout = () => {
    sessionStorage.removeItem('active_guardian_id');
    sessionStorage.removeItem('active_guardian_address');
    disconnect();
    router.replace('/admin-auth');
  };

  if (!guardian) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col md:flex-row font-sans">
      
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-hairline bg-surface-soft flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-hairline">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <span className="font-bold text-ink text-base tracking-tight">Guardian Portal</span>
          </div>
        </div>

        {/* Profile Card */}
        <div className="p-4 border-b border-hairline">
          <div className="bg-canvas border border-hairline rounded-xl p-3.5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                <UserCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-ink font-bold text-sm">Guardian #{guardian.id}</p>
                <p className="text-body text-[10px] font-mono truncate">{guardian.address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Links */}
        <nav className="flex-1 p-4 space-y-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-full text-sm font-semibold transition-all cursor-pointer border ${
                  active
                    ? 'bg-primary/10 border-primary/20 text-primary'
                    : 'bg-transparent border-transparent text-body hover:bg-surface-strong'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Signout */}
        <div className="p-4 border-t border-hairline">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-3 rounded-full text-sm text-semantic-down hover:bg-red-50 transition-all font-semibold cursor-pointer border border-transparent hover:border-red-100"
          >
            <LogOut size={15} />
            <span>Close Session</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden border-b border-hairline bg-canvas px-6 py-4 flex items-center justify-between gap-3 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white">
            <Shield size={12} />
          </div>
          <span className="font-bold text-ink text-sm">Guardian Portal</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-semantic-down border border-red-200 bg-red-50/50 px-2.5 py-1.5 rounded-full font-semibold cursor-pointer"
          >
            <LogOut size={11} /> Out
          </button>
        </div>
      </div>

      {/* Mobile Tab Swapper */}
      <div className="md:hidden flex overflow-x-auto bg-surface-soft border-b border-hairline p-2 gap-1 scrollbar-none sticky top-14 z-10">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition ${
                active ? 'bg-primary text-white' : 'text-body hover:bg-surface-strong'
              }`}
            >
              {tab.label.split(' ')[0]}
            </button>
          );
        })}
      </div>

      {/* Main Container */}
      <main className="flex-1 overflow-auto bg-canvas">
        {/* Breadcrumb Header */}
        <div className="border-b border-hairline bg-surface-soft/40 px-6 sm:px-10 py-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-ink font-semibold text-lg">Aegis Guardian Console</h1>
            <p className="text-body text-xs truncate mt-0.5">Multi-Signature Consensus Node Administration</p>
          </div>
          <div className="flex items-center gap-3 font-sans">
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border ${
              networkName === 'Sepolia Testnet'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : networkName === 'Hardhat Local'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              📡 {networkName}
            </span>
            <ThemeToggle />
            <span className="hidden sm:inline text-xs bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full font-semibold">
              Security Clearances
            </span>
          </div>
        </div>

        {/* Tab view */}
        <div className="px-6 sm:px-10 py-8 max-w-5xl">
          {activeTab === 'approvals' && <ApprovalsTab account={guardian.address} />}
          {activeTab === 'results' && <ResultsTab />}
          {activeTab === 'orgs' && <OrgsTab />}
          {activeTab === 'gas' && <GasTab />}
          {activeTab === 'gov' && <GovTab />}
        </div>
      </main>

    </div>
  );
}

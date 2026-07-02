"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import {
  Shield,
  Building2,
  BatteryCharging,
  RefreshCw,
  LogOut,
  AlertCircle,
  CheckCircle,
  Loader2,
  Clock,
  CheckCircle2,
  UserCheck,
} from "lucide-react";

const TABS = [
  { id: "approvals", label: "Election Approvals", icon: Clock },
  { id: "orgs", label: "Organizations", icon: Building2 },
  { id: "gas", label: "Gas Station", icon: BatteryCharging },
  { id: "gov", label: "Governance", icon: Shield },
];

function Toast({ type, msg }) {
  const isErr = type === "error";
  return (
    <div
      className={`flex items-start gap-2 border rounded-xl p-3 mb-4 text-sm ${
        isErr
          ? "bg-red-950/60 border-red-800 text-red-300"
          : "bg-green-950/60 border-green-800 text-green-300"
      }`}
    >
      {isErr ? (
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
      ) : (
        <CheckCircle size={16} className="mt-0.5 shrink-0" />
      )}
      {msg}
    </div>
  );
}

// ── Election Approvals Tab ─────────────────────────────────────────────────────
function ApprovalsTab({ account }) {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/elections?filter=pending");
      const d = await r.json();
      setElections(d.elections || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (electionId, action) => {
    setMsg(null);
    setActioning(electionId);
    try {
      const r = await fetch("/api/admin/elections/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ electionId, guardianAddress: account, action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: "success", text: d.message });
      load();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
    setActioning(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Pending Go-Live Requests</h2>
          <p className="text-slate-400 text-sm">
            Review elections before they go live on-chain.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-700 hover:border-indigo-500 px-3 py-2 rounded-xl transition"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-indigo-500" size={30} />
        </div>
      ) : elections.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
          <CheckCircle2 size={40} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold">No pending requests</p>
          <p className="text-slate-500 text-sm">
            All good! No elections currently need approval.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {elections.map((e) => (
            <div
              key={e._id}
              className="bg-slate-900/60 border border-amber-900/50 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-5 transition hover:border-amber-700/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-amber-950/80 text-amber-400 border border-amber-800/50 px-2 py-0.5 rounded uppercase font-bold tracking-wider animate-pulse">
                    Action Required
                  </span>
                  <span className="text-slate-500 text-xs font-mono">
                    ID: {e.electionId}
                  </span>
                </div>
                <h3 className="text-white font-bold text-lg truncate">
                  {e.title}
                </h3>
                <p className="text-slate-400 text-sm mb-2">{e.description}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Building2 size={12} className="text-indigo-400" />{" "}
                    {e.org?.name || e.orgSlug}
                  </span>
                  <span>
                    Candidates:{" "}
                    <strong className="text-slate-300">
                      {e.candidateCount}
                    </strong>
                  </span>
                  <span>Start: {new Date(e.startTime).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleAction(e.electionId, "reject")}
                  disabled={actioning === e.electionId}
                  className="px-4 py-2 text-sm font-semibold text-red-400 hover:text-white border border-red-900 hover:bg-red-600 rounded-xl transition disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAction(e.electionId, "approve")}
                  disabled={actioning === e.electionId}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-green-600 hover:bg-green-500 text-white rounded-xl transition shadow-lg shadow-green-900/40 disabled:opacity-50"
                >
                  {actioning === e.electionId ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Shield size={14} />
                  )}
                  Approve & Go Live
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Organizations Tab ──────────────────────────────────────────────────────────
function OrgsTab() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/orgs");
      const d = await r.json();
      setOrgs(d.orgs || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleVerify = async (id, isVerified) => {
    try {
      await fetch("/api/admin/orgs/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isVerified }),
      });
      load();
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Organizations Overview</h2>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-700 hover:border-indigo-500 px-3 py-2 rounded-xl transition"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-indigo-500" size={30} />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {orgs.map((o) => (
                <tr
                  key={o._id}
                  className="bg-slate-950/40 hover:bg-slate-900/40 transition"
                >
                  <td className="px-4 py-3 font-medium text-white">{o.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">
                    {o.slug}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{o.adminEmail}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleVerify(o._id, !o.isVerified)}
                      className={`text-xs px-3 py-1 rounded-full font-bold transition border ${
                        o.isVerified
                          ? "bg-green-950/40 text-green-400 border-green-800 hover:bg-red-950/40 hover:text-red-400 hover:border-red-800"
                          : "bg-slate-900 text-slate-400 border-slate-700 hover:bg-green-950/40 hover:text-green-400 hover:border-green-800"
                      }`}
                    >
                      {o.isVerified ? "Verified" : "Unverified"}
                    </button>
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

// ── Gas Station Tab ────────────────────────────────────────────────────────────
function GasStationTab() {
  const [data, setData] = useState({ balance: "0.0", address: "" });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/relay/status");
      const d = await r.json();
      setData(d);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Relay Wallet Reserve</h2>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-700 hover:border-indigo-500 px-3 py-2 rounded-xl transition"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <p className="text-slate-400 text-sm mb-2">Available Gas Balance</p>
        <div className="flex items-end gap-3 mb-6">
          <span className="text-5xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            {loading ? "..." : data.balance}
          </span>
          <span className="text-xl text-slate-500 font-bold mb-1">ETH</span>
        </div>
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800">
          <p className="text-xs text-slate-500 mb-1">
            Relay Wallet Address (fund this to pay for voter gas)
          </p>
          <code className="text-cyan-300 font-mono text-sm break-all">
            {data.address || "Loading..."}
          </code>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const router = useRouter();
  const { account, disconnect } = useWallet();
  const [gid, setGid] = useState(null);
  const [tab, setTab] = useState("approvals");

  useEffect(() => {
    const id = sessionStorage.getItem("active_guardian_id");
    const addr = sessionStorage.getItem("active_guardian_address");
    if (
      !id ||
      !addr ||
      (account && addr.toLowerCase() !== account.toLowerCase())
    ) {
      router.replace("/admin-auth");
    } else {
      setGid(id);
    }
  }, [account, router]);

  const logout = () => {
    sessionStorage.removeItem("active_guardian_id");
    sessionStorage.removeItem("active_guardian_address");
    disconnect();
    router.replace("/admin-auth");
  };

  if (!gid)
    return (
      <div className="min-h-screen bg-[#020617] flex justify-center items-center">
        <Loader2 size={30} className="animate-spin text-indigo-500" />
      </div>
    );

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col md:flex-row">
      {/* ── Sidebar ── */}
      <aside className="w-full md:w-64 border-r border-white/5 bg-slate-950/60 flex flex-col shrink-0 min-h-screen">
        {/* Logo */}
        <div className="p-5 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-black tracking-tight leading-tight">Aegis</h1>
            <p className="text-xs text-indigo-400 font-semibold tracking-wider">
              GUARDIAN PORTAL
            </p>
          </div>
        </div>

        {/* Wallet: address + disconnect */}
        <div className="px-4 pt-4 pb-1">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck size={12} className="text-green-400 shrink-0" />
              <span className="text-xs text-slate-400 shrink-0">Voter:</span>
              <span className="text-xs text-green-400 font-mono truncate">
                {account
                  ? `${account.slice(0, 6)}...${account.slice(-4)}`
                  : "—"}
              </span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 border border-red-900/60 hover:border-red-500 px-2 py-1 rounded-lg transition shrink-0 ml-2"
            >
              <LogOut size={11} /> Disconnect
            </button>
          </div>
        </div>

        {/* Active session badge */}
        <div className="p-4 border-b border-white/5">
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                Active Session
              </p>
              <p className="font-bold text-sm text-indigo-300">
                Guardian No. {gid}
              </p>
            </div>
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                tab === t.id
                  ? "bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-900 font-semibold"
              }`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </nav>

        {/* End session */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-red-500/10 border border-slate-800 hover:border-red-500/30 text-slate-400 hover:text-red-400 rounded-xl text-sm font-semibold transition"
          >
            <LogOut size={16} /> End Session
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-5xl">
          {tab === "approvals" && <ApprovalsTab account={account} />}
          {tab === "orgs" && <OrgsTab />}
          {tab === "gas" && <GasStationTab />}
          {tab === "gov" && (
            <div className="text-center py-20 border border-slate-800 border-dashed rounded-2xl bg-slate-900/30">
              <Shield size={40} className="text-slate-700 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-1">Protocol Upgrades</h2>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                No UUPS upgrade proposals are currently pending 2-of-3 multisig
                verification.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

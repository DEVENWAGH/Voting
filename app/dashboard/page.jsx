'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import {
  LayoutDashboard, Users, LogOut, PlusCircle,
  Upload, Download, RefreshCw, FileSpreadsheet, CheckCircle,
  AlertCircle, Loader2, Building2, ChevronRight, BarChart3, Vote,
  ArrowLeft, ChevronDown, UserPlus, Play, StopCircle, Shield,
  Clock, CheckCircle2, XCircle
} from 'lucide-react';

const PHASE = ['Registration', 'Voting', 'Completed'];
const PHASE_COLORS = [
  'bg-blue-950/50 text-blue-300 border-blue-800',
  'bg-green-950/50 text-green-300 border-green-800',
  'bg-slate-950/50 text-slate-400 border-slate-700',
];

// ── Shared UI ─────────────────────────────────────────────────────────────────
function FieldInput({ label, value, onChange, placeholder = '', type = 'text', multiline = false }) {
  const base = "w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-white px-4 py-2.5 rounded-xl outline-none transition text-sm placeholder:text-slate-600";
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{label}</label>
      {multiline
        ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3} className={`${base} resize-none`} />
        : <input type={type} value={value} onChange={onChange} placeholder={placeholder} className={base} />
      }
    </div>
  );
}

function Toast({ type, msg }) {
  const s = type === 'error'
    ? 'bg-red-950/60 border-red-700 text-red-300'
    : 'bg-green-950/60 border-green-700 text-green-300';
  const Icon = type === 'error' ? AlertCircle : CheckCircle;
  return (
    <div className={`flex gap-2.5 items-start border rounded-xl p-3 mt-4 text-sm ${s}`}>
      <Icon size={15} className="shrink-0 mt-0.5" /> {msg}
    </div>
  );
}

// ── Candidate Management Panel ────────────────────────────────────────────────
function CandidatePanel({ slug, electionId }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', party: '', symbol: '', manifesto: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/org/${slug}/elections/${electionId}/candidates`);
      const d = await r.json();
      setCandidates(d.candidates || []);
    } catch {}
    setLoading(false);
  }, [slug, electionId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setMsg(null); setSaving(true);
    try {
      const r = await fetch(`/api/org/${slug}/elections/${electionId}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: `Candidate "${form.name}" added on-chain!` });
      setForm({ name: '', party: '', symbol: '', manifesto: '' });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-white font-bold flex items-center gap-2 text-sm">
        <UserPlus size={14} className="text-violet-400" /> Add Candidate
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FieldInput label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Candidate full name" />
        <FieldInput label="Party / Affiliation" value={form.party} onChange={e => setForm(f => ({ ...f, party: e.target.value }))} placeholder="Party or group" />
        <FieldInput label="Symbol" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} placeholder="e.g. 🦅 or Eagle" />
        <FieldInput label="Manifesto (optional)" value={form.manifesto} onChange={e => setForm(f => ({ ...f, manifesto: e.target.value }))} placeholder="Brief manifesto…" multiline />
      </div>
      {msg && <Toast type={msg.type} msg={msg.text} />}
      <button onClick={add} disabled={saving || !form.name || !form.party || !form.symbol}
        className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition">
        {saving ? <><Loader2 size={14} className="animate-spin" />Adding…</> : <><UserPlus size={14} />Add Candidate</>}
      </button>

      {/* Existing candidates */}
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-indigo-500" size={20} /></div>
      ) : candidates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {candidates.map(c => (
            <div key={c.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-950/50 border border-violet-500/20 flex items-center justify-center text-sm">
                {c.symbol || '🗳️'}
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">{c.name}</p>
                <p className="text-slate-500 text-xs truncate">{c.party}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CSV Upload Panel ──────────────────────────────────────────────────────────
function CsvUploadPanel({ orgSlug, orgId, electionId }) {
  const [voters, setVoters]             = useState([]);
  const [counts, setCounts]             = useState({ pending: 0, registered: 0, rejected: 0, total: 0 });
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [registering, setRegistering]   = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [msg, setMsg]                   = useState(null);

  const slug = orgSlug || '';
  const id   = orgId   ? String(orgId) : '';

  const loadVoters = useCallback(async () => {
    if ((!slug && !id) || electionId == null) return;
    setLoadingVoters(true);
    try {
      const r = await fetch(`/api/voters/list?orgSlug=${slug}&electionId=${electionId}&limit=100`);
      const d = await r.json();
      setVoters(d.voters || []);
      if (d.counts) setCounts(d.counts);
    } catch {}
    setLoadingVoters(false);
  }, [slug, id, electionId]);

  useEffect(() => { loadVoters(); }, [loadVoters]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv':                 ['csv'],
      'text/plain':               ['csv'],
      'application/csv':          ['csv'],
      'application/vnd.ms-excel': ['csv'],
      'application/octet-stream': ['csv'],
    },
    maxFiles: 1,
    onDropAccepted: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;
      if (!slug && !id) {
        setMsg({ type: 'error', text: 'Org not loaded yet — please wait and try again.' });
        return;
      }
      setUploading(true); setMsg(null); setUploadResult(null);

      const fd = new FormData();
      fd.append('file', file);
      if (slug) fd.append('orgSlug', slug);
      if (id)   fd.append('orgId',   id);
      fd.append('electionId', String(electionId));

      try {
        const r = await fetch('/api/voters/upload-csv', { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setUploadResult(d);
        const parts = [
          d.upserted > 0 ? `${d.upserted} new voter(s) added`         : '',
          d.updated  > 0 ? `${d.updated} existing voter(s) refreshed`  : '',
          d.errors?.length > 0 ? `${d.errors.length} row error(s)`      : '',
        ].filter(Boolean);
        setMsg({ type: 'success', text: parts.join(' · ') || 'CSV processed.' });
        loadVoters();
      } catch (e) {
        setMsg({ type: 'error', text: e.message });
      }
      setUploading(false);
    },
    onDropRejected: () => {
      setMsg({ type: 'error', text: 'Invalid file. Please upload a .csv file.' });
    },
  });

  const bulkRegister = async () => {
    setRegistering(true); setMsg(null);
    try {
      const r = await fetch('/api/voters/bulk-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgSlug: slug, electionId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({
        type: 'success',
        text: `Registered ${d.registered} voter(s) on-chain!${d.failed > 0 ? ` (${d.failed} failed)` : ''}`,
      });
      loadVoters();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setRegistering(false);
  };

  return (
    <div className="space-y-5">
      {/* Upload card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-white flex items-center gap-2 text-sm">
            <FileSpreadsheet size={14} className="text-indigo-400" /> Upload Voter List
          </h3>
          <a href="/api/voters/template" download
            className="flex items-center gap-1.5 text-xs bg-slate-950 border border-slate-700 hover:border-indigo-500 text-slate-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg transition">
            <Download size={12} /> Template
          </a>
        </div>
        <code className="block bg-slate-950 rounded-xl p-2.5 mb-3 text-xs text-slate-500 font-mono">
          name, email, phone, gender, age
        </code>

        <div {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
            isDragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 hover:border-indigo-500/40'
          }`}>
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="animate-spin text-indigo-500" size={24} />
              <p className="text-slate-500 text-sm">Processing CSV…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={24} className="text-slate-700" />
              <p className="text-slate-400 text-sm">
                {isDragActive ? 'Drop CSV here…' : 'Drag & drop CSV, or click to browse'}
              </p>
            </div>
          )}
        </div>

        {msg && <Toast type={msg.type} msg={msg.text} />}

        {uploadResult?.errors?.length > 0 && (
          <div className="mt-3 bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-32 overflow-y-auto">
            <p className="text-slate-600 text-xs mb-1 font-semibold">Row Errors ({uploadResult.errors.length}):</p>
            {uploadResult.errors.map((e, i) => (
              <p key={i} className="text-red-400 text-xs py-0.5">Row {e.row} · {e.email} — {e.reason}</p>
            ))}
          </div>
        )}
      </div>

      {/* Voter list */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-bold flex items-center gap-2 text-sm">
              <Users size={14} className="text-indigo-400" /> Voters
            </h3>
            <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-full px-2 py-0.5">
              {counts.total} total
            </span>
            <span className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800/30 rounded-full px-2 py-0.5">
              {counts.pending} pending
            </span>
            <span className="text-xs text-green-400 bg-green-950/30 border border-green-800/30 rounded-full px-2 py-0.5">
              {counts.registered} on-chain
            </span>
          </div>
          <button onClick={loadVoters} className="text-xs text-slate-600 hover:text-white flex items-center gap-1 transition">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {counts.pending > 0 && (
          <button onClick={bulkRegister} disabled={registering}
            className="mb-3 w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm transition">
            {registering
              ? <><Loader2 size={14} className="animate-spin" /> Registering…</>
              : <><CheckCircle size={14} /> Register {counts.pending} Pending Voter{counts.pending !== 1 ? 's' : ''} On-Chain</>
            }
          </button>
        )}

        {loadingVoters ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-indigo-500" size={20} /></div>
        ) : voters.length === 0 ? (
          <div className="text-center py-8 text-slate-600 text-sm border border-dashed border-slate-800 rounded-2xl">
            No voters uploaded yet. Use the CSV upload above.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-500 text-xs">
                  <th className="text-left px-4 py-2.5 font-semibold">Name</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Email</th>
                  <th className="text-left px-4 py-2.5 font-semibold hidden md:table-cell">Phone</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {voters.map((v, i) => (
                  <tr key={v._id || i}
                    className={`border-b border-slate-900 hover:bg-slate-900/40 transition ${i % 2 === 0 ? 'bg-slate-950/60' : 'bg-slate-950/30'}`}>
                    <td className="px-4 py-2.5 text-white font-medium">{v.name}</td>
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{v.email}</td>
                    <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">{v.phone || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${
                        v.status === 'registered' ? 'bg-green-950/50 text-green-400 border-green-800/30' :
                        v.status === 'rejected'   ? 'bg-red-950/50   text-red-400   border-red-800/30'   :
                                                    'bg-amber-950/30 text-amber-400 border-amber-800/30'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Elections Tab ─────────────────────────────────────────────────────────────
function ElectionsTab({ slug, org }) {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', description: '', startTime: '', endTime: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [phaseLoading, setPhaseLoading] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/org/${slug}/elections`);
      const d = await r.json();
      setElections(d.elections || []);
    } catch {}
    finally { setLoading(false); }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setMsg(null); setSaving(true);
    try {
      const r = await fetch(`/api/org/${slug}/elections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          startTime: form.startTime ? new Date(form.startTime).toISOString() : form.startTime,
          endTime:   form.endTime   ? new Date(form.endTime).toISOString()   : form.endTime,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: `Election "${form.title}" created!` });
      setForm({ title: '', description: '', startTime: '', endTime: '' });
      setShowForm(false);
      setTimeout(() => load(), 1500);
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setSaving(false);
  };

  const handlePhaseAction = async (electionId, action) => {
    setPhaseLoading(electionId);
    try {
      const r = await fetch(`/api/org/${slug}/elections/${electionId}/phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: d.message });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setPhaseLoading(null);
  };

  // Guardian approval status badge
  const ApprovalBadge = ({ election }) => {
    if (election.phase === 2) return null;
    if (election.guardianApproved) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full border font-semibold bg-green-950/40 text-green-400 border-green-800/30 flex items-center gap-1">
          <Shield size={10} /> Guardian Verified
        </span>
      );
    }
    if (election.pendingApproval) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full border font-semibold bg-amber-950/40 text-amber-400 border-amber-800/30 flex items-center gap-1 animate-pulse">
          <Clock size={10} /> Awaiting Guardian
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-black text-lg">Elections</h2>
          <p className="text-slate-500 text-sm">{elections.length} total election{elections.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white border border-slate-800 hover:border-slate-700 px-3 py-2 rounded-xl transition">
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={() => setShowForm(f => !f)}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-indigo-950/40">
            <PlusCircle size={15} /> New Election
          </button>
        </div>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      {showForm && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-bold flex items-center gap-2">
            <PlusCircle size={16} className="text-indigo-400" /> Create Election
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldInput label="Title"       value={form.title}       onChange={e => setForm(f => ({ ...f, title:       e.target.value }))} placeholder="e.g. Student Body Election 2024" />
            <FieldInput label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description…" multiline />
            <FieldInput label="Start Time"  type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            <FieldInput label="End Time"    type="datetime-local" value={form.endTime}   onChange={e => setForm(f => ({ ...f, endTime:   e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-xl transition">Cancel</button>
            <button onClick={create} disabled={saving}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition">
              {saving ? <><Loader2 size={14} className="animate-spin" />Creating…</> : 'Create Election'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-indigo-500" size={28} /></div>
      ) : elections.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl">
          <BarChart3 size={40} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold">No elections yet</p>
          <p className="text-slate-600 text-sm mt-1">Click &quot;New Election&quot; to create your first one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {elections.map(e => {
            const isExpanded = expandedId === (e._id || e.id);
            const isRegistration = (e.phase ?? 0) === 0;
            const isVoting = (e.phase ?? 0) === 1;
            const isCompleted = (e.phase ?? 0) === 2;

            return (
              <div key={e._id || e.id}
                className={`bg-slate-900/50 border rounded-2xl transition ${
                  isExpanded ? 'border-indigo-500/40' : 'border-slate-800 hover:border-slate-700'
                }`}>
                {/* Election header row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : (e._id || e.id))}
                  className="w-full flex items-center justify-between p-5 text-left cursor-pointer">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{e.title}</p>
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{e.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <ApprovalBadge election={e} />
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${PHASE_COLORS[e.phase ?? 0]}`}>
                      {PHASE[e.phase ?? 0]}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-5 pb-6 border-t border-slate-800/60 space-y-6 pt-4">

                    {/* Phase action buttons */}
                    <div className="flex flex-wrap gap-2">
                      {isRegistration && !e.pendingApproval && !e.guardianApproved && (
                        <button
                          onClick={() => handlePhaseAction(e.id, 'request-live')}
                          disabled={phaseLoading === e.id}
                          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold text-sm transition">
                          {phaseLoading === e.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                          Request Go Live
                        </button>
                      )}
                      {isRegistration && e.pendingApproval && (
                        <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-800/30 text-amber-400 px-4 py-2 rounded-xl text-sm font-semibold">
                          <Clock size={14} className="animate-pulse" /> Waiting for Guardian Approval…
                        </div>
                      )}
                      {isVoting && (
                        <button
                          onClick={() => handlePhaseAction(e.id, 'end-election')}
                          disabled={phaseLoading === e.id}
                          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold text-sm transition">
                          {phaseLoading === e.id ? <Loader2 size={14} className="animate-spin" /> : <StopCircle size={14} />}
                          End Election
                        </button>
                      )}
                      {isCompleted && (
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <CheckCircle2 size={14} className="text-slate-500" /> Election completed — results are public
                        </div>
                      )}
                    </div>

                    {/* Candidate management (Registration phase only) */}
                    {isRegistration && (
                      <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-5">
                        <CandidatePanel slug={slug} electionId={e.id} />
                      </div>
                    )}

                    {/* Voter CSV upload (Registration phase) */}
                    {isRegistration && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <FileSpreadsheet size={14} className="text-blue-400" />
                          <p className="text-blue-300 text-xs font-bold uppercase tracking-wider">Voter Import — Registration Phase</p>
                        </div>
                        <p className="text-slate-500 text-xs mb-3">
                          Upload a CSV to add voters for this election. Each election has its own separate voter list.
                        </p>
                        <CsvUploadPanel orgSlug={slug} orgId={org?._id} electionId={e.id} />
                      </div>
                    )}

                    {/* Voter link for live elections */}
                    {isVoting && (
                      <div className="bg-green-950/20 border border-green-800/30 rounded-2xl p-5">
                        <h4 className="text-green-400 font-bold text-sm mb-2 flex items-center gap-2">
                          <Vote size={14} /> Election is LIVE
                        </h4>
                        <p className="text-slate-400 text-sm mb-3">Share this link with your voters:</p>
                        <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                          <code className="text-indigo-300 text-sm font-mono truncate">
                            {typeof window !== 'undefined' ? `${window.location.origin}/vote/${slug}` : `/vote/${slug}`}
                          </code>
                          <button
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/vote/${slug}`)}
                            className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold transition shrink-0">
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [org, setOrg] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    const slug = session?.user?.orgSlug;
    if (!slug) return;
    fetch(`/api/orgs/register?slug=${slug}`)
      .then(r => r.json())
      .then(d => setOrg(d.org))
      .catch(() => {});
  }, [session?.user?.orgSlug]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 size={36} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!session) return null;

  const slug    = session.user.orgSlug;
  const orgName = org?.name || session.user.name || slug;

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="flex min-h-screen">

        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-white/5 bg-slate-950/60 flex flex-col">
          {/* Logo */}
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Vote size={16} className="text-white" />
              </div>
              <span className="font-black text-sm tracking-tight">Block Vote</span>
            </div>
          </div>

          {/* Org info */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-3 bg-slate-900/60 rounded-xl p-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-950/80 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Building2 size={16} className="text-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">{orgName}</p>
                <p className="text-slate-500 text-xs">{org?.type || 'Organization'}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1">
            <div className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
              <BarChart3 size={15} /> Elections
              <ChevronRight size={13} className="text-indigo-400 ml-auto" />
            </div>
            <p className="text-slate-600 text-xs px-3 pt-2">
              Manage elections, candidates, and voters.
            </p>
          </nav>

          {/* User + Sign out */}
          <div className="p-3 border-t border-white/5">
            <div className="px-3 py-2 mb-1">
              <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
            </div>
            <button
              id="dashboard-signout-btn"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition font-semibold">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {/* Top bar */}
          <div className="sticky top-0 z-10 border-b border-white/5 bg-[#020617]/90 backdrop-blur-xl px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-white font-black text-lg">Elections</h1>
              <p className="text-slate-500 text-xs">{orgName} · Admin Dashboard</p>
            </div>
            <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25 px-3 py-1 rounded-full font-semibold">
              Org Admin
            </span>
          </div>

          {/* Content */}
          <div className="px-8 py-8 max-w-5xl">
            {slug && <ElectionsTab slug={slug} org={org} />}
          </div>
        </main>
      </div>
    </div>
  );
}

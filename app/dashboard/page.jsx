'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import {
  Shield, LayoutDashboard, Users, LogOut, PlusCircle, List,
  Upload, Download, RefreshCw, FileSpreadsheet, CheckCircle,
  AlertCircle, Loader2, Building2, ChevronRight, BarChart3, Vote
} from 'lucide-react';

const PHASE = ['Registration', 'Voting', 'Completed'];
const PHASE_COLORS = [
  'bg-blue-950/50 text-blue-300 border-blue-800',
  'bg-green-950/50 text-green-300 border-green-800',
  'bg-slate-950/50 text-slate-400 border-slate-700',
];

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

// ── Elections Tab ─────────────────────────────────────────────────────────────
function ElectionsTab({ slug }) {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', description: '', startTime: '', endTime: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showForm, setShowForm] = useState(false);

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
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: `Election "${form.title}" created!` });
      setForm({ title: '', description: '', startTime: '', endTime: '' });
      setShowForm(false);
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-black text-lg">Elections</h2>
          <p className="text-slate-500 text-sm">{elections.length} total election{elections.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-indigo-950/40">
          <PlusCircle size={15} /> New Election
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-bold flex items-center gap-2"><PlusCircle size={16} className="text-indigo-400" /> Create Election</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldInput label="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Student Body Election 2024" />
            <FieldInput label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description…" multiline />
            <FieldInput label="Start Time" type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            <FieldInput label="End Time" type="datetime-local" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
          </div>
          {msg && <Toast type={msg.type} msg={msg.text} />}
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-xl transition">Cancel</button>
            <button onClick={create} disabled={saving} className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition">
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
          <p className="text-slate-600 text-sm mt-1">Click "New Election" to create your first one</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {elections.map(e => (
            <div key={e._id || e.id} className="bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition group">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-bold text-sm">{e.title}</p>
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${PHASE_COLORS[e.phase || 0]}`}>
                  {PHASE[e.phase || 0]}
                </span>
              </div>
              <p className="text-slate-500 text-xs line-clamp-2">{e.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Voters Tab ────────────────────────────────────────────────────────────────
function VotersTab({ slug, orgId }) {
  const [batches, setBatches] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [msg, setMsg] = useState(null);

  const loadBatches = useCallback(async () => {
    if (!orgId) return;
    try {
      const r = await fetch(`/api/voters/batches?orgId=${orgId}`);
      const d = await r.json();
      setBatches(d.batches || []);
    } catch {}
  }, [orgId]);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    onDrop: async ([file]) => {
      if (!file) return;
      setUploading(true); setMsg(null); setUploadResult(null);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('orgId', orgId);
      try {
        const r = await fetch('/api/voters/upload-csv', { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setUploadResult(d);
        setMsg({ type: 'success', text: `Uploaded: ${d.inserted} valid rows. ${d.errors?.length || 0} errors.` });
        loadBatches();
      } catch (e) { setMsg({ type: 'error', text: e.message }); }
      setUploading(false);
    },
  });

  const bulkRegister = async (batchId) => {
    setRegistering(true); setMsg(null);
    try {
      const r = await fetch('/api/voters/bulk-register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, orgId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: `Registered ${d.registered} voters on-chain!` });
      loadBatches();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setRegistering(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-black text-lg">Voter Management</h2>
        <p className="text-slate-500 text-sm">Upload a CSV to import and register voters</p>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white flex items-center gap-2"><FileSpreadsheet size={16} className="text-indigo-400" /> Upload Voter List</h3>
          <a href="/api/voters/template" download className="flex items-center gap-1.5 text-xs bg-slate-950 border border-slate-700 hover:border-indigo-500 text-slate-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg transition">
            <Download size={12} /> Template
          </a>
        </div>
        <code className="block bg-slate-950 rounded-xl p-3 mb-4 text-xs text-slate-500 font-mono">name, email, phone, member_id, role, notes</code>

        <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${isDragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 hover:border-indigo-500/40'}`}>
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-3"><Loader2 className="animate-spin text-indigo-500" size={28} /><p className="text-slate-500 text-sm">Processing CSV…</p></div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload size={28} className="text-slate-700" />
              <p className="text-slate-400 text-sm">{isDragActive ? 'Drop CSV here…' : 'Drag & drop CSV, or click to browse'}</p>
              <p className="text-slate-600 text-xs">Max 5MB · 10,000 rows · .csv only</p>
            </div>
          )}
        </div>

        {msg && <Toast type={msg.type} msg={msg.text} />}
        {uploadResult?.errors?.length > 0 && (
          <div className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-4 max-h-40 overflow-y-auto">
            <p className="text-slate-600 text-xs mb-2 font-semibold">Errors ({uploadResult.errors.length}):</p>
            {uploadResult.errors.map((e, i) => <p key={i} className="text-red-400 text-xs py-0.5">Row {e.row} · {e.memberId} — {e.reason}</p>)}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold flex items-center gap-2"><Users size={15} className="text-indigo-400" /> Upload History ({batches.length})</h3>
          <button onClick={loadBatches} className="text-xs text-slate-600 hover:text-white flex items-center gap-1 transition"><RefreshCw size={11} /> Refresh</button>
        </div>
        {batches.length === 0 ? (
          <div className="text-center py-10 text-slate-600 text-sm border border-dashed border-slate-800 rounded-2xl">No uploads yet.</div>
        ) : (
          <div className="space-y-2">
            {batches.map(b => (
              <div key={b._id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-semibold text-sm">{b.filename}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {b.totalRows} total · <span className="text-green-400">{b.validRows} valid</span> · <span className="text-red-400">{b.errorRows} errors</span>
                    {b.registeredRows > 0 && <> · <span className="text-indigo-300">{b.registeredRows} on-chain</span></>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${b.status === 'completed' ? 'bg-green-950/50 text-green-400' : b.status === 'registering' ? 'bg-indigo-950/50 text-indigo-400' : b.status === 'failed' ? 'bg-red-950/50 text-red-400' : 'bg-slate-950 text-slate-500'}`}>
                    {b.status}
                  </span>
                  {b.status === 'uploaded' && b.validRows > 0 && (
                    <button onClick={() => bulkRegister(b._id)} disabled={registering}
                      className="text-xs bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition">
                      {registering ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />} Register On-Chain
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'elections', label: 'Elections',        icon: BarChart3 },
  { id: 'voters',    label: 'Voter Management', icon: Users },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState('elections');
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

  const slug = session.user.orgSlug;
  const orgName = org?.name || session.user.name || slug;

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* ── Sidebar + content layout ── */}
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
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  tab === id
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={15} />
                  {label}
                </div>
                {tab === id && <ChevronRight size={13} className="text-indigo-400" />}
              </button>
            ))}
          </nav>

          {/* User + Sign out */}
          <div className="p-3 border-t border-white/5">
            <div className="px-3 py-2 mb-1">
              <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
            </div>
            <button
              id="dashboard-signout-btn"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition font-semibold"
            >
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {/* Top bar */}
          <div className="sticky top-0 z-10 border-b border-white/5 bg-[#020617]/90 backdrop-blur-xl px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-white font-black text-lg">{TABS.find(t => t.id === tab)?.label}</h1>
              <p className="text-slate-500 text-xs">{orgName} · Admin Dashboard</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25 px-3 py-1 rounded-full font-semibold">
                Org Admin
              </span>
            </div>
          </div>

          {/* Tab content */}
          <div className="px-8 py-8 max-w-5xl">
            {tab === 'elections' && slug && <ElectionsTab slug={slug} />}
            {tab === 'voters'    && slug && <VotersTab    slug={slug} orgId={org?._id} />}
          </div>
        </main>
      </div>
    </div>
  );
}

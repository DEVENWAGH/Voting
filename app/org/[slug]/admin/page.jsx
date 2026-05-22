'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import {
  LayoutDashboard, PlusCircle, UserPlus, Users, Upload, CheckCircle,
  AlertCircle, Loader2, Download, RefreshCw, FileSpreadsheet, ArrowRightCircle, List
} from 'lucide-react';

const PHASE = ['Registration', 'Voting', 'Completed'];
const PHASE_COLOR = ['text-blue-400 border-blue-700 bg-blue-900/20', 'text-green-400 border-green-700 bg-green-900/20', 'text-gray-400 border-gray-700 bg-gray-900/20'];

function Inp({ label, value, onChange, placeholder = '', type = 'text' }) {
  return (
    <div>
      <label className="block text-xs text-[#64748b] mb-1">{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full bg-[#0f172a] border border-[#334155] focus:border-[#6366f1] text-white px-4 py-2.5 rounded-xl outline-none transition text-sm" />
    </div>
  );
}

function Alert({ type, msg }) {
  const s = type === 'error'
    ? 'bg-red-900/20 border-red-700 text-red-300'
    : 'bg-green-900/20 border-green-700 text-green-300';
  const Icon = type === 'error' ? AlertCircle : CheckCircle;
  return <div className={`flex gap-2 items-start border rounded-xl p-3 mt-3 text-sm ${s}`}><Icon size={14} className="shrink-0 mt-0.5" />{msg}</div>;
}

// ── Tab 1: Elections ──────────────────────────────────────────────────────────
function ElectionsTab({ slug }) {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', description: '', startTime: '', endTime: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/org/${slug}/elections`);
      const d = await r.json();
      setElections(d.elections || []);
    } catch { } finally { setLoading(false); }
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
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6">
        <h2 className="font-black text-white mb-4 flex items-center gap-2"><PlusCircle size={18} className="text-green-400" /> Create Election</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Inp label="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Election title" />
          <div className="md:col-span-1">
            <label className="block text-xs text-[#64748b] mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full bg-[#0f172a] border border-[#334155] focus:border-[#6366f1] text-white px-4 py-2.5 rounded-xl outline-none transition text-sm resize-none" />
          </div>
          <Inp label="Start Time" type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
          <Inp label="End Time" type="datetime-local" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
        </div>
        {msg && <Alert type={msg.type} msg={msg.text} />}
        <button onClick={create} disabled={saving} className="mt-4 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : 'Create Election'}
        </button>
      </div>

      <div>
        <h3 className="text-white font-bold mb-3 flex items-center gap-2"><List size={16} className="text-[#6366f1]" /> All Elections ({elections.length})</h3>
        {loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#6366f1]" /></div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {elections.map(e => (
              <div key={e._id || e.id} className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-bold">{e.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${PHASE_COLOR[e.phase || 0]}`}>{PHASE[e.phase || 0]}</span>
                </div>
                <p className="text-[#64748b] text-sm line-clamp-2">{e.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 2: Voter Management ───────────────────────────────────────────────────
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
    } catch { }
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
      {/* Instructions */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black text-white flex items-center gap-2"><FileSpreadsheet size={18} className="text-[#6366f1]" /> Upload Voter List</h2>
          <a href="/api/voters/template" download className="flex items-center gap-1.5 text-xs bg-[#0f172a] border border-[#334155] hover:border-[#6366f1] text-[#94a3b8] hover:text-[#a5b4fc] px-3 py-1.5 rounded-lg transition">
            <Download size={12} /> Download Template
          </a>
        </div>
        <div className="bg-[#0f172a] rounded-xl p-3 mb-4 text-xs text-[#64748b] font-mono">
          name, email, phone, member_id, role, notes
        </div>

        {/* Dropzone */}
        <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${isDragActive ? 'border-[#6366f1] bg-[#6366f1]/10' : 'border-[#334155] hover:border-[#6366f1]/50'}`}>
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-3"><Loader2 className="animate-spin text-[#6366f1]" size={32} /><p className="text-[#64748b] text-sm">Processing CSV…</p></div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload size={32} className="text-[#334155]" />
              <p className="text-[#94a3b8] text-sm">{isDragActive ? 'Drop CSV here…' : 'Drag & drop CSV file, or click to browse'}</p>
              <p className="text-[#475569] text-xs">Max 5MB · 10,000 rows · .csv only</p>
            </div>
          )}
        </div>

        {msg && <Alert type={msg.type} msg={msg.text} />}

        {uploadResult && uploadResult.errors?.length > 0 && (
          <div className="mt-4 bg-[#0f172a] border border-[#334155] rounded-xl p-4 max-h-48 overflow-y-auto">
            <p className="text-[#64748b] text-xs mb-2 font-semibold">Errors ({uploadResult.errors.length}):</p>
            {uploadResult.errors.map((e, i) => (
              <p key={i} className="text-red-400 text-xs py-0.5">Row {e.row} · {e.memberId} — {e.reason}</p>
            ))}
          </div>
        )}
      </div>

      {/* Batches */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold flex items-center gap-2"><Users size={16} className="text-[#6366f1]" /> Upload History</h3>
          <button onClick={loadBatches} className="text-xs text-[#64748b] hover:text-white flex items-center gap-1"><RefreshCw size={12} /> Refresh</button>
        </div>
        {batches.length === 0 ? (
          <p className="text-[#475569] text-center py-8 text-sm">No uploads yet.</p>
        ) : (
          <div className="space-y-3">
            {batches.map(b => (
              <div key={b._id} className="bg-[#1e293b] border border-[#334155] rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-white font-semibold text-sm">{b.filename}</p>
                  <p className="text-[#64748b] text-xs mt-0.5">
                    {b.totalRows} total · <span className="text-green-400">{b.validRows} valid</span> · <span className="text-red-400">{b.errorRows} errors</span>
                    {b.registeredRows > 0 && <> · <span className="text-[#a5b4fc]">{b.registeredRows} on-chain</span></>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    b.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                    b.status === 'registering' ? 'bg-[#6366f1]/20 text-[#a5b4fc]' :
                    b.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                    'bg-[#0f172a] text-[#64748b]'
                  }`}>{b.status}</span>
                  {b.status === 'uploaded' && b.validRows > 0 && (
                    <button onClick={() => bulkRegister(b._id)} disabled={registering}
                      className="text-xs bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition">
                      {registering ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                      Register On-Chain
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

// ── Main Org Admin Page ───────────────────────────────────────────────────────
const TABS = [
  { id: 'elections', label: 'Elections', icon: LayoutDashboard },
  { id: 'voters', label: 'Voter Management', icon: Users },
];

export default function OrgAdminPage() {
  const { slug } = useParams();
  const [tab, setTab] = useState('elections');
  const [org, setOrg] = useState(null);

  useEffect(() => {
    fetch(`/api/orgs/register?slug=${slug}`).then(r => r.json()).then(d => setOrg(d.org)).catch(() => { });
  }, [slug]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="border-b border-[#1e293b] bg-[#0f172a]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-white font-black text-lg leading-none">{org?.name || slug}</h1>
            <p className="text-[#64748b] text-xs">Org Admin Dashboard</p>
          </div>
          <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full font-semibold">Org Admin</span>
        </div>
        <div className="max-w-6xl mx-auto px-6 flex gap-1 pb-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${tab === id ? 'border-[#6366f1] text-[#a5b4fc]' : 'border-transparent text-[#64748b] hover:text-white'}`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {tab === 'elections' && <ElectionsTab slug={slug} />}
        {tab === 'voters'    && <VotersTab slug={slug} orgId={org?._id} />}
      </div>
    </div>
  );
}

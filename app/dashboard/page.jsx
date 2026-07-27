'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, LogOut, PlusCircle, Upload, Download, RefreshCw,
  FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Building2,
  ChevronRight, BarChart3, ChevronDown, UserPlus, Play, StopCircle,
  Shield, Clock, CheckCircle2, Trophy, ImagePlus, X, Vote
} from 'lucide-react';
import ElectionResults from '@/components/ElectionResults';
import ThemeToggle from '@/components/ThemeToggle';

const PHASE = ['Registration', 'Voting', 'Completed'];
const PHASE_COLORS = [
  'bg-blue-50 text-blue-600 border-blue-200',
  'bg-emerald-50 text-emerald-600 border-emerald-200',
  'bg-surface-strong text-muted border-hairline',
];

// ── Shared UI Components ──────────────────────────────────────────────────────
function FieldInput({ label, value, onChange, placeholder = '', type = 'text', multiline = false }) {
  const base = "w-full bg-canvas border border-hairline focus:border-primary text-ink px-4 py-2.5 rounded-lg outline-none transition text-sm placeholder:text-muted";
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-body uppercase tracking-wider">{label}</label>
      {multiline
        ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3} className={`${base} resize-none`} />
        : <input type={type} value={value} onChange={onChange} placeholder={placeholder} className={base} />
      }
    </div>
  );
}

function Toast({ type, msg }) {
  const isErr = type === 'error';
  const bg = isErr ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700';
  const Icon = isErr ? AlertCircle : CheckCircle;
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2.5 items-start border rounded-lg p-3 text-sm ${bg}`}
    >
      <Icon size={16} className="shrink-0 mt-0.5" />
      <span>{msg}</span>
    </motion.div>
  );
}

// ── Candidate Management Panel ────────────────────────────────────────────────
function CandidatePanel({ slug, electionId }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', party: '', symbol: '', manifesto: '', photoUrl: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [msg, setMsg] = useState(null);

  // Fetch candidates using React Query
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['candidates', slug, electionId],
    queryFn: async () => {
      const r = await fetch(`/api/org/${slug}/elections/${electionId}/candidates`);
      const d = await r.json();
      return d.candidates || [];
    },
    enabled: !!slug && electionId != null,
  });

  const onPhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setForm((f) => ({ ...f, photoUrl: '' }));
  };

  const uploadPhoto = async () => {
    if (!photoFile) return form.photoUrl;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('file', photoFile);
      fd.append('folder', `candidates/${slug}`);
      const r = await fetch('/api/imagekit/upload', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Photo upload failed');
      return d.url;
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Add Candidate Mutation
  const addMutation = useMutation({
    mutationFn: async (payload) => {
      const r = await fetch(`/api/org/${slug}/elections/${electionId}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      return d;
    },
    onSuccess: (d) => {
      setMsg({ type: 'success', text: `Candidate "${form.name}" added successfully.` });
      setForm({ name: '', party: '', symbol: '', manifesto: '', photoUrl: '' });
      clearPhoto();
      queryClient.invalidateQueries({ queryKey: ['candidates', slug, electionId] });
    },
    onError: (e) => {
      setMsg({ type: 'error', text: e.message });
    }
  });

  const handleAdd = async () => {
    setMsg(null);
    try {
      let photoUrl = form.photoUrl;
      if (photoFile) {
        photoUrl = await uploadPhoto();
      }
      addMutation.mutate({ ...form, photoUrl });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-ink font-semibold flex items-center gap-2 text-sm">
          <UserPlus size={15} className="text-primary" /> Add Candidate
        </h4>
        <p className="text-xs text-body mt-0.5">Register a candidate for this election ballot.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldInput label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
        <FieldInput label="Party / Group" value={form.party} onChange={e => setForm(f => ({ ...f, party: e.target.value }))} placeholder="Affiliation" />
        <FieldInput label="Ballot Symbol" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} placeholder="e.g. 🦅" />
        <FieldInput label="Manifesto" value={form.manifesto} onChange={e => setForm(f => ({ ...f, manifesto: e.target.value }))} placeholder="Candidate goals..." multiline />
      </div>

      <div>
        <label className="block text-xs font-semibold text-body mb-2 uppercase tracking-wider">Candidate Photo</label>
        <div className="flex items-center gap-4">
          {photoPreview ? (
            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-hairline">
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              <button type="button" onClick={clearPhoto} className="absolute top-1 right-1 bg-ink/75 hover:bg-ink rounded-full p-0.5 text-white transition cursor-pointer">
                <X size={10} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer bg-canvas border border-dashed border-hairline hover:border-primary rounded-lg px-4 py-3 text-sm text-body transition">
              <ImagePlus size={16} className="text-primary" />
              <span>Choose photo</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPhotoSelect} />
            </label>
          )}
          <span className="text-xs text-muted">JPEG, PNG, WebP format</span>
        </div>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      <button
        onClick={handleAdd}
        disabled={addMutation.isPending || uploadingPhoto || !form.name || !form.party || !form.symbol}
        className="flex items-center gap-2 bg-primary hover:bg-primary-active text-white px-6 py-2.5 rounded-full font-semibold text-sm transition-all disabled:opacity-50 shadow-sm cursor-pointer"
      >
        {addMutation.isPending || uploadingPhoto ? (
          <><Loader2 size={14} className="animate-spin" /> Registering...</>
        ) : (
          <><UserPlus size={14} /> Add Candidate</>
        )}
      </button>

      {/* Candidate Grid */}
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : candidates.length > 0 ? (
        <div className="border-t border-hairline pt-6">
          <h5 className="text-xs font-semibold text-body uppercase tracking-wider mb-3">Registered Candidates ({candidates.length})</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {candidates.map(c => (
              <div key={c.id} className="bg-surface-soft border border-hairline rounded-lg p-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-canvas border border-hairline flex items-center justify-center text-lg overflow-hidden shrink-0">
                  {c.photoUrl ? (
                    <img src={c.photoUrl} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    c.symbol || '🗳️'
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-ink font-semibold text-sm truncate">{c.name}</p>
                  <p className="text-body text-xs truncate">{c.party}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Twin Overrides Panel ──────────────────────────────────────────────────────
function TwinOverridesPanel({ slug, electionId }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [msg, setMsg] = useState(null);

  // Fetch twin override requests
  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['twinRequests', slug, electionId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/twin-requests?orgSlug=${slug}&electionId=${electionId}`);
      const d = await r.json();
      return d.requests || [];
    },
    enabled: !!slug && electionId != null,
  });

  const handleAction = async (nullifierHash, action) => {
    setProcessingId(nullifierHash);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/twin-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nullifierHash, action, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update twin override.');
      setMsg({ type: 'success', text: `Successfully ${action === 'approve' ? 'approved' : 'rejected'} twin override.` });
      setNotes('');
      refetch();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t border-hairline">
      <div>
        <h4 className="text-ink font-semibold flex items-center gap-2 text-sm">
          <Shield size={15} className="text-primary" /> Twin Verification Overrides
        </h4>
        <p className="text-xs text-body mt-0.5">Manage identity overrides for identical twins sharing similar facial geometry.</p>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-6 text-body text-xs border border-dashed border-hairline rounded-xl bg-canvas">
          No twin override requests found for this election.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-canvas shadow-sm">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-surface-soft border-b border-hairline text-body font-semibold">
                <th className="px-4 py-3">Voter</th>
                <th className="px-4 py-3">Matched Face Conflict</th>
                <th className="px-4 py-3">Similarity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {requests.map((r) => (
                <tr key={r.nullifierHash} className="hover:bg-surface-soft/40 transition">
                  <td className="px-4 py-3">
                    <p className="font-bold text-ink">{r.name}</p>
                    <p className="text-muted font-mono text-[10px]">{r.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{r.twinMatchedName}</p>
                    <p className="text-muted font-mono text-[10px]">{r.twinMatchedEmail}</p>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-primary">{r.twinMatchSimilarity}%</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider ${
                      r.twinVerificationStatus === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                      r.twinVerificationStatus === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {r.twinVerificationStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-body max-w-[150px] truncate" title={r.twinNotes}>{r.twinNotes || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.twinVerificationStatus !== 'approved' && (
                        <button
                          disabled={processingId === r.nullifierHash}
                          onClick={() => handleAction(r.nullifierHash, 'approve')}
                          className="bg-primary hover:bg-primary-active text-white px-3 py-1.5 rounded-full font-bold text-[10px] transition cursor-pointer disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                      {r.twinVerificationStatus !== 'rejected' && (
                        <button
                          disabled={processingId === r.nullifierHash}
                          onClick={() => handleAction(r.nullifierHash, 'reject')}
                          className="bg-surface-strong hover:bg-hairline text-ink px-3 py-1.5 rounded-full font-bold text-[10px] border border-hairline transition cursor-pointer disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 bg-surface-soft/40 border-t border-hairline flex gap-2">
            <input
              type="text"
              placeholder="Add override review note before acting (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-1 bg-canvas border border-hairline focus:border-primary text-ink px-3 py-1.5 rounded-lg outline-none text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── CSV Upload Panel ──────────────────────────────────────────────────────────
function CsvUploadPanel({ orgSlug, orgId, electionId }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [msg, setMsg] = useState(null);

  const slug = orgSlug || '';
  const id   = orgId   ? String(orgId) : '';

  // Fetch voters list
  const { data = { voters: [], counts: { pending: 0, registered: 0, rejected: 0, total: 0 } }, isLoading: loadingVoters } = useQuery({
    queryKey: ['voters', slug, electionId],
    queryFn: async () => {
      const r = await fetch(`/api/voters/list?orgSlug=${slug}&electionId=${electionId}&limit=100`);
      const d = await r.json();
      return { voters: d.voters || [], counts: d.counts || { pending: 0, registered: 0, rejected: 0, total: 0 } };
    },
    enabled: !!slug && electionId != null,
  });

  const { voters, counts } = data;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv':                 ['csv'],
      'text/plain':               ['csv'],
      'application/csv':          ['csv'],
      'application/vnd.ms-excel': ['csv'],
    },
    maxFiles: 1,
    onDropAccepted: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setUploading(true);
      setMsg(null);
      setUploadResult(null);

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
          d.upserted > 0 ? `${d.upserted} new voter(s) added` : '',
          d.updated  > 0 ? `${d.updated} voter(s) updated` : '',
        ].filter(Boolean);
        setMsg({ type: 'success', text: parts.join(' · ') || 'CSV uploaded successfully.' });
        queryClient.invalidateQueries({ queryKey: ['voters', slug, electionId] });
      } catch (e) {
        setMsg({ type: 'error', text: e.message });
      } finally {
        setUploading(false);
      }
    },
  });

  // Bulk Register Mutation
  const registerMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/voters/bulk-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgSlug: slug, electionId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      return d;
    },
    onSuccess: (d) => {
      setMsg({
        type: 'success',
        text: d.message || `${d.registered || 0} registered on-chain. ${d.linked || 0} linked.`,
      });
      queryClient.invalidateQueries({ queryKey: ['voters', slug, electionId] });
    },
    onError: (e) => {
      setMsg({ type: 'error', text: e.message });
    }
  });

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink flex items-center gap-2 text-sm">
            <FileSpreadsheet size={15} className="text-primary" /> Import Voter Database
          </h3>
          <a href="/api/voters/template" download
            className="flex items-center gap-1.5 text-xs bg-surface-strong border border-hairline hover:bg-hairline text-ink px-3 py-1.5 rounded-full font-medium transition cursor-pointer">
            <Download size={12} /> Template
          </a>
        </div>
        
        <code className="block bg-surface-soft rounded-lg p-2.5 mb-4 text-xs text-body font-mono">
          Header format: name, email, phone, gender, age
        </code>

        <div {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-hairline hover:border-primary/40'
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="animate-spin text-primary" size={24} />
              <p className="text-body text-sm">Processing database upload...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={24} className="text-muted" />
              <p className="text-body text-sm">
                {isDragActive ? 'Drop file here...' : 'Drag & drop CSV file, or click to browse'}
              </p>
            </div>
          )}
        </div>

        {msg && <div className="mt-4"><Toast type={msg.type} msg={msg.text} /></div>}

        {uploadResult?.errors?.length > 0 && (
          <div className="mt-4 bg-surface-soft border border-hairline rounded-lg p-3 max-h-32 overflow-y-auto">
            <p className="text-ink text-xs mb-1 font-semibold">Validation Errors ({uploadResult.errors.length}):</p>
            {uploadResult.errors.map((err, i) => (
              <p key={i} className="text-semantic-down text-xs py-0.5">Row {err.row} · {err.email} — {err.reason}</p>
            ))}
          </div>
        )}
      </div>

      {/* Voter table */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-ink font-semibold flex items-center gap-2 text-sm">
              <Users size={15} className="text-primary" /> Voter Registry
            </h3>
            <span className="text-xs font-mono font-semibold bg-surface-strong px-2 py-0.5 rounded-full text-ink">
              {counts.total} total
            </span>
            {counts.pending > 0 && (
              <span className="text-xs font-mono font-semibold bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                {counts.pending} pending
              </span>
            )}
            <span className="text-xs font-mono font-semibold bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full">
              {counts.registered} registered
            </span>
          </div>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['voters', slug, electionId] })} className="text-xs text-body hover:text-ink flex items-center gap-1.5 transition cursor-pointer">
            <RefreshCw size={11} /> Sync Status
          </button>
        </div>

        {counts.pending > 0 && (
          <button onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending}
            className="mb-4 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-active disabled:opacity-50 text-white py-3 rounded-full font-semibold text-sm transition-all shadow-sm cursor-pointer"
          >
            {registerMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Transacting on-chain...</>
            ) : (
              <><CheckCircle size={14} /> Register {counts.pending} Pending Voters On-Chain</>
            )}
          </button>
        )}

        {loadingVoters ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={20} /></div>
        ) : voters.length === 0 ? (
          <div className="text-center py-10 text-body text-sm border border-dashed border-hairline rounded-xl bg-canvas">
            No registered voters found. Use the import area to upload the CSV database.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-hairline bg-canvas">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-soft border-b border-hairline text-body text-xs">
                  <th className="text-left px-5 py-3 font-semibold">Name</th>
                  <th className="text-left px-5 py-3 font-semibold">Email</th>
                  <th className="text-left px-5 py-3 font-semibold hidden md:table-cell">Phone</th>
                  <th className="text-left px-5 py-3 font-semibold">Registration Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {voters.map((v, i) => (
                  <tr key={v._id || i} className="hover:bg-surface-soft/50 transition">
                    <td className="px-5 py-3 text-ink font-medium">{v.name}</td>
                    <td className="px-5 py-3 text-body font-mono text-xs">{v.email}</td>
                    <td className="px-5 py-3 text-muted hidden md:table-cell">{v.phone || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                        v.status === 'registered' ? 'bg-green-50 text-green-700 border-green-200' :
                        v.status === 'rejected'   ? 'bg-red-50 text-red-700 border-red-200'   :
                                                    'bg-amber-50 text-amber-700 border-amber-200'
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
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: '', description: '', startTime: '', endTime: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [phaseLoading, setPhaseLoading] = useState(null);

  // Fetch elections list using React Query
  const { data: elections = [], isLoading } = useQuery({
    queryKey: ['elections', slug],
    queryFn: async () => {
      const r = await fetch(`/api/org/${slug}/elections`);
      const d = await r.json();
      return d.elections || [];
    },
    enabled: !!slug,
  });

  const createElectionMutation = useMutation({
    mutationFn: async (payload) => {
      const r = await fetch(`/api/org/${slug}/elections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      return d;
    },
    onSuccess: (d) => {
      setMsg({ type: 'success', text: `Election "${form.title}" created successfully.` });
      setForm({ title: '', description: '', startTime: '', endTime: '' });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['elections', slug] });
    },
    onError: (e) => {
      setMsg({ type: 'error', text: e.message });
    }
  });

  const handleCreate = () => {
    setMsg(null);
    createElectionMutation.mutate({
      ...form,
      startTime: form.startTime ? new Date(form.startTime).toISOString() : form.startTime,
      endTime:   form.endTime   ? new Date(form.endTime).toISOString()   : form.endTime,
    });
  };

  const handlePhaseAction = async (electionId, action) => {
    setPhaseLoading(electionId);
    setMsg(null);
    try {
      const r = await fetch(`/api/org/${slug}/elections/${electionId}/phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg({ type: 'success', text: d.message });
      queryClient.invalidateQueries({ queryKey: ['elections', slug] });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setPhaseLoading(null);
    }
  };

  const ApprovalBadge = ({ election }) => {
    if (election.phase === 2) return null;
    if (election.guardianApproved) {
      return (
        <span className="text-xs px-2.5 py-0.5 rounded-full border font-semibold bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
          <Shield size={10} /> Verified
        </span>
      );
    }
    if (election.pendingApproval) {
      return (
        <span className="text-xs px-2.5 py-0.5 rounded-full border font-semibold bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1 animate-pulse">
          <Clock size={10} /> Awaiting Guardian
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-hairline pb-5">
        <div>
          <h2 className="text-ink font-display font-normal text-2xl tracking-tight">Elections Overview</h2>
          <p className="text-body text-sm mt-1">{elections.length} registered ballot{elections.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['elections', slug] })} 
            className="flex items-center gap-1.5 text-xs text-body hover:text-ink border border-hairline px-3 py-2 rounded-full font-medium transition cursor-pointer bg-canvas"
          >
            <RefreshCw size={12} /> Sync
          </button>
          <button 
            onClick={() => setShowForm(f => !f)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-active text-white px-4 py-2 rounded-full font-semibold text-sm transition-all shadow-sm cursor-pointer"
          >
            <PlusCircle size={15} /> Create Election
          </button>
        </div>
      </div>

      {msg && <Toast type={msg.type} msg={msg.text} />}

      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-canvas border border-hairline rounded-xl p-6 space-y-5 overflow-hidden shadow-sm"
          >
            <h3 className="text-ink font-semibold flex items-center gap-2">
              <PlusCircle size={16} className="text-primary" /> Create Election Ballot
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldInput label="Election Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Student Senate Election..." />
              <FieldInput label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ballot information..." multiline />
              <FieldInput label="Start Time" type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              <FieldInput label="End Time" type="datetime-local" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
            <div className="flex gap-3 border-t border-hairline pt-4">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm text-body hover:text-ink border border-hairline rounded-full transition cursor-pointer">Cancel</button>
              <button 
                onClick={handleCreate} 
                disabled={createElectionMutation.isPending || !form.title}
                className="flex items-center gap-2 bg-primary hover:bg-primary-active text-white px-6 py-2.5 rounded-full font-semibold text-sm transition shadow-sm cursor-pointer"
              >
                {createElectionMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : 'Save Election'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={28} /></div>
      ) : elections.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-hairline rounded-xl bg-canvas shadow-sm">
          <BarChart3 size={40} className="text-muted mx-auto mb-3" />
          <p className="text-ink font-semibold">No elections found</p>
          <p className="text-body text-sm mt-1">Create an election ballot to begin on-chain voting.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {elections.map(e => {
            const isExpanded = expandedId === (e._id || e.id);
            const isRegistration = (e.phase ?? 0) === 0;
            const isVoting = (e.phase ?? 0) === 1;
            const isCompleted = (e.phase ?? 0) === 2;

            return (
              <div key={e._id || e.id} className={`bg-canvas border rounded-xl transition-all shadow-sm ${
                isExpanded ? 'border-primary/50' : 'border-hairline hover:border-body/30'
              }`}>
                {/* Election header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : (e._id || e.id))}
                  className="w-full flex items-center justify-between p-5 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="min-w-0">
                      <p className="text-ink font-semibold text-base truncate">{e.title}</p>
                      <p className="text-body text-xs mt-1 line-clamp-1">{e.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <ApprovalBadge election={e} />
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${PHASE_COLORS[e.phase ?? 0]}`}>
                      {PHASE[e.phase ?? 0]}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {/* Expanded contents */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-hairline bg-surface-soft/30"
                    >
                      <div className="p-6 space-y-6">
                        {/* Status controllers */}
                        <div className="flex flex-wrap gap-2">
                          {isRegistration && !e.pendingApproval && !e.guardianApproved && (
                            <button
                              onClick={() => handlePhaseAction(e.id, 'request-live')}
                              disabled={phaseLoading === e.id}
                              className="flex items-center gap-2 bg-primary hover:bg-primary-active disabled:opacity-50 text-white px-5 py-2 rounded-full font-semibold text-sm transition cursor-pointer shadow-sm"
                            >
                              {phaseLoading === e.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                              Request Guardian Go-Live
                            </button>
                          )}
                          {isRegistration && e.pendingApproval && (
                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-full text-xs font-semibold">
                              <Clock size={13} className="animate-pulse" /> Pending security clearance from Guardian Portal...
                            </div>
                          )}
                          {isVoting && (
                            <button
                              onClick={() => handlePhaseAction(e.id, 'end-election')}
                              disabled={phaseLoading === e.id}
                              className="flex items-center gap-2 bg-semantic-down hover:opacity-90 disabled:opacity-50 text-white px-5 py-2 rounded-full font-semibold text-sm transition cursor-pointer shadow-sm"
                            >
                              {phaseLoading === e.id ? <Loader2 size={14} className="animate-spin" /> : <StopCircle size={14} />}
                              Close Ballot
                            </button>
                          )}
                          {isCompleted && (
                            <div className="w-full space-y-6">
                              <div className="flex items-center gap-2 text-body text-sm font-semibold">
                                <CheckCircle2 size={16} className="text-primary" /> Official on-chain results compiled.
                              </div>
                              <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm">
                                <ElectionResults slug={slug} electionId={e.id} electionTitle={e.title} compact />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Candidate Panel */}
                        {isRegistration && (
                          <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm">
                            <CandidatePanel slug={slug} electionId={e.id} />
                          </div>
                        )}

                        {/* Voter Import */}
                        {isRegistration && (
                          <div className="space-y-2.5">
                            <h4 className="text-xs font-semibold text-body uppercase tracking-wider">Voter Registry Setup</h4>
                            <p className="text-body text-xs leading-relaxed">
                              Upload database containing eligible voters for this ballot. Each election manages an independent voter register.
                            </p>
                            <CsvUploadPanel orgSlug={slug} orgId={org?._id} electionId={e.id} />
                          </div>
                        )}

                        {/* Voter connection sharing */}
                        {isVoting && (
                          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-green-700">
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                              <Vote size={15} /> Voting Portal is Open
                            </h4>
                            <p className="text-body text-xs mb-3">Distribute this URL to eligible voters. Authentication is verified on-chain:</p>
                            <div className="bg-canvas border border-hairline rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                              <code className="text-primary text-xs font-mono truncate">
                                {typeof window !== 'undefined' ? `${window.location.origin}/vote/${slug}` : `/vote/${slug}`}
                              </code>
                              <button
                                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/vote/${slug}`)}
                                className="text-xs bg-primary hover:bg-primary-active text-white px-3 py-1.5 rounded-full font-semibold transition shrink-0 cursor-pointer"
                              >
                                Copy Link
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Twin Overrides Panel (visible in Registration & Voting phases) */}
                        {(isRegistration || isVoting) && (
                          <div className="bg-canvas border border-hairline rounded-xl p-5 shadow-sm">
                            <TwinOverridesPanel slug={slug} electionId={e.id} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return null;

  const slug    = session.user.orgSlug;
  const orgName = org?.name || session.user.name || slug;

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col md:flex-row font-sans">
      
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-hairline bg-surface-soft flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-hairline">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Vote size={16} className="text-white" />
            </div>
            <span className="font-bold text-ink text-base tracking-tight">Block Vote</span>
          </div>
        </div>

        {/* Organization Info */}
        <div className="p-4 border-b border-hairline">
          <div className="flex items-center gap-3 bg-canvas border border-hairline rounded-xl p-3.5 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-surface-strong flex items-center justify-center shrink-0 text-primary">
              <Building2 size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-ink font-bold text-sm truncate">{orgName}</p>
              <p className="text-body text-xs capitalize">{org?.type || 'Organization'}</p>
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 p-4 space-y-1.5">
          <div className="flex items-center gap-2.5 w-full px-4 py-3 rounded-full text-sm font-semibold bg-primary/10 text-primary border border-primary/20">
            <BarChart3 size={15} /> 
            <span>Elections Portal</span>
            <ChevronRight size={13} className="text-primary ml-auto" />
          </div>
          <p className="text-muted text-xs px-4 pt-2.5 leading-relaxed">
            Admin console for configuration, voters list uploads, and ballot outcomes.
          </p>
        </nav>

        {/* User context / Sign out */}
        <div className="p-4 border-t border-hairline">
          <div className="px-4 py-2 mb-2">
            <p className="text-xs text-muted truncate font-mono">{session.user.email}</p>
          </div>
          <button
            id="dashboard-signout-btn"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-2.5 px-4 py-3 rounded-full text-sm text-semantic-down hover:bg-red-50 transition-all font-semibold cursor-pointer border border-transparent hover:border-red-100"
          >
            <LogOut size={15} /> 
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden border-b border-hairline bg-canvas px-6 py-4 flex items-center justify-between gap-3 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <Vote size={12} className="text-white" />
          </div>
          <span className="font-bold text-ink text-sm">Block Vote</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex items-center gap-1 text-xs text-semantic-down border border-red-200 bg-red-50/50 px-2.5 py-1.5 rounded-full font-semibold cursor-pointer"
          >
            <LogOut size={11} /> Out
          </button>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 overflow-auto bg-canvas">
        {/* Breadcrumb row */}
        <div className="border-b border-hairline bg-surface-soft/40 px-6 sm:px-10 py-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-ink font-semibold text-lg">Ballot Manager</h1>
            <p className="text-body text-xs truncate mt-0.5">{orgName} Administration Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="hidden sm:inline text-xs bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full font-semibold">
              Institutional Admin
            </span>
          </div>
        </div>

        {/* Tab content panel */}
        <div className="px-6 sm:px-10 py-8 max-w-5xl">
          {slug && <ElectionsTab slug={slug} org={org} />}
        </div>
      </main>

    </div>
  );
}

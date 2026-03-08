'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import {
  PHASE, PHASE_COLOR, formatDate, serializeElection, serializeCandidate,
} from '@/lib/contract';
import {
  LayoutDashboard, PlusCircle, UserPlus, ArrowRightCircle,
  Loader2, ChevronDown, AlertCircle, CheckCircle, List,
} from 'lucide-react';

// ─── Create Election Form ──────────────────────────────────────────────────────
function CreateElectionForm({ contract, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', startTime: '', endTime: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!form.title || !form.description || !form.startTime || !form.endTime) {
      setError('All fields are required.'); return;
    }
    const start = Math.floor(new Date(form.startTime).getTime() / 1000);
    const end = Math.floor(new Date(form.endTime).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    if (start <= now) { setError('Start time must be in the future.'); return; }
    if (end <= start) { setError('End time must be after start time.'); return; }

    try {
      setLoading(true);
      const tx = await contract.createElection(form.title, form.description, start, end);
      await tx.wait();
      setSuccess(`Election "${form.title}" created successfully!`);
      setForm({ title: '', description: '', startTime: '', endTime: '' });
      onCreated?.();
    } catch (err) {
      setError(err?.reason || err?.message || 'Failed to create election.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <PlusCircle size={20} className="text-green-400" /> Create New Election
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label="Election Title" value={form.title} onChange={set('title')} placeholder="e.g. General Election 2025" />
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={set('description')}
            rows={3}
            placeholder="Describe the election..."
            className="w-full bg-gray-800 border border-gray-700 focus:border-green-500 text-white px-4 py-2 rounded-xl outline-none resize-none transition"
          />
        </div>
        <InputField label="Start Time" type="datetime-local" value={form.startTime} onChange={set('startTime')} />
        <InputField label="End Time" type="datetime-local" value={form.endTime} onChange={set('endTime')} />
      </div>

      {error && <ErrorBanner msg={error} />}
      {success && <SuccessBanner msg={success} />}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-5 bg-green-500 hover:bg-green-600 disabled:opacity-60 px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition"
      >
        {loading ? <><Loader2 className="animate-spin" size={16} /> Creating...</> : 'Create Election'}
      </button>
    </div>
  );
}

// ─── Add Candidate Form ────────────────────────────────────────────────────────
function AddCandidateForm({ contract, elections }) {
  const [form, setForm] = useState({ electionId: '', name: '', party: '', symbol: '', manifesto: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const regElections = elections.filter((e) => e.phase === 0);

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!form.electionId || !form.name || !form.party || !form.symbol) {
      setError('Election, Name, Party and Symbol are required.'); return;
    }
    try {
      setLoading(true);
      const tx = await contract.addCandidate(
        form.electionId, form.name, form.party, form.symbol, form.manifesto
      );
      await tx.wait();
      setSuccess(`Candidate "${form.name}" added successfully!`);
      setForm((f) => ({ ...f, name: '', party: '', symbol: '', manifesto: '' }));
    } catch (err) {
      setError(err?.reason || err?.message || 'Failed to add candidate.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <UserPlus size={20} className="text-blue-400" /> Add Candidate
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Election (Registration Phase only)</label>
          <select
            value={form.electionId}
            onChange={set('electionId')}
            className="w-full bg-gray-800 border border-gray-700 focus:border-green-500 text-white px-4 py-2 rounded-xl outline-none transition"
          >
            <option value="">Select election</option>
            {regElections.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>
        <InputField label="Candidate Name" value={form.name} onChange={set('name')} placeholder="Full name" />
        <InputField label="Party Name" value={form.party} onChange={set('party')} placeholder="Political party" />
        <InputField label="Party Symbol (emoji or text)" value={form.symbol} onChange={set('symbol')} placeholder="e.g. 🌹" />
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Manifesto (optional)</label>
          <textarea
            value={form.manifesto}
            onChange={set('manifesto')}
            rows={3}
            placeholder="Candidate's manifesto..."
            className="w-full bg-gray-800 border border-gray-700 focus:border-green-500 text-white px-4 py-2 rounded-xl outline-none resize-none transition"
          />
        </div>
      </div>

      {error && <ErrorBanner msg={error} />}
      {success && <SuccessBanner msg={success} />}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-5 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition"
      >
        {loading ? <><Loader2 className="animate-spin" size={16} /> Adding...</> : 'Add Candidate'}
      </button>
    </div>
  );
}

// ─── Manage Phase Form ─────────────────────────────────────────────────────────
function ManagePhaseForm({ contract, elections, onUpdated }) {
  const [electionId, setElectionId] = useState('');
  const [newPhase, setNewPhase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selected = elections.find((e) => String(e.id) === String(electionId));

  const validNextPhases = selected
    ? selected.phase === 0 ? [1, 2] : selected.phase === 1 ? [2] : []
    : [];

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!electionId || newPhase === '') { setError('Select an election and a phase.'); return; }
    try {
      setLoading(true);
      const tx = await contract.transitionElectionPhase(electionId, newPhase);
      await tx.wait();
      setSuccess(`Phase updated to "${PHASE[newPhase]}" successfully!`);
      setNewPhase('');
      onUpdated?.();
    } catch (err) {
      setError(err?.reason || err?.message || 'Failed to change phase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <ArrowRightCircle size={20} className="text-yellow-400" /> Manage Election Phase
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Election</label>
          <select
            value={electionId}
            onChange={(e) => { setElectionId(e.target.value); setNewPhase(''); }}
            className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-xl outline-none"
          >
            <option value="">Select election</option>
            {elections.filter((e) => e.phase !== 2).map((e) => (
              <option key={e.id} value={e.id}>{e.title} — {PHASE[e.phase]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Transition To</label>
          <select
            value={newPhase}
            onChange={(e) => setNewPhase(e.target.value)}
            disabled={validNextPhases.length === 0}
            className="w-full bg-gray-800 border border-gray-700 text-white disabled:opacity-40 px-4 py-2 rounded-xl outline-none"
          >
            <option value="">Select next phase</option>
            {validNextPhases.map((p) => (
              <option key={p} value={p}>{PHASE[p]}</option>
            ))}
          </select>
        </div>
      </div>

      {selected && (
        <p className="text-xs text-gray-500 mt-2">
          Current phase: <span className={`font-bold ${PHASE_COLOR[selected.phase].split(' ')[0]}`}>{PHASE[selected.phase]}</span>
        </p>
      )}

      {error && <ErrorBanner msg={error} />}
      {success && <SuccessBanner msg={success} />}

      <button
        onClick={handleSubmit}
        disabled={loading || !electionId || newPhase === ''}
        className="mt-5 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-60 text-black px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition"
      >
        {loading ? <><Loader2 className="animate-spin" size={16} /> Updating...</> : 'Update Phase'}
      </button>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function InputField({ label, value, onChange, placeholder = '', type = 'text' }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 focus:border-green-500 text-white px-4 py-2 rounded-xl outline-none transition"
      />
    </div>
  );
}

function ErrorBanner({ msg }) {
  return (
    <div className="flex items-start gap-2 bg-red-900/20 border border-red-700 text-red-300 rounded-xl p-3 mt-4 text-sm">
      <AlertCircle size={14} className="shrink-0 mt-0.5" /> {msg}
    </div>
  );
}

function SuccessBanner({ msg }) {
  return (
    <div className="flex items-start gap-2 bg-green-900/20 border border-green-700 text-green-300 rounded-xl p-3 mt-4 text-sm">
      <CheckCircle size={14} className="shrink-0 mt-0.5" /> {msg}
    </div>
  );
}

// ─── Main Admin Page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { contract, account, isAdmin } = useWallet();
  const router = useRouter();
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account) { router.replace('/connect-wallet'); return; }
    if (account && !isAdmin) { router.replace('/elections'); return; }
    loadElections();
  }, [contract, account, isAdmin]);

  const loadElections = async () => {
    if (!contract) return;
    try {
      setLoading(true);
      const raw = await contract.getAllElections();
      setElections(raw.map(serializeElection));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex justify-center items-center bg-gray-950">
        <Loader2 className="animate-spin text-green-400" size={44} />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-950 text-white px-6 md:px-16 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-10">
        <LayoutDashboard size={30} className="text-yellow-400" />
        <div>
          <h1 className="text-3xl font-extrabold">Election Commission Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">Manage elections, candidates, and phase transitions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Total Elections', value: elections.length, color: 'text-white' },
          { label: 'Registration Phase', value: elections.filter((e) => e.phase === 0).length, color: 'text-blue-400' },
          { label: 'Voting Phase', value: elections.filter((e) => e.phase === 1).length, color: 'text-green-400' },
          { label: 'Completed', value: elections.filter((e) => e.phase === 2).length, color: 'text-gray-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs mb-1">{label}</p>
            <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Forms */}
      <div className="flex flex-col gap-8">
        <CreateElectionForm contract={contract} onCreated={loadElections} />
        <AddCandidateForm contract={contract} elections={elections} />
        <ManagePhaseForm contract={contract} elections={elections} onUpdated={loadElections} />
      </div>

      {/* Elections List */}
      <div className="mt-10">
        <h2 className="text-2xl font-bold mb-5 flex items-center gap-2">
          <List size={22} className="text-green-400" /> All Elections
        </h2>
        {elections.length === 0 ? (
          <p className="text-gray-500 text-center py-10">No elections created yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {elections.map((e) => (
              <div key={e.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold">{e.title}</h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${PHASE_COLOR[e.phase]}`}>
                    {PHASE[e.phase]}
                  </span>
                </div>
                <p className="text-gray-400 text-sm line-clamp-2">{e.description}</p>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span>Start: {formatDate(e.startTime)}</span>
                  <span>End: {formatDate(e.endTime)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

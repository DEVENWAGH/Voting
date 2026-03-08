'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { PHASE, PHASE_COLOR, formatDate, serializeElection } from '@/lib/contract';
import { List, Loader2, PlusCircle, Calendar, User } from 'lucide-react';
import Link from 'next/link';

export default function ElectionsPage() {
  const { readContract, account } = useWallet();
  const router = useRouter();
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!account) {
      router.replace('/connect-wallet');
      return;
    }
    loadElections();
  }, [readContract, account]);

  const loadElections = async () => {
    if (!readContract) { setLoading(false); return; }
    try {
      setLoading(true);
      setError('');
      const raw = await readContract.getAllElections();
      setElections(raw.map(serializeElection));
    } catch (err) {
      console.error(err);
      setError('Failed to load elections. Make sure the contract is deployed correctly.');
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
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <List className="text-green-400" size={30} />
          <h1 className="text-3xl font-extrabold">Elections</h1>
        </div>
        <button
          onClick={loadElections}
          className="text-sm text-green-400 hover:text-green-300 border border-green-800 hover:border-green-600 px-4 py-2 rounded-lg transition"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700 text-red-300 rounded-xl p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {elections.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-gray-500">
          <PlusCircle size={48} />
          <p className="text-xl font-semibold">No elections yet</p>
          <p className="text-sm">The Election Commission has not created any elections yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {elections.map((election) => (
            <Link
              key={election.id}
              href={`/elections/${election.id}`}
              className="group bg-gray-900 border border-gray-800 hover:border-green-600 rounded-2xl p-6 flex flex-col gap-4 transition cursor-pointer shadow-md hover:shadow-green-900/20"
            >
              {/* Phase badge */}
              <div className={`self-start text-xs font-bold px-3 py-1 rounded-full border ${PHASE_COLOR[election.phase]}`}>
                {PHASE[election.phase]}
              </div>

              <h2 className="text-xl font-bold group-hover:text-green-400 transition line-clamp-2">
                {election.title}
              </h2>
              <p className="text-gray-400 text-sm line-clamp-3">{election.description}</p>

              <div className="flex flex-col gap-1 text-xs text-gray-500 mt-auto pt-2 border-t border-gray-800">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} /> Start: {formatDate(election.startTime)}
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} /> End: {formatDate(election.endTime)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

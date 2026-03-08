'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { ethers } from 'ethers';
import { UserCheck, Loader2, ShieldCheck, AlertCircle, Info } from 'lucide-react';

export default function RegisterPage() {
  const { contract, account } = useWallet();
  const router = useRouter();
  const [aadhaar, setAadhaar] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!account) {
    router.replace('/connect-wallet');
    return null;
  }

  const handleRegister = async () => {
    setError('');
    if (!aadhaar || aadhaar.trim().length < 6) {
      setError('Please enter a valid Aadhaar number (at least 6 characters).');
      return;
    }

    try {
      setLoading(true);
      // Hash the aadhaar number using keccak256 (same as solidityKeccak256)
      const aadhaarHash = ethers.keccak256(ethers.toUtf8Bytes(aadhaar.trim()));
      const tx = await contract.registerVoter(aadhaarHash);
      await tx.wait();
      setSuccess(true);
      setAadhaar('');
    } catch (err) {
      console.error(err);
      const msg = err?.reason || err?.data?.message || err?.message || 'Registration failed';
      if (msg.includes('Aadhaar already registered')) {
        setError('This Aadhaar number is already registered with another wallet.');
      } else if (msg.includes('Wallet already registered')) {
        setError('This wallet is already registered as a voter.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col justify-center items-center bg-gray-950 text-white px-4">
        <div className="max-w-md w-full bg-gray-900 border border-green-700 rounded-2xl p-10 text-center shadow-2xl">
          <ShieldCheck size={64} className="text-green-400 mx-auto mb-4" />
          <h1 className="text-3xl font-extrabold text-green-400 mb-3">Registered!</h1>
          <p className="text-gray-300 mb-6">
            You are now a registered voter. You can participate in active elections.
          </p>
          <button
            onClick={() => router.push('/elections')}
            className="w-full bg-green-500 hover:bg-green-600 px-6 py-3 rounded-xl font-semibold transition"
          >
            Browse Elections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col justify-center items-center bg-gray-950 text-white px-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-10 shadow-2xl">
        {/* Header */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-green-900/30 border-2 border-green-500 flex items-center justify-center">
            <UserCheck size={40} className="text-green-400" />
          </div>
        </div>
        <h1 className="text-3xl font-extrabold text-center mb-2">Register as Voter</h1>
        <p className="text-gray-400 text-center mb-8 text-sm">
          Your Aadhaar number will be cryptographically hashed before being stored — it is never stored in plain text.
        </p>

        {/* Info banner */}
        <div className="flex items-start gap-2 text-blue-300 bg-blue-900/20 border border-blue-800 rounded-xl p-3 mb-6 text-xs">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>One Aadhaar = One vote. Each Aadhaar can only be registered once across all wallets.</span>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-red-300 bg-red-900/20 border border-red-800 rounded-xl p-3 mb-4 text-sm">
            <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {/* Input */}
        <label className="block text-sm font-semibold text-gray-300 mb-2">Aadhaar Number</label>
        <input
          type="text"
          value={aadhaar}
          onChange={(e) => setAadhaar(e.target.value)}
          placeholder="Enter your 12-digit Aadhaar number"
          maxLength={12}
          className="w-full bg-gray-800 border border-gray-700 focus:border-green-500 text-white px-4 py-3 rounded-xl outline-none mb-6 transition"
        />

        <button
          onClick={handleRegister}
          disabled={loading || !aadhaar}
          className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-60 px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition"
        >
          {loading ? (
            <><Loader2 className="animate-spin" size={18} /> Registering...</>
          ) : (
            <><UserCheck size={18} /> Register Voter</>
          )}
        </button>
      </div>
    </div>
  );
}

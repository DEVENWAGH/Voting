'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { Wallet, Loader2, AlertCircle } from 'lucide-react';

export default function ConnectWalletPage() {
  const { connect, account, isConnecting, error } = useWallet();
  const router = useRouter();

  // Redirect if already connected
  useEffect(() => {
    if (account) router.replace('/elections');
  }, [account, router]);

  const handleConnect = async () => {
    const ok = await connect();
    if (ok) router.push('/elections');
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col justify-center items-center bg-gradient-to-b from-gray-950 via-gray-900 to-black px-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-10 shadow-2xl text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-green-900/30 border-2 border-green-500 flex items-center justify-center">
            <Wallet size={40} className="text-green-400" />
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-2">Connect Wallet</h1>
        <p className="text-gray-400 mb-8">
          Connect your MetaMask wallet to access elections, register as a voter, and cast your ballot.
        </p>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 mb-6 bg-red-900/20 border border-red-800 p-3 rounded-lg text-sm">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-60 px-6 py-3 rounded-xl text-lg font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-green-900/30"
        >
          {isConnecting ? (
            <><Loader2 className="animate-spin" size={20} /> Connecting...</>
          ) : (
            <><Wallet size={20} /> Connect with MetaMask</>
          )}
        </button>

        <p className="text-gray-500 text-sm mt-6">
          Don&apos;t have MetaMask?{' '}
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 hover:underline"
          >
            Install it here
          </a>
        </p>
      </div>
    </div>
  );
}

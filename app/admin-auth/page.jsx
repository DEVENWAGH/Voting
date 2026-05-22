'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { Shield, Wallet, Lock, Award, Zap, RefreshCw, AlertCircle } from 'lucide-react';

// ── Static fallback addresses (match deployProxy.js output) ──────────────────
const GUARDIAN_PROFILES = [
  {
    id: 1,
    title: 'Guardian No. 1',
    role: 'Relayer Custodian',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    duty: 'Holds & operates the Gas Station wallet. Responsible for voter transaction fees and node gas logistics.',
    icon: Zap,
    color: '#06b6d4',
  },
  {
    id: 2,
    title: 'Guardian No. 2',
    role: 'Security Auditor',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    duty: 'Governance multi-sig co-signer. Responsible for verifying UUPS contract upgrade payloads and parameters.',
    icon: Shield,
    color: '#8b5cf6',
  },
  {
    id: 3,
    title: 'Guardian No. 3',
    role: 'Compliance Trustee',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    duty: 'Governs organization registration validation and platform integrity audits.',
    icon: Award,
    color: '#10b981',
  },
];

// The Hardhat default deployer address is also treated as Guardian 1
const DEPLOYER_ADDR = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

// Return 1-based guardian index for an address, or -1 if not a guardian
function getGuardianIndex(address, dynamicGuardians) {
  const addr = address.toLowerCase();

  // Deployer shortcut → Guardian 1
  if (addr === DEPLOYER_ADDR) return 0;

  // Try dynamic list from contract first, then static profiles
  const list = dynamicGuardians.length > 0
    ? dynamicGuardians
    : GUARDIAN_PROFILES.map(g => g.address);

  return list.findIndex(g => g.toLowerCase() === addr);
}

export default function AdminAuthPage() {
  const { account, connect, isConnecting, readContract } = useWallet();
  const router = useRouter();

  const [dynamicGuardians, setDynamicGuardians] = useState([]);
  const [checking, setChecking]   = useState(false);
  const [accessError, setAccessError] = useState('');

  // ── Load guardian addresses from the contract (best-effort) ────────────────
  useEffect(() => {
    if (!readContract || typeof readContract.getGuardians !== 'function') return;
    readContract.getGuardians()
      .then(list => { if (list?.length === 3) setDynamicGuardians(list); })
      .catch(() => {});
  }, [readContract]);

  // ── If already connected on mount, immediately verify ──────────────────────
  useEffect(() => {
    if (account) verify(account);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Core verify helper ─────────────────────────────────────────────────────
  function verify(address) {
    const idx = getGuardianIndex(address, dynamicGuardians);
    if (idx !== -1) {
      sessionStorage.setItem('active_guardian_id',      String(idx + 1));
      sessionStorage.setItem('active_guardian_address', address);
      sessionStorage.removeItem('simulated_guardian_id');
      sessionStorage.removeItem('simulated_guardian_address');
      router.push('/admin');
    } else {
      setAccessError('Access Denied — connected address is not a registered Aegis Guardian.');
      setChecking(false);
    }
  }

  // ── Button handler: connect wallet THEN verify ─────────────────────────────
  const handleConnect = async () => {
    setAccessError('');

    // If already connected, just verify immediately
    if (account) {
      setChecking(true);
      verify(account);
      return;
    }

    // Otherwise trigger MetaMask / EIP-1193 popup
    setChecking(true);
    try {
      const success = await connect();          // from WalletContext
      if (!success) {
        setChecking(false);
        return;
      }
      // WalletContext sets `account` asynchronously; read it directly from provider
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts?.[0]) {
        verify(accounts[0]);
      } else {
        setChecking(false);
      }
    } catch (err) {
      console.error('connect error', err);
      setAccessError('Wallet connection failed. Please try again.');
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b12_1px,transparent_1px),linear-gradient(to_bottom,#1e293b12_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-cyan-600/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-4xl z-10 space-y-8">

        {/* ── Header ── */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/20 bg-indigo-950/30 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <Shield size={12} className="animate-pulse" /> Aegis Security Protocol
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-200 to-cyan-200 bg-clip-text text-transparent">
            Guardian Portal Gate
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
            Multi-signature administrative console. Cryptographic authorisation is required to access
            governance, relayer reserves, and upgrade mechanisms.
          </p>
        </div>

        {/* ── Guardian Profile Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {GUARDIAN_PROFILES.map((profile) => {
            const Icon = profile.icon;
            return (
              <div
                key={profile.id}
                className="bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 relative flex flex-col justify-between transition-all duration-300 group hover:-translate-y-1 backdrop-blur-xl shadow-lg"
              >
                <div
                  className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-current to-transparent opacity-40 group-hover:opacity-100 transition-opacity"
                  style={{ color: profile.color }}
                />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800"
                      style={{ boxShadow: `0 0 15px ${profile.color}20` }}
                    >
                      <Icon size={20} style={{ color: profile.color }} />
                    </div>
                    <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded border bg-slate-950 text-slate-400 border-slate-800">
                      G-{profile.id}
                    </span>
                  </div>
                  <h3 className="text-white font-extrabold text-lg mb-1">{profile.title}</h3>
                  <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: profile.color }}>
                    {profile.role}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{profile.duty}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800/80">
                  <p className="text-[10px] text-slate-500 font-mono tracking-tight break-all">{profile.address}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Login Box ── */}
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-2xl max-w-xl mx-auto shadow-2xl relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-cyan-500/5 rounded-2xl pointer-events-none" />

          <div className="relative text-center space-y-6">
            <div className="w-12 h-12 rounded-full bg-indigo-950/80 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
              <Lock size={20} />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold">Authorized Access Only</h2>
              <p className="text-xs text-slate-400">
                Connect your Guardian MetaMask wallet to prove ownership.
              </p>
            </div>

            {/* Error banner */}
            {accessError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2.5 items-start text-left text-xs text-red-300">
                <AlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
                <span>{accessError}</span>
              </div>
            )}

            {/* CTA button */}
            <button
              id="connect-guardian-wallet"
              onClick={handleConnect}
              disabled={isConnecting || checking}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-950/40"
            >
              {isConnecting || checking ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  {checking ? 'Verifying Credentials…' : 'Connecting Wallet…'}
                </>
              ) : (
                <>
                  <Wallet size={16} />
                  Connect Guardian Wallet
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';
import { Shield, Wallet, Lock, Award, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const GUARDIAN_PROFILES = [
  {
    id: 1,
    title: 'Guardian No. 1',
    role: 'Relayer Custodian',
    address: process.env.NEXT_PUBLIC_GUARDIAN_1 || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    duty: 'Holds & operates the Gas Station wallet. Responsible for voter transaction fees and node gas logistics.',
    icon: Zap,
    color: '#0052ff', // Coinbase Blue
  },
  {
    id: 2,
    title: 'Guardian No. 2',
    role: 'Security Auditor',
    address: process.env.NEXT_PUBLIC_GUARDIAN_2 || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    duty: 'Governance multi-sig co-signer. Responsible for verifying UUPS contract upgrade payloads and parameters.',
    icon: Shield,
    color: '#8b5cf6',
  },
  {
    id: 3,
    title: 'Guardian No. 3',
    role: 'Compliance Trustee',
    address: process.env.NEXT_PUBLIC_GUARDIAN_3 || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    duty: 'Governs organization registration validation and platform integrity audits.',
    icon: Award,
    color: '#05b169', // Semantic Green
  },
];



function getGuardianIndex(address, dynamicGuardians) {
  const addr = address.toLowerCase();
  const list = dynamicGuardians.length > 0 ? dynamicGuardians : GUARDIAN_PROFILES.map(g => g.address);
  return list.findIndex(g => g.toLowerCase() === addr);
}

export default function AdminAuthPage() {
  const { account, connect, isConnecting, readContract } = useWallet();
  const router = useRouter();

  const [dynamicGuardians, setDynamicGuardians] = useState([]);
  const [guardiansLoaded, setGuardiansLoaded] = useState(false);
  const [checking, setChecking]   = useState(false);
  const [accessError, setAccessError] = useState('');

  useEffect(() => {
    if (!readContract || typeof readContract.getGuardians !== 'function') {
      setGuardiansLoaded(true);
      return;
    }
    setGuardiansLoaded(false);
    readContract.getGuardians()
      .then(list => {
        if (list?.length === 3) {
          setDynamicGuardians(list);
        }
      })
      .catch((err) => {
        console.warn('Failed to load guardians from contract:', err);
      })
      .finally(() => {
        setGuardiansLoaded(true);
      });
  }, [readContract]);

  const verify = useCallback((address) => {
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
  }, [dynamicGuardians, router]);

  useEffect(() => {
    if (account && guardiansLoaded) {
      verify(account);
    }
  }, [account, guardiansLoaded, verify]);

  const handleConnect = async () => {
    setAccessError('');
    if (account) {
      setChecking(true);
      verify(account);
      return;
    }

    setChecking(true);
    try {
      const success = await connect();
      if (!success) {
        setChecking(false);
        return;
      }
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts?.[0]) {
        verify(accounts[0]);
      } else {
        setChecking(false);
      }
    } catch (err) {
      console.error(err);
      setAccessError('Wallet connection failed. Please try again.');
      setChecking(false);
    }
  };

  const displayedProfiles = GUARDIAN_PROFILES.map((profile, idx) => ({
    ...profile,
    address: dynamicGuardians[idx] || profile.address
  }));

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#dee1e620_1px,transparent_1px),linear-gradient(to_bottom,#dee1e620_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-4xl space-y-12 z-10">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold uppercase tracking-wider">
            <Shield size={12} className="animate-pulse" /> Aegis Security Protocol
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-normal tracking-tight text-ink">
            Guardian Portal Gate
          </h1>
          <p className="text-body max-w-lg mx-auto text-sm md:text-base leading-relaxed">
            Multi-signature administrative portal. Cryptographic authorization is required to access gas reserves, relayer nodes, and upgrade hooks.
          </p>
        </div>

        {/* Guardian Node Profiles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayedProfiles.map((profile, idx) => {
            const Icon = profile.icon;
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                key={profile.id}
                className="bg-canvas border border-hairline hover:border-body rounded-xl p-6 relative flex flex-col justify-between shadow-sm group"
              >
                <div
                  className="absolute top-0 left-6 right-6 h-[2px] opacity-40 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: profile.color }}
                />
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="p-2.5 rounded-xl bg-surface-soft border border-hairline">
                      <Icon size={18} style={{ color: profile.color }} />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border border-hairline bg-surface-soft text-body">
                      G-{profile.id}
                    </span>
                  </div>
                  <h3 className="text-ink font-semibold text-base mb-1">{profile.title}</h3>
                  <p className="text-[11px] font-semibold mb-3 uppercase tracking-wider" style={{ color: profile.color }}>
                    {profile.role}
                  </p>
                  <p className="text-xs text-body leading-relaxed mb-4">{profile.duty}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-hairline">
                  <p className="text-[10px] text-muted font-mono tracking-tight break-all selection:bg-primary/10">{profile.address}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Authorization connect box */}
        <div className="bg-canvas border border-hairline rounded-xl p-8 max-w-xl mx-auto shadow-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/2 to-transparent pointer-events-none" />

          <div className="relative text-center space-y-5">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
              <Lock size={18} />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-ink">Authorized Access Only</h2>
              <p className="text-xs text-body">
                Please connect your Guardian MetaMask account to verify authority.
              </p>
            </div>

            {accessError && (
              <div className="bg-canvas border border-semantic-down rounded-xl p-3 flex gap-2.5 items-start text-left text-xs text-semantic-down">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{accessError}</span>
              </div>
            )}

            <button
              id="connect-guardian-wallet"
              onClick={handleConnect}
              disabled={isConnecting || checking}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-active text-white font-semibold py-3.5 px-6 rounded-full transition-all disabled:opacity-50 shadow-sm cursor-pointer text-sm"
            >
              {isConnecting || checking ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Checking signature...</span>
                </>
              ) : (
                <>
                  <Wallet size={14} />
                  <span>Connect Guardian Wallet</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-xs text-muted hover:text-ink font-semibold">
            ← Return to homepage
          </Link>
        </div>

      </div>
    </div>
  );
}

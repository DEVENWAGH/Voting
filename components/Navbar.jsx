'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useWallet } from '@/context/WalletContext';
import { formatAddress } from '@/lib/contract';
import {
  Vote, LogOut, LayoutDashboard, UserCheck, Building2,
  ChevronDown
} from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const { account, isAdmin, disconnect } = useWallet();
  const { data: session } = useSession();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Hide navbar on pages that have their own nav, admin portal, dashboard sidebar
  if (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/dashboard')
  ) {
    return null;
  }

  // Org user session (Auth.js)
  const isOrgSession = !!session?.user;

  const navLink = (href, label) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`text-sm font-medium px-3 py-1.5 rounded-lg transition ${
          active ? 'bg-indigo-500/15 text-indigo-300' : 'text-slate-400 hover:text-white'
        }`}
      >
        {label}
      </Link>
    );
  };

  const handleWalletDisconnect = () => {
    disconnect();
    router.push('/');
  };

  return (
    <nav className="sticky top-0 z-50 flex justify-between items-center px-6 py-3.5 border-b border-white/5 bg-[#020617]/90 backdrop-blur-xl">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <Vote size={16} className="text-white" />
        </div>
        <span className="text-base font-black tracking-tight text-white">Block Vote</span>
      </Link>

      {/* Center nav links */}
      <div className="hidden md:flex items-center gap-1">
        {navLink('/', 'Home')}
        {/* Show blockchain links only when wallet is connected */}
        {account && navLink('/elections', 'Elections')}
        {account && navLink('/register', 'Register Voter')}
        {account && isAdmin && navLink('/admin', 'Chain Admin')}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">

        {/* ── Org session (Auth.js) ── */}
        {isOrgSession && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2.5 bg-slate-900/80 border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-xl text-sm transition"
            >
              <div className="w-6 h-6 rounded-lg bg-indigo-950/80 border border-indigo-500/20 flex items-center justify-center">
                <Building2 size={12} className="text-indigo-400" />
              </div>
              <span className="text-white font-semibold max-w-[120px] truncate">
                {session.user.name || session.user.email}
              </span>
              <ChevronDown size={13} className={`text-slate-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-slate-800">
                  <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
                </div>
                <Link
                  href="/dashboard"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition"
                >
                  <LayoutDashboard size={14} className="text-indigo-400" /> Dashboard
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Wallet connected (blockchain voter) ── */}
        {account && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
              {isAdmin
                ? <LayoutDashboard size={12} className="text-yellow-400" />
                : <UserCheck size={12} className="text-green-400" />
              }
              <span className="text-slate-400">{isAdmin ? 'Admin' : 'Voter'}:</span>
              <span className="text-green-400 font-mono">{formatAddress(account)}</span>
            </div>
            <button
              onClick={handleWalletDisconnect}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 border border-red-900/60 hover:border-red-500 px-3 py-1.5 rounded-lg transition"
            >
              <LogOut size={12} /> Disconnect
            </button>
          </div>
        )}

        {/* ── Not logged in at all ── */}
        {!isOrgSession && !account && (
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm font-semibold text-slate-400 hover:text-white px-4 py-2 rounded-xl transition">
              Sign in
            </Link>
            <Link href="/signup" className="text-sm font-bold px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white transition shadow-lg shadow-indigo-950/40">
              Get Started
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

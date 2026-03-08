'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { formatAddress } from '@/lib/contract';
import { Vote, LogOut, LayoutDashboard, UserCheck, List } from 'lucide-react';

export default function Navbar() {
  const { account, isAdmin, disconnect } = useWallet();
  const pathname = usePathname();
  const router = useRouter();

  const handleDisconnect = () => {
    disconnect();
    router.push('/');
  };

  const navLink = (href, label) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`text-sm font-medium px-3 py-1.5 rounded-lg transition ${
          active
            ? 'bg-green-500/20 text-green-400'
            : 'text-gray-300 hover:text-green-400'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="sticky top-0 z-50 flex justify-between items-center px-6 py-3 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2">
        <Vote className="text-green-400" size={24} />
        <span className="text-xl font-bold text-green-400">BlockVote</span>
      </Link>

      {/* Nav links */}
      <div className="hidden md:flex items-center gap-1">
        {navLink('/', 'Home')}
        {account && navLink('/elections', 'Elections')}
        {account && navLink('/register', 'Register')}
        {account && isAdmin && navLink('/admin', 'Admin')}
      </div>

      {/* Wallet status */}
      <div className="flex items-center gap-3">
        {account ? (
          <>
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-sm">
              {isAdmin ? (
                <LayoutDashboard size={14} className="text-yellow-400" />
              ) : (
                <UserCheck size={14} className="text-green-400" />
              )}
              <span className="text-gray-300">
                {isAdmin ? 'Admin' : 'Voter'}:
              </span>
              <span className="text-green-400 font-mono">{formatAddress(account)}</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 border border-red-800 hover:border-red-500 px-3 py-1.5 rounded-lg transition"
            >
              <LogOut size={14} /> Disconnect
            </button>
          </>
        ) : (
          <Link
            href="/connect-wallet"
            className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition"
          >
            Connect Wallet
          </Link>
        )}
      </div>
    </nav>
  );
}

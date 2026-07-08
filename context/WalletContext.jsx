'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import contractABI from '@/lib/contracts/VotingV1.json';

// ⚠️ Update this after deploying VotingV1.sol (UUPS proxy)
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [readContract, setReadContract] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  // Initialize read-only contract directly via JsonRpcProvider (no wallet needed)
  useEffect(() => {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
    try {
      const rpcProvider = new ethers.JsonRpcProvider(rpcUrl);
      const rc = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, rpcProvider);
      setReadContract(rc);
    } catch (err) {
      console.warn('Read contract init failed:', err.message);
    }
  }, []);

  // Ref so event listeners always see latest account without stale closure
  const accountRef = useRef('');
  useEffect(() => { accountRef.current = account; }, [account]);

  const initContract = useCallback(async (signerOrProvider, address) => {
    try {
      const c = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signerOrProvider);
      setContract(c);
      setReadContract(c); // Sync read-only contract with active MetaMask provider
      try {
        const admin = await c.electionCommission();
        setIsAdmin(admin.toLowerCase() === address.toLowerCase());
      } catch {
        setIsAdmin(false);
      }
      return c;
    } catch (err) {
      console.warn('Contract init skipped:', err.message);
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount('');
    setContract(null);
    setIsAdmin(false);
    localStorage.removeItem('connectedAccount');

    // Restore readContract back to the default RPC provider
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
    try {
      const rpcProvider = new ethers.JsonRpcProvider(rpcUrl);
      const rc = new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, rpcProvider);
      setReadContract(rc);
    } catch (err) {
      console.warn('Read contract reset failed:', err.message);
    }
  }, []);

  // Auto-reconnect on page load if previously connected
  useEffect(() => {
    const tryReconnect = async () => {
      if (typeof window === 'undefined' || !window.ethereum) return;
      const saved = localStorage.getItem('connectedAccount');
      if (!saved) return;

      try {
        const p = new ethers.BrowserProvider(window.ethereum);
        const accounts = await p.listAccounts();
        if (accounts.length > 0) {
          const s = await p.getSigner();
          const addr = await s.getAddress();
          setProvider(p);
          setSigner(s);
          setAccount(addr);
          initContract(s, addr).catch(() => {});
        }
        // Do NOT remove localStorage here — MetaMask may return empty accounts
        // transiently right after a page reload. User must explicitly disconnect.
      } catch {
        // silently skip — don't wipe localStorage on a transient error
      }
    };
    tryReconnect();
  }, [initContract]);

  // Listen for MetaMask account / chain changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        // Only disconnect if we were actually connected
        if (accountRef.current) disconnect();
      } else {
        try {
          const p = new ethers.BrowserProvider(window.ethereum);
          const s = await p.getSigner();
          const addr = accounts[0];
          setProvider(p);
          setSigner(s);
          setAccount(addr);
          localStorage.setItem('connectedAccount', addr);
          initContract(s, addr).catch(() => {});
        } catch (err) {
          console.warn('accountsChanged handler error:', err.message);
        }
      }
    };

    // Reinitialize provider on chain change instead of full page reload.
    // Full reload + empty eth_accounts is what was clearing the session.
    const handleChainChanged = async () => {
      const saved = localStorage.getItem('connectedAccount');
      if (!saved) return;
      try {
        const p = new ethers.BrowserProvider(window.ethereum);
        const accounts = await p.listAccounts();
        if (accounts.length > 0) {
          const s = await p.getSigner();
          const addr = await s.getAddress();
          setProvider(p);
          setSigner(s);
          setAccount(addr);
          initContract(s, addr).catch(() => {});
        }
      } catch (err) {
        console.warn('chainChanged handler error:', err.message);
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [initContract, disconnect]);

  const connect = async () => {
    if (!window.ethereum) {
      setError('Please install MetaMask to continue.');
      return false;
    }
    try {
      setIsConnecting(true);
      setError('');
      const p = new ethers.BrowserProvider(window.ethereum);
      await p.send('eth_requestAccounts', []);
      const s = await p.getSigner();
      const addr = await s.getAddress();
      setProvider(p);
      setSigner(s);
      setAccount(addr);
      localStorage.setItem('connectedAccount', addr);
      initContract(s, addr).catch((err) => console.warn('Contract init:', err.message));
      return true;
    } catch (err) {
      console.error(err);
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        setError('Connection rejected. Please approve the MetaMask request.');
      } else {
        setError('Failed to connect wallet. Please try again.');
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <WalletContext.Provider
      value={{ provider, signer, account, contract, readContract, isAdmin, isConnecting, error, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}

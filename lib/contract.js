import { ethers } from 'ethers';
import contractABI from '@/lib/contracts/VotingV3.json';
import { CONTRACT_ADDRESS } from '@/context/WalletContext';

export const PHASE = {
  0: 'Registration',
  1: 'Voting',
  2: 'Completed',
};

export const PHASE_COLOR = {
  0: 'text-blue-400 bg-blue-900/30 border-blue-700',
  1: 'text-green-400 bg-green-900/30 border-green-700',
  2: 'text-gray-400 bg-gray-800 border-gray-600',
};

export function formatAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatDate(ts) {
  if (!ts) return '';
  return new Date(Number(ts) * 1000).toLocaleString();
}

export function getReadContract(provider) {
  return new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, provider);
}

export function getWriteContract(signer) {
  return new ethers.Contract(CONTRACT_ADDRESS, contractABI.abi, signer);
}

/** Serialize on-chain election struct — bytes32 ID converted to hex string */
export function serializeElection(e) {
  return {
    id: e.id, // bytes32 hex string — keep as-is
    title: e.title,
    description: e.description,
    startTime: Number(e.startTime),
    endTime: Number(e.endTime),
    phase: Number(e.phase),
    exists: e.exists,
  };
}

export function serializeCandidate(c) {
  return {
    id: Number(c.id),
    name: c.name,
    party: c.party,
    symbol: c.symbol,
    manifesto: c.manifesto,
    voteCount: Number(c.voteCount),
  };
}

/** Format a bytes32 election ID for display (short form) */
export function formatElectionId(id) {
  if (!id) return '';
  const hex = typeof id === 'string' ? id : id.toString();
  return `${hex.slice(0, 10)}...${hex.slice(-6)}`;
}

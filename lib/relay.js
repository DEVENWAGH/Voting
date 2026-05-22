/**
 * lib/relay.js
 * Platform gas-station relay — submits all blockchain transactions on behalf of voters.
 * The relay wallet pays ALL gas. Voters have zero blockchain interaction.
 */
import { ethers } from 'ethers';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let _provider = null;
let _relayWallet = null;
let _contract = null;

function getProvider() {
  if (!_provider) {
    _provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
  }
  return _provider;
}

function getRelayWallet() {
  if (!_relayWallet) {
    const key = process.env.ADMIN_RELAY_PRIVATE_KEY;
    if (!key) throw new Error('ADMIN_RELAY_PRIVATE_KEY not set in .env');
    _relayWallet = new ethers.Wallet(key, getProvider());
  }
  return _relayWallet;
}

function getContract() {
  if (!_contract) {
    const abi = require('./contracts/VotingV1.json').abi;
    const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    if (!address) throw new Error('NEXT_PUBLIC_CONTRACT_ADDRESS not set in .env');
    _contract = new ethers.Contract(address, abi, getRelayWallet());
  }
  return _contract;
}

// ─── Relay Operations ─────────────────────────────────────────────────────────

/** Register a voter on-chain by their nullifier hash (no voter wallet needed) */
export async function relayRegisterVoter(nullifierHash) {
  const tx = await getContract().registerVoterByRelay(nullifierHash);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/** Cast a vote on behalf of a voter (after OTP verification) */
export async function relayCastVote(electionId, candidateId, voterNullifier) {
  const tx = await getContract().castVoteRelayed(electionId, candidateId, voterNullifier);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/** Create an election via relay (admin only) */
export async function relayCreateElection(title, description, bannerUrl, startTime, endTime) {
  const tx = await getContract().createElection(title, description, bannerUrl, startTime, endTime);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/** Add a candidate via relay */
export async function relayAddCandidate(electionId, name, party, symbol, manifesto, photoUrl) {
  const tx = await getContract().addCandidate(electionId, name, party, symbol, manifesto, photoUrl);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/** Transition election phase via relay */
export async function relayTransitionPhase(electionId, newPhase) {
  const tx = await getContract().transitionPhase(electionId, newPhase);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/** Get relay wallet ETH balance */
export async function getRelayBalance() {
  const balance = await getProvider().getBalance(getRelayWallet().address);
  return ethers.formatEther(balance);
}

/** Get relay wallet address */
export function getRelayAddress() {
  return getRelayWallet().address;
}

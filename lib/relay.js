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
    const baseWallet = new ethers.Wallet(key, getProvider());
    // Wrap with NonceManager to safely handle rapid sequential transactions (like bulk register)
    _relayWallet = new ethers.NonceManager(baseWallet);
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

/** Reset the NonceManager — call before bulk operations to re-sync from chain */
export function resetRelayNonce() {
  if (_relayWallet) _relayWallet.reset();
}

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

  // Log the vote to MongoDB for analytics and fast preflight checks
  try {
    const connectDB = (await import('./db.js')).default;
    const VoteActivity = (await import('./models/VoteActivity.js')).default;
    const Election = (await import('./models/Election.js')).default;
    await connectDB();
    await VoteActivity.findOneAndUpdate(
      { txHash: receipt.hash },
      {
        electionId: Number(electionId),
        candidateId: Number(candidateId),
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        voterNullifier: voterNullifier,
        timestamp: new Date(),
      },
      { upsert: true, new: true }
    );
    // Increment totalVotes on the parent election document in MongoDB
    await Election.findOneAndUpdate(
      { electionId: Number(electionId) },
      { $inc: { totalVotes: 1 } }
    );
  } catch (dbErr) {
    console.error('Failed to log vote activity in MongoDB:', dbErr);
  }

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
  const address = await getRelayWallet().getAddress();
  const balance = await getProvider().getBalance(address);
  return ethers.formatEther(balance);
}

/** Get relay wallet address */
export async function getRelayAddress() {
  return await getRelayWallet().getAddress();
}

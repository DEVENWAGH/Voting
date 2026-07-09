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
let _relayQueue = Promise.resolve();

function isNonceError(err) {
  const msg = err?.message || err?.info?.error?.message || '';
  return (
    err?.code === 'NONCE_EXPIRED' ||
    msg.includes('nonce too low') ||
    msg.includes('Nonce too low') ||
    msg.includes('nonce has already been used')
  );
}

/** Serialize relay txs — only one in-flight at a time to avoid nonce collisions. */
function enqueueRelay(task) {
  const run = _relayQueue.then(task, task);
  _relayQueue = run.catch(() => {});
  return run;
}

async function sendRelayTx(sendFn, maxAttempts = 4) {
  return enqueueRelay(async () => {
    let lastErr;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      resetRelayNonce();
      try {
        const tx = await sendFn();
        return await tx.wait();
      } catch (err) {
        lastErr = err;
        if (isNonceError(err) && attempt < maxAttempts - 1) {
          console.warn(`[relay] nonce sync retry ${attempt + 1}/${maxAttempts - 1}`);
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  });
}

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

/** Log relay gas spend to MongoDB for Guardian analytics */
async function logRelayTransaction(receipt, operation, extra = {}) {
  try {
    const connectDB = (await import('./db.js')).default;
    const RelayTransaction = (await import('./models/RelayTransaction.js')).default;
    await connectDB();

    const gasUsed = receipt.gasUsed ?? 0n;
    const gasPrice = receipt.gasPrice ?? 0n;
    const gasCostWei = gasUsed * gasPrice;

    await RelayTransaction.findOneAndUpdate(
      { txHash: receipt.hash },
      {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        operation,
        gasUsed: gasUsed.toString(),
        gasPrice: gasPrice.toString(),
        gasCostEth: ethers.formatEther(gasCostWei),
        timestamp: new Date(),
        ...extra,
      },
      { upsert: true, new: true },
    );
  } catch (dbErr) {
    console.error('Failed to log relay transaction:', dbErr);
  }
}

/** Reset the NonceManager — call before bulk operations to re-sync from chain */
export function resetRelayNonce() {
  if (_relayWallet) _relayWallet.reset();
}

/** Register a voter on-chain for a specific election by their nullifier hash */
export async function relayRegisterVoter(electionId, nullifierHash, metadata = {}) {
  const receipt = await sendRelayTx(() =>
    getContract().registerVoterByRelay(electionId, nullifierHash),
  );
  await logRelayTransaction(receipt, 'register_voter', { electionId, metadata });
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/** Cast a vote on behalf of a voter (after OTP verification) */
export async function relayCastVote(electionId, candidateId, voterNullifier) {
  const receipt = await sendRelayTx(() =>
    getContract().castVoteRelayed(electionId, candidateId, voterNullifier),
  );
  await logRelayTransaction(receipt, 'cast_vote', { electionId });

  // Log the vote to MongoDB for analytics and fast preflight checks
  try {
    const connectDB = (await import('./db.js')).default;
    const VoteActivity = (await import('./models/VoteActivity.js')).default;
    const Election = (await import('./models/Election.js')).default;
    await connectDB();
    await VoteActivity.findOneAndUpdate(
      { txHash: receipt.hash },
      {
        electionId,
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
      { electionId },
      { $inc: { totalVotes: 1 } }
    );
  } catch (dbErr) {
    console.error('Failed to log vote activity in MongoDB:', dbErr);
  }

  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/** Create an election via relay (admin only) — returns bytes32 election ID */
export async function relayCreateElection(title, description, bannerUrl, startTime, endTime, orgSlug) {
  const receipt = await sendRelayTx(() =>
    getContract().createElection(title, description, bannerUrl, startTime, endTime),
  );
  await logRelayTransaction(receipt, 'create_election', { orgSlug });

  // Parse the ElectionCreated event to get the bytes32 election ID
  let electionId = null;
  try {
    const abi = require('./contracts/VotingV1.json').abi;
    const iface = new ethers.Interface(abi);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (parsed && parsed.name === 'ElectionCreated') {
          electionId = parsed.args[0]; // bytes32 electionId (first indexed param)
          break;
        }
      } catch {
        // Not our event, skip
      }
    }
  } catch (parseErr) {
    console.warn('[relay] Could not parse ElectionCreated event:', parseErr.message);
  }

  return { txHash: receipt.hash, blockNumber: receipt.blockNumber, electionId };
}

/** Add a candidate via relay */
export async function relayAddCandidate(electionId, name, party, symbol, manifesto, photoUrl, orgSlug) {
  const receipt = await sendRelayTx(() =>
    getContract().addCandidate(electionId, name, party, symbol, manifesto, photoUrl),
  );
  await logRelayTransaction(receipt, 'add_candidate', { electionId, orgSlug });
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/** Transition election phase via relay */
export async function relayTransitionPhase(electionId, newPhase, orgSlug) {
  const receipt = await sendRelayTx(() =>
    getContract().transitionPhase(electionId, newPhase),
  );
  await logRelayTransaction(receipt, 'transition_phase', {
    electionId,
    orgSlug,
    metadata: { newPhase: Number(newPhase) },
  });
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

/** Read-only contract for on-chain checks */
export function getReadContract() {
  const abi = require('./contracts/VotingV1.json').abi;
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!address) throw new Error('NEXT_PUBLIC_CONTRACT_ADDRESS not set in .env');
  return new ethers.Contract(address, abi, getProvider());
}

/** Check if a nullifier is registered for a specific election on-chain. */
export async function isVoterRegisteredOnChain(electionId, nullifierHash) {
  return getReadContract().isVoterRegisteredForElection(electionId, nullifierHash);
}

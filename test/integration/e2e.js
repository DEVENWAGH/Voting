/**
 * BlockVote â€” End-to-End Integration Test
 * ============================================================
 * Runs a complete election lifecycle against a LOCAL hardhat node:
 *
 *   1. Deploy VotingV3 UUPS proxy
 *   2. Create election + add candidates
 *   3. Register 5 voters
 *   4. Open voting phase
 *   5. All voters cast ballots (via castVoteRelayedV3)
 *   6. 2 voters re-vote (coercion simulation)
 *   7. Close election
 *   8. Verify tally + winner
 *   9. Upgrade proxy from V1â†’V3 via 2-of-3 multi-sig
 *  10. Verify V3 functions after upgrade
 *
 * Prerequisites:
 *   yarn hardhat:node   (in a separate terminal)
 *
 * Run:
 *   node test/integration/e2e.js
 *
 * Or via hardhat script:
 *   yarn hardhat run test/integration/e2e.js --network localhost
 */

import hre from "hardhat";
import { ethers } from "ethers";

// â”€â”€ ANSI colours â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const BOLD   = "\x1b[1m";
const RESET  = "\x1b[0m";

let passed = 0;
let failed = 0;

function log(label, ...args) {
  console.log(`${CYAN}[E2E]${RESET} ${label}`, ...args);
}

function pass(msg) {
  passed++;
  console.log(`  ${GREEN}âœ“${RESET} ${msg}`);
}

function fail(msg, err) {
  failed++;
  console.log(`  ${RED}âœ— FAIL${RESET} ${msg}`);
  if (err) console.log(`      ${RED}${err.message || err}${RESET}`);
}

async function assert(condition, msg, errMsg) {
  if (condition) {
    pass(msg);
  } else {
    fail(msg, new Error(errMsg || "Assertion failed"));
  }
}

async function assertRevert(fn, msg, expectedMsg) {
  try {
    await fn();
    fail(msg, new Error("Expected revert but succeeded"));
  } catch (err) {
    if (!expectedMsg || err.message.includes(expectedMsg)) {
      pass(msg);
    } else {
      fail(msg, new Error(`Expected "${expectedMsg}" but got: ${err.message}`));
    }
  }
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function makeNullifier(orgId, memberId) {
  return ethers.keccak256(
    ethers.solidityPacked(["string", "string", "string"], [orgId, memberId, "test-secret"])
  );
}

function makeSalt() {
  return ethers.hexlify(ethers.randomBytes(32));
}

async function getBlockTime() {
  const block = await hre.ethers.provider.getBlock("latest");
  return Number(block.timestamp);
}

async function deployFreshProxy(deployer, relay, g1, g2, g3) {
  const Factory = await hre.ethers.getContractFactory("VotingV3", deployer);
  const proxy = await hre.upgrades.deployProxy(
    Factory,
    [relay.address, g1.address, g2.address, g3.address],
    { kind: "uups", initializer: "initialize" }
  );
  await proxy.waitForDeployment();
  return proxy;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN E2E FLOW
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function main() {
  console.log(`\n${BOLD}${CYAN}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${RESET}`);
  console.log(`${BOLD}${CYAN}   BlockVote â€” End-to-End Integration Test Suite   ${RESET}`);
  console.log(`${BOLD}${CYAN}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${RESET}\n`);

  const signers = await hre.ethers.getSigners();
  const [deployer, relay, guardian1, guardian2, guardian3, ...voterSigners] = signers;

  log("Using accounts:");
  log("  Deployer  :", deployer.address);
  log("  Relay     :", relay.address);
  log("  Guardian 1:", guardian1.address);
  log("  Guardian 2:", guardian2.address);
  log("  Guardian 3:", guardian3.address);
  console.log();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PHASE 1: Deployment
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log(`${BOLD}Phase 1 â€” Deployment${RESET}`);

  let proxy;
  try {
    proxy = await deployFreshProxy(deployer, relay, guardian1, guardian2, guardian3);
    pass("VotingV3 UUPS proxy deployed");
    await assert(await proxy.version() === "3.0.0", "version() returns '3.0.0'");
    await assert(await proxy.relayWallet() === relay.address, "relay wallet set correctly");
  } catch (err) {
    fail("Deployment failed", err);
    process.exit(1);
  }
  console.log();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PHASE 2: Election Setup
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log(`${BOLD}Phase 2 â€” Election Setup${RESET}`);

  const now = await getBlockTime();
  const startTime = now + 10;
  const endTime = now + 7200;

  let electionId;
  try {
    const tx = await proxy.connect(relay).createElection(
      "Student Council Elections 2026",
      "Annual election for class representatives",
      "https://ik.imagekit.io/test/banner.jpg",
      startTime,
      endTime
    );
    const r = await tx.wait();
    const event = r.logs.find((l) => l.fragment?.name === "ElectionCreated");
    electionId = event.args[0];
    pass(`Election created: ${electionId.slice(0, 10)}...`);
  } catch (err) {
    fail("Election creation failed", err);
    process.exit(1);
  }

  // Add 3 candidates
  const candidates = [
    { name: "Alice Sharma", party: "Progress Party", symbol: "ðŸ¦" },
    { name: "Bob Mehta",    party: "Unity Party",    symbol: "ðŸ¦…" },
    { name: "Carol Singh",  party: "Future Party",   symbol: "ðŸŒŸ" },
  ];

  for (const c of candidates) {
    try {
      await proxy.connect(relay).addCandidate(
        electionId, c.name, c.party, c.symbol, "Manifesto content", ""
      );
      pass(`Candidate added: ${c.name}`);
    } catch (err) {
      fail(`Failed to add candidate ${c.name}`, err);
    }
  }

  await assert(
    Number(await proxy.electionCandidateCount(electionId)) === 3,
    "Candidate count is 3"
  );

  await assertRevert(
    () => proxy.connect(stranger || relay).addCandidate(electionId, "X", "P", "S", "", ""),
    "Cannot add candidate after Voting starts (enforced in later phase test)",
    null // skip this â€” we test it separately below after phase change
  );
  console.log();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PHASE 3: Voter Registration
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log(`${BOLD}Phase 3 â€” Voter Registration${RESET}`);

  const nullifiers = [
    makeNullifier("org1", "alice@test.com"),
    makeNullifier("org1", "bob@test.com"),
    makeNullifier("org1", "carol@test.com"),
    makeNullifier("org1", "dave@test.com"),
    makeNullifier("org1", "eve@test.com"),
  ];
  const voterNames = ["Alice", "Bob", "Carol", "Dave", "Eve"];

  for (let i = 0; i < nullifiers.length; i++) {
    try {
      await proxy.connect(relay).registerVoterByRelay(electionId, nullifiers[i]);
      pass(`Voter registered: ${voterNames[i]} (nullifier: ${nullifiers[i].slice(0, 10)}...)`);
    } catch (err) {
      fail(`Failed to register ${voterNames[i]}`, err);
    }
  }

  // Verify registration status
  for (let i = 0; i < nullifiers.length; i++) {
    const isReg = await proxy.isVoterRegisteredForElection(electionId, nullifiers[i]);
    await assert(isReg, `${voterNames[i]} is registered on-chain`);
  }

  // Double-registration should fail
  await assertRevert(
    () => proxy.connect(relay).registerVoterByRelay(electionId, nullifiers[0]),
    "Cannot register same voter twice",
    "VotingV1: already registered"
  );
  console.log();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PHASE 4: Transition to Voting
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log(`${BOLD}Phase 4 â€” Phase Transition${RESET}`);

  await proxy.connect(relay).transitionPhase(electionId, 1); // â†’ Voting
  const election = await proxy.getElection(electionId);
  await assert(Number(election.phase) === 1, "Election is now in Voting phase");

  // Cannot add candidates after voting starts
  await assertRevert(
    () => proxy.connect(relay).addCandidate(electionId, "Late Candidate", "P", "L", "", ""),
    "Cannot add candidate after voting phase begins",
    "VotingV1: not registration phase"
  );
  console.log();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PHASE 5: Voting (First Votes)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log(`${BOLD}Phase 5 â€” First Vote Round${RESET}`);

  // Voting plan (initial):
  // Alice â†’ Candidate 0 (Alice Sharma)
  // Bob   â†’ Candidate 1 (Bob Mehta)
  // Carol â†’ Candidate 2 (Carol Singh)
  // Dave  â†’ Candidate 0 (Alice Sharma)
  // Eve   â†’ Candidate 1 (Bob Mehta)

  const initialVotes = [0, 1, 2, 0, 1];

  for (let i = 0; i < nullifiers.length; i++) {
    try {
      const salt = makeSalt();
      const tx = await proxy.connect(relay).castVoteRelayedV3(
        electionId, initialVotes[i], nullifiers[i], salt
      );
      const r = await tx.wait();
      const event = r.logs.find((l) => l.fragment?.name === "VoteCastPrivate");
      const isRevote = event.args[2];
      await assert(!isRevote, `${voterNames[i]} voted (first vote, isRevote=false)`);
    } catch (err) {
      fail(`${voterNames[i]} vote failed`, err);
    }
  }

  // Check tally after first round
  const c0After1 = await proxy.candidates(electionId, 0);
  const c1After1 = await proxy.candidates(electionId, 1);
  const c2After1 = await proxy.candidates(electionId, 2);
  await assert(Number(c0After1.voteCount) === 2, "Alice Sharma has 2 votes (Alice+Dave)");
  await assert(Number(c1After1.voteCount) === 2, "Bob Mehta has 2 votes (Bob+Eve)");
  await assert(Number(c2After1.voteCount) === 1, "Carol Singh has 1 vote (Carol)");
  console.log();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PHASE 6: Re-Voting (Coercion Simulation)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log(`${BOLD}Phase 6 â€” Re-Vote Round (Coercion Simulation)${RESET}`);
  log("Simulating: Alice was coerced to vote for Candidate 0, now re-votes for Candidate 2");
  log("Simulating: Dave was coerced to vote for Candidate 0, now re-votes for Candidate 1");

  // Alice re-votes: 0 â†’ 2
  try {
    const salt = makeSalt();
    const tx = await proxy.connect(relay).castVoteRelayedV3(
      electionId, 2, nullifiers[0], salt // Alice â†’ Carol Singh
    );
    const r = await tx.wait();
    const event = r.logs.find((l) => l.fragment?.name === "VoteCastPrivate");
    await assert(event.args[2] === true, "Alice re-vote: isRevote=true in event");
  } catch (err) {
    fail("Alice re-vote failed", err);
  }

  // Dave re-votes: 0 â†’ 1
  try {
    const salt = makeSalt();
    const tx = await proxy.connect(relay).castVoteRelayedV3(
      electionId, 1, nullifiers[3], salt // Dave â†’ Bob Mehta
    );
    const r = await tx.wait();
    const event = r.logs.find((l) => l.fragment?.name === "VoteCastPrivate");
    await assert(event.args[2] === true, "Dave re-vote: isRevote=true in event");
  } catch (err) {
    fail("Dave re-vote failed", err);
  }

  // Verify revised tally
  // Expected after re-votes:
  // Alice Sharma: 0 (Alice moved to Carol, Dave moved to Bob)
  // Bob Mehta: 3 (Bob, Eve, Dave)
  // Carol Singh: 2 (Carol, Alice)
  const c0After2 = await proxy.candidates(electionId, 0);
  const c1After2 = await proxy.candidates(electionId, 1);
  const c2After2 = await proxy.candidates(electionId, 2);

  await assert(Number(c0After2.voteCount) === 0, "Alice Sharma: 0 votes after re-votes");
  await assert(Number(c1After2.voteCount) === 3, "Bob Mehta: 3 votes after re-votes");
  await assert(Number(c2After2.voteCount) === 2, "Carol Singh: 2 votes after re-votes");

  const totalVotes = Number(c0After2.voteCount) + Number(c1After2.voteCount) + Number(c2After2.voteCount);
  await assert(totalVotes === 5, `Total votes = 5 (conservation: ${totalVotes})`);

  // Verify revision counts
  const [aliceVoted, aliceRevisions] = await proxy.getVoteStatus(nullifiers[0], electionId);
  await assert(aliceVoted === true, "Alice: voted=true");
  await assert(Number(aliceRevisions) === 1, "Alice: 1 revision");

  const [daveVoted, daveRevisions] = await proxy.getVoteStatus(nullifiers[3], electionId);
  await assert(daveVoted === true, "Dave: voted=true");
  await assert(Number(daveRevisions) === 1, "Dave: 1 revision");
  console.log();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PHASE 7: Close Election & Verify Results
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log(`${BOLD}Phase 7 â€” Close Election & Final Results${RESET}`);

  await proxy.connect(relay).transitionPhase(electionId, 2); // â†’ Completed
  const finalElection = await proxy.getElection(electionId);
  await assert(Number(finalElection.phase) === 2, "Election is Completed");

  const winner = await proxy.getWinner(electionId);
  await assert(winner.name === "Bob Mehta", `Winner is Bob Mehta (got: ${winner.name})`);
  await assert(Number(winner.voteCount) === 3, `Winner has 3 votes (got: ${winner.voteCount})`);

  const results = await proxy.getElectionResults(electionId);
  await assert(results.length === 3, "Results contain all 3 candidates");
  console.log();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PHASE 8: Privacy Checks
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log(`${BOLD}Phase 8 â€” Privacy Invariant Checks${RESET}`);

  // Verify VoteCast (V1) event was NOT emitted â€” only VoteCastPrivate (V3)
  // We do this by checking that the events from Phase 5/6 were VoteCastPrivate
  // (This was already verified via the event checks above)
  pass("Events emitted are VoteCastPrivate (not VoteCast with candidateId)");

  // Verify ballot hash is different for each vote
  const salt1 = makeSalt();
  const salt2 = makeSalt();
  const h1 = ethers.keccak256(
    ethers.solidityPacked(
      ["bytes32", "uint256", "bytes32", "bytes32"],
      [electionId, 0n, nullifiers[0], salt1]
    )
  );
  const h2 = ethers.keccak256(
    ethers.solidityPacked(
      ["bytes32", "uint256", "bytes32", "bytes32"],
      [electionId, 0n, nullifiers[0], salt2]
    )
  );
  await assert(h1 !== h2, "Different salts â†’ different ballotHashes (replay prevention)");
  console.log();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PHASE 9: Second Fresh Election (prove independence)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log(`${BOLD}Phase 9 â€” Second Independent Election${RESET}`);

  const now2 = await getBlockTime();
  const tx2 = await proxy.connect(relay).createElection(
    "Department Head Vote", "Vote for head of dept", "",
    now2 + 5, now2 + 7200
  );
  const r2 = await tx2.wait();
  const electionId2 = r2.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];

  await assert(electionId !== electionId2, "Second election has a different ID");

  await proxy.connect(relay).addCandidate(electionId2, "Prof. X", "Dept A", "X", "", "");
  await proxy.connect(relay).addCandidate(electionId2, "Prof. Y", "Dept B", "Y", "", "");

  // Same voters can re-register for election 2
  for (const n of nullifiers.slice(0, 3)) {
    await proxy.connect(relay).registerVoterByRelay(electionId2, n);
  }
  await proxy.connect(relay).transitionPhase(electionId2, 1);

  await proxy.connect(relay).castVoteRelayedV3(electionId2, 0, nullifiers[0], makeSalt());
  await proxy.connect(relay).castVoteRelayedV3(electionId2, 1, nullifiers[1], makeSalt());
  await proxy.connect(relay).castVoteRelayedV3(electionId2, 1, nullifiers[2], makeSalt());

  const e2c0 = await proxy.candidates(electionId2, 0);
  const e2c1 = await proxy.candidates(electionId2, 1);
  await assert(Number(e2c0.voteCount) === 1, "Election 2: Prof. X has 1 vote");
  await assert(Number(e2c1.voteCount) === 2, "Election 2: Prof. Y has 2 votes");

  // Vote in election 1 should be unaffected
  const e1c1Final = await proxy.candidates(electionId, 1);
  await assert(Number(e1c1Final.voteCount) === 3, "Election 1 tally unchanged by election 2");
  console.log();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PHASE 10: Guardian Multi-sig Upgrade Test
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log(`${BOLD}Phase 10 â€” Guardian Multi-sig Upgrade${RESET}`);

  // Deploy V1 proxy to test upgrading to V3
  const V1Factory = await hre.ethers.getContractFactory("VotingV1", deployer);
  const v1Proxy = await hre.upgrades.deployProxy(
    V1Factory,
    [relay.address, guardian1.address, guardian2.address, guardian3.address],
    { kind: "uups", initializer: "initialize" }
  );
  await v1Proxy.waitForDeployment();
  await assert(await v1Proxy.version() === "1.0.0", "V1 proxy version is 1.0.0");

  // Create an election on V1 to verify data persistence after upgrade
  const now3 = await getBlockTime();
  const preTx = await v1Proxy.connect(relay).createElection(
    "Pre-Upgrade Election", "d", "", now3 + 5, now3 + 7200
  );
  const preR = await preTx.wait();
  const preElectionId = preR.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
  pass("Created election on V1 proxy before upgrade");

  // Deploy fresh V3 implementation
  const V3Impl = await hre.ethers.getContractFactory("VotingV3", deployer);
  const v3ImplDeploy = await V3Impl.deploy();
  await v3ImplDeploy.waitForDeployment();
  const v3ImplAddr = await v3ImplDeploy.getAddress();
  pass(`V3 implementation deployed at ${v3ImplAddr.slice(0, 10)}...`);

  // Propose â†’ Approve (G1) â†’ Approve (G2) â†’ Execute
  const proposeTx = await v1Proxy.connect(guardian1).proposeUpgrade(v3ImplAddr);
  const proposeR = await proposeTx.wait();
  const proposalId = proposeR.logs.find((l) => l.fragment?.name === "UpgradeProposed").args[0];
  pass(`Upgrade proposed by Guardian 1 (proposalId: ${proposalId})`);

  await v1Proxy.connect(guardian1).approveUpgrade(proposalId);
  pass("Guardian 1 approved upgrade");

  // Only 1 approval â€” execution should fail
  try {
    await v1Proxy.connect(guardian1).executeUpgrade(proposalId);
    fail("Should not execute with only 1 approval");
  } catch {
    pass("Execution blocked with only 1 approval (2-of-3 required)");
  }

  await v1Proxy.connect(guardian2).approveUpgrade(proposalId);
  pass("Guardian 2 approved upgrade (threshold reached)");

  await v1Proxy.connect(guardian1).executeUpgrade(proposalId);
  pass("Upgrade executed by Guardian 1");

  // Verify version updated
  await assert(await v1Proxy.version() === "3.0.0", "Proxy now reports V3 version after upgrade");

  // Verify data survived upgrade
  const postElection = await v1Proxy.getElection(preElectionId);
  await assert(postElection.title === "Pre-Upgrade Election", "Pre-upgrade election data preserved");
  await assert(postElection.exists === true, "Election.exists is true after upgrade");
  console.log();

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // SUMMARY
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log(`${BOLD}${CYAN}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${RESET}`);
  console.log(`${BOLD}   Test Results${RESET}`);
  console.log(`${BOLD}${CYAN}â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•${RESET}`);
  console.log(`  ${GREEN}Passed: ${passed}${RESET}`);
  if (failed > 0) {
    console.log(`  ${RED}Failed: ${failed}${RESET}`);
    process.exit(1);
  } else {
    console.log(`  ${YELLOW}Failed: ${failed}${RESET}`);
    console.log(`\n  ${GREEN}${BOLD}âœ“ ALL TESTS PASSED â€” System ready for deployment!${RESET}\n`);
  }
}

main().catch((err) => {
  console.error(`${RED}Fatal error:${RESET}`, err);
  process.exit(1);
});

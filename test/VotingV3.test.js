import hre from "hardhat";
import { expect } from "chai";
import { ethers } from "ethers";

/**
 * VotingV3 Contract Test Suite
 * ============================================================
 * Tests the full lifecycle:
 *   Election creation â†’ Candidate setup â†’ Voter registration â†’
 *   Phase transition â†’ Voting â†’ Re-voting â†’ Tallying â†’ Upgrade
 *
 * Run: yarn hardhat test test/VotingV3.test.js
 */

describe("VotingV3 â€” Full Contract Test Suite", function () {
  let proxy, relay, guardian1, guardian2, guardian3, deployer, stranger;
  let electionId;
  const NULL_HASH = ethers.ZeroHash;

  // â”€â”€ Helper: fast-forward time â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function fastForward(seconds) {
    await hre.network.provider.send("evm_increaseTime", [seconds]);
    await hre.network.provider.send("evm_mine");
  }

  // â”€â”€ Helper: get current block timestamp (avoids Date.now() drift) â”€â”€â”€â”€â”€â”€
  async function getBlockTime() {
    const block = await hre.ethers.provider.getBlock("latest");
    return Number(block.timestamp);
  }

  // â”€â”€ Helper: generate nullifier hash (mirrors server logic) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function makeNullifier(orgId, memberId, secret = "test-secret") {
    return ethers.keccak256(
      ethers.solidityPacked(["string", "string", "string"], [orgId, memberId, secret])
    );
  }

  // â”€â”€ Helper: generate ballot salt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function makeSalt() {
    return ethers.hexlify(ethers.randomBytes(32));
  }


  // â”€â”€ Deploy fresh proxy before every test â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  beforeEach(async function () {
    [deployer, relay, guardian1, guardian2, guardian3, stranger] =
      await hre.ethers.getSigners();

    const VotingV3 = await hre.ethers.getContractFactory("VotingV3", deployer);
    proxy = await hre.upgrades.deployProxy(
      VotingV3,
      [relay.address, guardian1.address, guardian2.address, guardian3.address],
      { kind: "uups", initializer: "initialize" }
    );
    await proxy.waitForDeployment();
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SECTION 1: Initialization & Access Control
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  describe("1 Â· Initialization & Access Control", function () {
    it("1.1 version() returns '3.0.0'", async function () {
      expect(await proxy.version()).to.equal("3.0.0");
    });

    it("1.2 relay wallet is set correctly", async function () {
      expect(await proxy.relayWallet()).to.equal(relay.address);
    });

    it("1.3 all 3 guardians are set correctly", async function () {
      const gs = await proxy.getGuardians();
      expect(gs[0]).to.equal(guardian1.address);
      expect(gs[1]).to.equal(guardian2.address);
      expect(gs[2]).to.equal(guardian3.address);
    });

    it("1.4 cannot re-initialize proxy", async function () {
      await expect(
        proxy.initialize(relay.address, guardian1.address, guardian2.address, guardian3.address)
      ).to.be.reverted;
    });

    it("1.5 non-relay cannot create election", async function () {
      const now = await getBlockTime();
      await expect(
        proxy.connect(stranger).createElection(
          "Hacked", "desc", "", now + 10, now + 3600
        )
      ).to.be.revertedWith("VotingV1: caller is not relay");
    });

    it("1.6 non-guardian cannot propose upgrade", async function () {
      await expect(
        proxy.connect(stranger).proposeUpgrade(ethers.ZeroAddress)
      ).to.be.revertedWith("VotingV1: caller is not a guardian");
    });

    it("1.7 cannot initialize with duplicate guardians", async function () {
      const VotingV3 = await hre.ethers.getContractFactory("VotingV3", deployer);
      await expect(
        hre.upgrades.deployProxy(
          VotingV3,
          [relay.address, guardian1.address, guardian1.address, guardian3.address],
          { kind: "uups", initializer: "initialize" }
        )
      ).to.be.revertedWith("VotingV1: guardians must be unique");
    });
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SECTION 2: Election Management
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  describe("2 Â· Election Management", function () {
    let startTime, endTime;

    beforeEach(async function () {
      startTime = await getBlockTime() + 10;
      endTime = startTime + 3600;
    });

    it("2.1 relay can create an election", async function () {
      const tx = await proxy.connect(relay).createElection(
        "Student Council 2026", "Annual election", "", startTime, endTime
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (l) => l.fragment?.name === "ElectionCreated"
      );
      expect(event).to.exist;
      electionId = event.args[0];
      expect(electionId).to.match(/^0x[0-9a-fA-F]{64}$/);
    });

    it("2.2 election starts in Registration phase", async function () {
      const tx = await proxy.connect(relay).createElection(
        "Test", "desc", "", startTime, endTime
      );
      const r = await tx.wait();
      const eid = r.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      const election = await proxy.getElection(eid);
      expect(election.phase).to.equal(0n); // Registration = 0
    });

    it("2.3 cannot create election with empty title", async function () {
      await expect(
        proxy.connect(relay).createElection("", "desc", "", startTime, endTime)
      ).to.be.revertedWith("VotingV1: title empty");
    });

    it("2.4 cannot create election with start time in the past", async function () {
      const pastStart = await getBlockTime() - 100;
      await expect(
        proxy.connect(relay).createElection("Old", "desc", "", pastStart, endTime)
      ).to.be.revertedWith("VotingV1: start in past");
    });

    it("2.5 cannot create election with end before start", async function () {
      await expect(
        proxy.connect(relay).createElection("Bad", "desc", "", startTime, startTime - 1)
      ).to.be.revertedWith("VotingV1: end before start");
    });

    it("2.6 election IDs are unique across elections", async function () {
      await fastForward(1);
      const t1 = await proxy.connect(relay).createElection("E1", "d1", "", startTime + 5, endTime);
      const r1 = await t1.wait();
      const id1 = r1.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      await fastForward(2);
      const t2 = await proxy.connect(relay).createElection("E2", "d2", "", startTime + 20, endTime + 10);
      const r2 = await t2.wait();
      const id2 = r2.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      expect(id1).to.not.equal(id2);
    });

    it("2.7 getAllElections returns all created elections", async function () {
      await proxy.connect(relay).createElection("E1", "d", "", startTime, endTime);
      await fastForward(2);
      await proxy.connect(relay).createElection("E2", "d", "", startTime + 10, endTime + 10);
      const all = await proxy.getAllElections();
      expect(all.length).to.equal(2);
    });
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SECTION 3: Candidate Management
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  describe("3 Â· Candidate Management", function () {
    beforeEach(async function () {
      const now = await getBlockTime();
      const tx = await proxy.connect(relay).createElection(
        "Candidate Test", "desc", "", now + 10, now + 3600
      );
      const r = await tx.wait();
      electionId = r.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
    });

    it("3.1 relay can add a candidate during Registration", async function () {
      await expect(
        proxy.connect(relay).addCandidate(electionId, "Alice", "Party A", "ðŸ¦", "manifesto", "")
      ).to.emit(proxy, "CandidateAdded");
    });

    it("3.2 candidate count increments correctly", async function () {
      await proxy.connect(relay).addCandidate(electionId, "Alice", "P", "A", "", "");
      await proxy.connect(relay).addCandidate(electionId, "Bob", "Q", "B", "", "");
      expect(await proxy.electionCandidateCount(electionId)).to.equal(2n);
    });

    it("3.3 non-relay cannot add candidate", async function () {
      await expect(
        proxy.connect(stranger).addCandidate(electionId, "X", "P", "S", "", "")
      ).to.be.revertedWith("VotingV1: caller is not relay");
    });

    it("3.4 cannot add candidate with empty name", async function () {
      await expect(
        proxy.connect(relay).addCandidate(electionId, "", "Party", "S", "", "")
      ).to.be.revertedWith("VotingV1: name empty");
    });

    it("3.5 cannot add candidate after voting starts", async function () {
      await proxy.connect(relay).addCandidate(electionId, "Alice", "P", "A", "", "");
      await proxy.connect(relay).transitionPhase(electionId, 1); // â†’ Voting
      await expect(
        proxy.connect(relay).addCandidate(electionId, "Late", "P", "L", "", "")
      ).to.be.revertedWith("VotingV1: not registration phase");
    });

    it("3.6 getCandidates returns all candidates", async function () {
      await proxy.connect(relay).addCandidate(electionId, "Alice", "P", "A", "", "");
      await proxy.connect(relay).addCandidate(electionId, "Bob", "Q", "B", "", "");
      const candidates = await proxy.getCandidates(electionId);
      expect(candidates.length).to.equal(2);
      expect(candidates[0].name).to.equal("Alice");
      expect(candidates[1].name).to.equal("Bob");
    });
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SECTION 4: Phase Transitions
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  describe("4 Â· Phase Transitions", function () {
    beforeEach(async function () {
      const now = await getBlockTime();
      const tx = await proxy.connect(relay).createElection(
        "Phase Test", "desc", "", now + 5, now + 3600
      );
      const r = await tx.wait();
      electionId = r.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      await proxy.connect(relay).addCandidate(electionId, "Alice", "P", "A", "", "");
      await proxy.connect(relay).addCandidate(electionId, "Bob", "Q", "B", "", "");
    });

    it("4.1 can transition Registration â†’ Voting", async function () {
      await expect(
        proxy.connect(relay).transitionPhase(electionId, 1)
      ).to.emit(proxy, "PhaseChanged").withArgs(electionId, 1n);
    });

    it("4.2 can transition Voting â†’ Completed", async function () {
      await proxy.connect(relay).transitionPhase(electionId, 1);
      await expect(
        proxy.connect(relay).transitionPhase(electionId, 2)
      ).to.emit(proxy, "PhaseChanged").withArgs(electionId, 2n);
    });

    it("4.3 cannot go back from Voting to Registration", async function () {
      await proxy.connect(relay).transitionPhase(electionId, 1);
      await expect(
        proxy.connect(relay).transitionPhase(electionId, 0)
      ).to.be.revertedWith("VotingV1: invalid transition");
    });

    it("4.4 cannot transition from Completed", async function () {
      await proxy.connect(relay).transitionPhase(electionId, 1);
      await proxy.connect(relay).transitionPhase(electionId, 2);
      await expect(
        proxy.connect(relay).transitionPhase(electionId, 1)
      ).to.be.revertedWith("VotingV1: already completed");
    });

    it("4.5 cannot start voting with zero candidates", async function () {
      const now = await getBlockTime();
      const tx2 = await proxy.connect(relay).createElection(
        "Empty", "e", "", now + 100, now + 3700
      );
      const r2 = await tx2.wait();
      const eid2 = r2.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      await expect(
        proxy.connect(relay).transitionPhase(eid2, 1)
      ).to.be.revertedWith("VotingV1: no candidates");
    });

    it("4.6 non-relay cannot change phase", async function () {
      await expect(
        proxy.connect(stranger).transitionPhase(electionId, 1)
      ).to.be.revertedWith("VotingV1: caller is not relay");
    });
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SECTION 5: Voter Registration
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  describe("5 Â· Voter Registration", function () {
    let voter1Hash;

    beforeEach(async function () {
      const now = await getBlockTime();
      const tx = await proxy.connect(relay).createElection(
        "Reg Test", "desc", "", now + 5, now + 3600
      );
      const r = await tx.wait();
      electionId = r.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      voter1Hash = makeNullifier("org1", "member1");
    });

    it("5.1 relay can register a voter", async function () {
      await expect(
        proxy.connect(relay).registerVoterByRelay(electionId, voter1Hash)
      ).to.emit(proxy, "VoterRegistered").withArgs(electionId, voter1Hash);
    });

    it("5.2 cannot register same voter twice in same election", async function () {
      await proxy.connect(relay).registerVoterByRelay(electionId, voter1Hash);
      await expect(
        proxy.connect(relay).registerVoterByRelay(electionId, voter1Hash)
      ).to.be.revertedWith("VotingV1: already registered");
    });

    it("5.3 same nullifier can be registered in DIFFERENT elections", async function () {
      await proxy.connect(relay).registerVoterByRelay(electionId, voter1Hash);
      await fastForward(5);
      const now = await getBlockTime();
      const tx2 = await proxy.connect(relay).createElection(
        "E2", "d", "", now + 5, now + 3600
      );
      const r2 = await tx2.wait();
      const eid2 = r2.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      // Same voter, different election â€” must succeed
      await expect(
        proxy.connect(relay).registerVoterByRelay(eid2, voter1Hash)
      ).to.emit(proxy, "VoterRegistered");
    });

    it("5.4 cannot register with zero hash", async function () {
      await expect(
        proxy.connect(relay).registerVoterByRelay(electionId, NULL_HASH)
      ).to.be.revertedWith("VotingV1: zero hash");
    });

    it("5.5 non-relay cannot register voter", async function () {
      await expect(
        proxy.connect(stranger).registerVoterByRelay(electionId, voter1Hash)
      ).to.be.revertedWith("VotingV1: caller is not relay");
    });

    it("5.6 isVoterRegisteredForElection returns correct values", async function () {
      expect(await proxy.isVoterRegisteredForElection(electionId, voter1Hash)).to.be.false;
      await proxy.connect(relay).registerVoterByRelay(electionId, voter1Hash);
      expect(await proxy.isVoterRegisteredForElection(electionId, voter1Hash)).to.be.true;
    });
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SECTION 6: VotingV3 â€” First Vote
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  describe("6 Â· VotingV3 First Vote", function () {
    let voter1Hash;

    beforeEach(async function () {
      const now = await getBlockTime();
      const tx = await proxy.connect(relay).createElection(
        "Vote Test", "desc", "", now + 5, now + 3600
      );
      const r = await tx.wait();
      electionId = r.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      await proxy.connect(relay).addCandidate(electionId, "Alice", "P", "A", "", "");
      await proxy.connect(relay).addCandidate(electionId, "Bob", "Q", "B", "", "");
      voter1Hash = makeNullifier("org1", "voter1");
      await proxy.connect(relay).registerVoterByRelay(electionId, voter1Hash);
      await proxy.connect(relay).transitionPhase(electionId, 1); // â†’ Voting
    });

    it("6.1 voter can cast first vote (V3)", async function () {
      const salt = makeSalt();
      await expect(
        proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter1Hash, salt)
      ).to.emit(proxy, "VoteCastPrivate");
    });

    it("6.2 VoteCastPrivate event has correct electionId and isRevote=false", async function () {
      const salt = makeSalt();
      const tx = await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter1Hash, salt);
      const r = await tx.wait();
      const event = r.logs.find((l) => l.fragment?.name === "VoteCastPrivate");
      expect(event.args[0]).to.equal(electionId); // electionId
      expect(event.args[2]).to.be.false;           // isRevote = false for first vote
    });

    it("6.3 VoteCastPrivate event does NOT emit candidateId", async function () {
      const salt = makeSalt();
      const tx = await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter1Hash, salt);
      const r = await tx.wait();
      const event = r.logs.find((l) => l.fragment?.name === "VoteCastPrivate");
      // Event has 3 args: electionId, ballotHash, isRevote â€” no candidateId
      expect(event.args.length).to.equal(3);
    });

    it("6.4 voteCount increments for the voted candidate", async function () {
      const salt = makeSalt();
      await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter1Hash, salt);
      const candidate = await proxy.candidates(electionId, 0);
      expect(candidate.voteCount).to.equal(1n);
    });

    it("6.5 hasVoted is set to true after first vote", async function () {
      const salt = makeSalt();
      await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter1Hash, salt);
      expect(await proxy.hasVoterVoted(voter1Hash, electionId)).to.be.true;
    });

    it("6.6 cannot vote for invalid candidateId", async function () {
      const salt = makeSalt();
      await expect(
        proxy.connect(relay).castVoteRelayedV3(electionId, 99, voter1Hash, salt)
      ).to.be.revertedWith("VotingV3: invalid candidate");
    });

    it("6.7 cannot vote when election is in Registration phase", async function () {
      const now = await getBlockTime();
      const tx2 = await proxy.connect(relay).createElection("E2", "d", "", now + 100, now + 3700);
      const r2 = await tx2.wait();
      const eid2 = r2.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      await proxy.connect(relay).addCandidate(eid2, "X", "P", "S", "", "");
      const voter2 = makeNullifier("org1", "voter2");
      await proxy.connect(relay).registerVoterByRelay(eid2, voter2);
      // Still in Registration phase
      const salt = makeSalt();
      await expect(
        proxy.connect(relay).castVoteRelayedV3(eid2, 0, voter2, salt)
      ).to.be.revertedWith("VotingV3: not voting phase");
    });

    it("6.8 unregistered voter cannot vote", async function () {
      const unregistered = makeNullifier("org1", "outsider");
      const salt = makeSalt();
      await expect(
        proxy.connect(relay).castVoteRelayedV3(electionId, 0, unregistered, salt)
      ).to.be.revertedWith("VotingV3: voter not registered");
    });

    it("6.9 non-relay cannot call castVoteRelayedV3", async function () {
      const salt = makeSalt();
      await expect(
        proxy.connect(stranger).castVoteRelayedV3(electionId, 0, voter1Hash, salt)
      ).to.be.revertedWith("VotingV1: caller is not relay");
    });

    it("6.10 getVoteStatus returns (true, 0) after first vote", async function () {
      const salt = makeSalt();
      await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter1Hash, salt);
      const [voted, revisions] = await proxy.getVoteStatus(voter1Hash, electionId);
      expect(voted).to.be.true;
      expect(revisions).to.equal(0n);
    });
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SECTION 7: VotingV3 â€” Re-Voting (Coercion Resistance)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  describe("7 Â· VotingV3 Re-Voting (Coercion Resistance)", function () {
    let voter1Hash;

    beforeEach(async function () {
      const now = await getBlockTime();
      const tx = await proxy.connect(relay).createElection(
        "Re-vote Test", "desc", "", now + 5, now + 7200
      );
      const r = await tx.wait();
      electionId = r.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      await proxy.connect(relay).addCandidate(electionId, "Alice", "P", "A", "", "");
      await proxy.connect(relay).addCandidate(electionId, "Bob", "Q", "B", "", "");
      await proxy.connect(relay).addCandidate(electionId, "Carol", "R", "C", "", "");
      voter1Hash = makeNullifier("org1", "voter1");
      await proxy.connect(relay).registerVoterByRelay(electionId, voter1Hash);
      await proxy.connect(relay).transitionPhase(electionId, 1);
      // Initial vote for Alice (0)
      await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter1Hash, makeSalt());
    });

    it("7.1 voter can re-vote for a different candidate", async function () {
      await expect(
        proxy.connect(relay).castVoteRelayedV3(electionId, 1, voter1Hash, makeSalt())
      ).to.emit(proxy, "VoteCastPrivate");
    });

    it("7.2 VoteCastPrivate isRevote=true on re-vote", async function () {
      const tx = await proxy.connect(relay).castVoteRelayedV3(electionId, 1, voter1Hash, makeSalt());
      const r = await tx.wait();
      const event = r.logs.find((l) => l.fragment?.name === "VoteCastPrivate");
      expect(event.args[2]).to.be.true; // isRevote = true
    });

    it("7.3 old candidate voteCount decrements on re-vote", async function () {
      // Alice had 1 vote
      await proxy.connect(relay).castVoteRelayedV3(electionId, 1, voter1Hash, makeSalt());
      const alice = await proxy.candidates(electionId, 0);
      expect(alice.voteCount).to.equal(0n); // decremented
    });

    it("7.4 new candidate voteCount increments on re-vote", async function () {
      await proxy.connect(relay).castVoteRelayedV3(electionId, 1, voter1Hash, makeSalt());
      const bob = await proxy.candidates(electionId, 1);
      expect(bob.voteCount).to.equal(1n);
    });

    it("7.5 total voteCount across all candidates stays constant after re-vote", async function () {
      // 1 voter, total votes should always = 1
      await proxy.connect(relay).castVoteRelayedV3(electionId, 1, voter1Hash, makeSalt());
      const alice = await proxy.candidates(electionId, 0);
      const bob = await proxy.candidates(electionId, 1);
      const carol = await proxy.candidates(electionId, 2);
      const total = Number(alice.voteCount) + Number(bob.voteCount) + Number(carol.voteCount);
      expect(total).to.equal(1);
    });

    it("7.6 voteRevisionCount increments on each re-vote", async function () {
      await proxy.connect(relay).castVoteRelayedV3(electionId, 1, voter1Hash, makeSalt());
      await proxy.connect(relay).castVoteRelayedV3(electionId, 2, voter1Hash, makeSalt());
      const [voted, revisions] = await proxy.getVoteStatus(voter1Hash, electionId);
      expect(voted).to.be.true;
      expect(revisions).to.equal(2n); // 2 re-votes after the initial
    });

    it("7.7 voteChoice updates to latest candidate after re-vote", async function () {
      await proxy.connect(relay).castVoteRelayedV3(electionId, 2, voter1Hash, makeSalt());
      // voteChoice stores candidateId + 1
      const choice = await proxy.voteChoice(voter1Hash, electionId);
      expect(choice).to.equal(3n); // Carol (2) + 1 = 3
    });

    it("7.8 re-voting for the SAME candidate does not change counts", async function () {
      const aliceBefore = await proxy.candidates(electionId, 0);
      await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter1Hash, makeSalt());
      const aliceAfter = await proxy.candidates(electionId, 0);
      expect(aliceBefore.voteCount).to.equal(aliceAfter.voteCount); // unchanged
    });

    it("7.9 multiple voters re-voting maintains correct tally", async function () {
      const voter2 = makeNullifier("org1", "voter2");
      const voter3 = makeNullifier("org1", "voter3");
      await proxy.connect(relay).registerVoterByRelay(electionId, voter2);
      await proxy.connect(relay).registerVoterByRelay(electionId, voter3);
      // v2 votes Alice, v3 votes Bob
      await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter2, makeSalt());
      await proxy.connect(relay).castVoteRelayedV3(electionId, 1, voter3, makeSalt());
      // v1 re-votes to Bob (was Alice), v2 re-votes to Carol
      await proxy.connect(relay).castVoteRelayedV3(electionId, 1, voter1Hash, makeSalt());
      await proxy.connect(relay).castVoteRelayedV3(electionId, 2, voter2, makeSalt());
      const alice = await proxy.candidates(electionId, 0);
      const bob = await proxy.candidates(electionId, 1);
      const carol = await proxy.candidates(electionId, 2);
      // Alice: 0 (v1 switched, v2 switched)
      // Bob: 2 (v1 + v3)
      // Carol: 1 (v2)
      expect(alice.voteCount).to.equal(0n);
      expect(bob.voteCount).to.equal(2n);
      expect(carol.voteCount).to.equal(1n);
    });

    it("7.10 ballotHash changes between votes for same voter (different salt)", async function () {
      const salt1 = makeSalt();
      const salt2 = makeSalt();
      const tx1 = await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter1Hash, salt1);
      const r1 = await tx1.wait();
      const hash1 = r1.logs.find((l) => l.fragment?.name === "VoteCastPrivate").args[1];

      const tx2 = await proxy.connect(relay).castVoteRelayedV3(electionId, 1, voter1Hash, salt2);
      const r2 = await tx2.wait();
      const hash2 = r2.logs.find((l) => l.fragment?.name === "VoteCastPrivate").args[1];

      // Different salts + different candidates = different hashes
      expect(hash1).to.not.equal(hash2);
    });
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SECTION 8: Tallying & Results
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  describe("8 Â· Tallying & Results", function () {
    let voter1Hash, voter2Hash, voter3Hash;

    beforeEach(async function () {
      const now = await getBlockTime();
      const tx = await proxy.connect(relay).createElection("Results", "d", "", now + 5, now + 7200);
      const r = await tx.wait();
      electionId = r.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      await proxy.connect(relay).addCandidate(electionId, "Alice", "P", "A", "", "");
      await proxy.connect(relay).addCandidate(electionId, "Bob", "Q", "B", "", "");
      voter1Hash = makeNullifier("org", "v1");
      voter2Hash = makeNullifier("org", "v2");
      voter3Hash = makeNullifier("org", "v3");
      await proxy.connect(relay).registerVoterByRelay(electionId, voter1Hash);
      await proxy.connect(relay).registerVoterByRelay(electionId, voter2Hash);
      await proxy.connect(relay).registerVoterByRelay(electionId, voter3Hash);
      await proxy.connect(relay).transitionPhase(electionId, 1);
      // v1 â†’ Alice, v2 â†’ Bob, v3 â†’ Alice
      await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter1Hash, makeSalt());
      await proxy.connect(relay).castVoteRelayedV3(electionId, 1, voter2Hash, makeSalt());
      await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter3Hash, makeSalt());
      // Close election
      await proxy.connect(relay).transitionPhase(electionId, 2);
    });

    it("8.1 getElectionResults returns candidates after completion", async function () {
      const results = await proxy.getElectionResults(electionId);
      expect(results.length).to.equal(2);
    });

    it("8.2 vote counts are correct in final tally", async function () {
      const results = await proxy.getElectionResults(electionId);
      expect(results[0].voteCount).to.equal(2n); // Alice: 2
      expect(results[1].voteCount).to.equal(1n); // Bob: 1
    });

    it("8.3 getWinner returns the candidate with most votes", async function () {
      const winner = await proxy.getWinner(electionId);
      expect(winner.name).to.equal("Alice");
      expect(winner.voteCount).to.equal(2n);
    });

    it("8.4 cannot get results before election is Completed", async function () {
      const now = await getBlockTime();
      const tx2 = await proxy.connect(relay).createElection("Open", "d", "", now + 5, now + 7200);
      const r2 = await tx2.wait();
      const eid2 = r2.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      await proxy.connect(relay).addCandidate(eid2, "X", "P", "S", "", "");
      await proxy.connect(relay).transitionPhase(eid2, 1);
      await expect(proxy.getElectionResults(eid2)).to.be.revertedWith("VotingV1: not completed");
    });

    it("8.5 cannot get winner before election is Completed", async function () {
      const now = await getBlockTime();
      const tx2 = await proxy.connect(relay).createElection("Open2", "d", "", now + 5, now + 7200);
      const r2 = await tx2.wait();
      const eid2 = r2.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      await proxy.connect(relay).addCandidate(eid2, "X", "P", "S", "", "");
      await proxy.connect(relay).transitionPhase(eid2, 1);
      await expect(proxy.getWinner(eid2)).to.be.revertedWith("VotingV1: not completed");
    });
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SECTION 9: Privacy Invariants
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  describe("9 Â· Privacy Invariants", function () {
    let voter1Hash;

    beforeEach(async function () {
      const now = await getBlockTime();
      const tx = await proxy.connect(relay).createElection("Privacy", "d", "", now + 5, now + 7200);
      const r = await tx.wait();
      electionId = r.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      await proxy.connect(relay).addCandidate(electionId, "Alice", "P", "A", "", "");
      await proxy.connect(relay).addCandidate(electionId, "Bob", "Q", "B", "", "");
      voter1Hash = makeNullifier("org1", "voter1");
      await proxy.connect(relay).registerVoterByRelay(electionId, voter1Hash);
      await proxy.connect(relay).transitionPhase(electionId, 1);
    });

    it("9.1 VoteCastPrivate event has no candidateId field", async function () {
      const salt = makeSalt();
      const tx = await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter1Hash, salt);
      const r = await tx.wait();
      const event = r.logs.find((l) => l.fragment?.name === "VoteCastPrivate");
      // Verify structure: (electionId, ballotHash, isRevote) â€” NOT (electionId, candidateId)
      expect(event.fragment.inputs.map((i) => i.name)).to.deep.equal([
        "electionId", "ballotHash", "isRevote"
      ]);
    });

    it("9.2 ballotHash is deterministic given same inputs", async function () {
      const salt = "0x" + "ab".repeat(32);
      const expected = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "uint256", "bytes32", "bytes32"],
          [electionId, 0, voter1Hash, salt]
        )
      );
      const tx = await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter1Hash, salt);
      const r = await tx.wait();
      const event = r.logs.find((l) => l.fragment?.name === "VoteCastPrivate");
      expect(event.args[1]).to.equal(expected);
    });

    it("9.3 nullifier hash is opaque â€” two voters with same org get different nullifiers", async function () {
      const h1 = makeNullifier("org1", "alice@test.com");
      const h2 = makeNullifier("org1", "bob@test.com");
      expect(h1).to.not.equal(h2);
    });

    it("9.4 voteChoice mapping does not directly expose candidateId without offset", async function () {
      const salt = makeSalt();
      await proxy.connect(relay).castVoteRelayedV3(electionId, 0, voter1Hash, salt);
      // voteChoice stores candidateId + 1 (so 0 means "not voted")
      const choice = await proxy.voteChoice(voter1Hash, electionId);
      expect(choice).to.equal(1n); // 0 + 1 = 1 (not 0, to distinguish from "not voted")
    });
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SECTION 10: 2-of-3 Guardian Multi-sig Upgrade
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  describe("10 Â· Guardian Multi-sig Upgrade", function () {
    let VotingV3Factory, newImpl;

    beforeEach(async function () {
      VotingV3Factory = await hre.ethers.getContractFactory("VotingV3", deployer);
      const implDeploy = await VotingV3Factory.deploy();
      await implDeploy.waitForDeployment();
      newImpl = await implDeploy.getAddress();
    });

    it("10.1 guardian can propose an upgrade", async function () {
      await expect(
        proxy.connect(guardian1).proposeUpgrade(newImpl)
      ).to.emit(proxy, "UpgradeProposed");
    });

    it("10.2 proposal starts at 0 approvals", async function () {
      const tx = await proxy.connect(guardian1).proposeUpgrade(newImpl);
      const r = await tx.wait();
      const pid = r.logs.find((l) => l.fragment?.name === "UpgradeProposed").args[0];
      const [, approvals, executed] = await proxy.getUpgradeProposal(pid);
      expect(approvals).to.equal(0n);
      expect(executed).to.be.false;
    });

    it("10.3 guardian can approve a proposal", async function () {
      const tx = await proxy.connect(guardian1).proposeUpgrade(newImpl);
      const r = await tx.wait();
      const pid = r.logs.find((l) => l.fragment?.name === "UpgradeProposed").args[0];
      await expect(
        proxy.connect(guardian1).approveUpgrade(pid)
      ).to.emit(proxy, "UpgradeApproved");
    });

    it("10.4 same guardian cannot approve twice", async function () {
      const tx = await proxy.connect(guardian1).proposeUpgrade(newImpl);
      const r = await tx.wait();
      const pid = r.logs.find((l) => l.fragment?.name === "UpgradeProposed").args[0];
      await proxy.connect(guardian1).approveUpgrade(pid);
      await expect(
        proxy.connect(guardian1).approveUpgrade(pid)
      ).to.be.revertedWith("VotingV1: already approved");
    });

    it("10.5 upgrade requires 2-of-3 approvals before execute", async function () {
      const tx = await proxy.connect(guardian1).proposeUpgrade(newImpl);
      const r = await tx.wait();
      const pid = r.logs.find((l) => l.fragment?.name === "UpgradeProposed").args[0];
      await proxy.connect(guardian1).approveUpgrade(pid);
      // Only 1 approval â€” execute should fail
      await expect(
        proxy.connect(guardian1).executeUpgrade(pid)
      ).to.be.revertedWith("VotingV1: insufficient approvals");
    });

    it("10.6 upgrade succeeds after 2-of-3 approvals", async function () {
      const tx = await proxy.connect(guardian1).proposeUpgrade(newImpl);
      const r = await tx.wait();
      const pid = r.logs.find((l) => l.fragment?.name === "UpgradeProposed").args[0];
      await proxy.connect(guardian1).approveUpgrade(pid);
      await proxy.connect(guardian2).approveUpgrade(pid);
      await expect(
        proxy.connect(guardian1).executeUpgrade(pid)
      ).to.emit(proxy, "UpgradeExecuted");
    });

    it("10.7 non-guardian cannot propose upgrade", async function () {
      await expect(
        proxy.connect(stranger).proposeUpgrade(newImpl)
      ).to.be.revertedWith("VotingV1: caller is not a guardian");
    });

    it("10.8 cannot execute already-executed upgrade", async function () {
      const tx = await proxy.connect(guardian1).proposeUpgrade(newImpl);
      const r = await tx.wait();
      const pid = r.logs.find((l) => l.fragment?.name === "UpgradeProposed").args[0];
      await proxy.connect(guardian1).approveUpgrade(pid);
      await proxy.connect(guardian2).approveUpgrade(pid);
      await proxy.connect(guardian1).executeUpgrade(pid);
      await expect(
        proxy.connect(guardian2).executeUpgrade(pid)
      ).to.be.revertedWith("VotingV1: already executed");
    });

    it("10.9 data is preserved after upgrade (UUPS storage safety)", async function () {
      // Create election BEFORE upgrade
      const now = await getBlockTime();
      const createTx = await proxy.connect(relay).createElection(
        "Pre-upgrade", "d", "", now + 5, now + 7200
      );
      const createR = await createTx.wait();
      const preUpgradeElectionId = createR.logs.find(
        (l) => l.fragment?.name === "ElectionCreated"
      ).args[0];

      // Do upgrade
      const upgradeTx = await proxy.connect(guardian1).proposeUpgrade(newImpl);
      const upgradeR = await upgradeTx.wait();
      const pid = upgradeR.logs.find((l) => l.fragment?.name === "UpgradeProposed").args[0];
      await proxy.connect(guardian1).approveUpgrade(pid);
      await proxy.connect(guardian2).approveUpgrade(pid);
      await proxy.connect(guardian1).executeUpgrade(pid);

      // Election from BEFORE upgrade should still exist
      const election = await proxy.getElection(preUpgradeElectionId);
      expect(election.title).to.equal("Pre-upgrade");
      expect(election.exists).to.be.true;
    });
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SECTION 11: Edge Cases & Security Boundaries
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  describe("11 Â· Edge Cases & Security Boundaries", function () {
    it("11.1 cannot interact with non-existent election", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("fake-id"));
      await expect(proxy.getElection(fakeId)).to.be.revertedWith("VotingV1: election does not exist");
    });

    it("11.2 relay wallet cannot be zero address on init", async function () {
      const VotingV3 = await hre.ethers.getContractFactory("VotingV3", deployer);
      await expect(
        hre.upgrades.deployProxy(
          VotingV3,
          [ethers.ZeroAddress, guardian1.address, guardian2.address, guardian3.address],
          { kind: "uups", initializer: "initialize" }
        )
      ).to.be.revertedWith("VotingV1: relay cannot be zero");
    });

    it("11.3 multiple elections run independently", async function () {
      const now = await getBlockTime();
      const tx1 = await proxy.connect(relay).createElection("E1", "d", "", now + 5, now + 7200);
      const r1 = await tx1.wait();
      const eid1 = r1.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];
      await fastForward(2);
      const tx2 = await proxy.connect(relay).createElection("E2", "d", "", now + 20, now + 7220);
      const r2 = await tx2.wait();
      const eid2 = r2.logs.find((l) => l.fragment?.name === "ElectionCreated").args[0];

      await proxy.connect(relay).addCandidate(eid1, "A", "P", "a", "", "");
      await proxy.connect(relay).addCandidate(eid2, "B", "Q", "b", "", "");

      const voter = makeNullifier("org", "shared-voter");
      await proxy.connect(relay).registerVoterByRelay(eid1, voter);
      await proxy.connect(relay).registerVoterByRelay(eid2, voter);
      await proxy.connect(relay).transitionPhase(eid1, 1);
      await proxy.connect(relay).transitionPhase(eid2, 1);

      await proxy.connect(relay).castVoteRelayedV3(eid1, 0, voter, makeSalt());
      await proxy.connect(relay).castVoteRelayedV3(eid2, 0, voter, makeSalt());

      const c1 = await proxy.candidates(eid1, 0);
      const c2 = await proxy.candidates(eid2, 0);
      expect(c1.voteCount).to.equal(1n);
      expect(c2.voteCount).to.equal(1n);
    });

    it("11.4 version() returns V3 string from proxy", async function () {
      expect(await proxy.version()).to.equal("3.0.0");
    });

    it("11.5 getElectionCount returns correct count", async function () {
      expect(await proxy.getElectionCount()).to.equal(0n);
      const now = await getBlockTime();
      await proxy.connect(relay).createElection("E", "d", "", now + 5, now + 100);
      expect(await proxy.getElectionCount()).to.equal(1n);
    });
  });
});

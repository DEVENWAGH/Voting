// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title VotingV3
 * @notice Standalone UUPS-upgradeable e-voting contract.
 *         Self-contained — does NOT inherit from VotingV1 or VotingV2.
 *
 *   FEATURES:
 *     - No voter wallets required (relay/gas-station model)
 *     - 3-guardian, 2-of-3 multi-sig controls upgrades
 *     - Voter identity = nullifier hash (keccak256 of orgId+memberId+secret)
 *     - No PII stored on-chain
 *     - Election IDs are unique keccak256 hashes (no sequential counter)
 *     - Voter registration is PER-ELECTION
 *
 *   V3 PRIVACY ENHANCEMENTS:
 *     - VoteCast event replaced with VoteCastPrivate — no candidateId emitted
 *     - RE-VOTING: Voters can change their vote during the voting phase
 *       (coercion resistance — only the LATEST vote counts)
 *     - ballotSalt parameter blinds the on-chain event from observers
 *
 *   STORAGE LAYOUT (must never be reordered for safe UUPS upgrades):
 *     Slot 0  : _initialized / _initializing     (Initializable)
 *     Slots 1+ : UUPSUpgradeable internals
 *     ...then VotingV1-compatible layout...
 *     Slot N  : relayWallet
 *     Slot N+1: guardians[3]
 *     Slot N+2: proposalCount
 *     Slot N+3: elections mapping
 *     Slot N+4: candidates mapping
 *     Slot N+5: electionCandidateCount mapping
 *     Slot N+6: electionIds array
 *     Slot N+7: isRegisteredVoter mapping
 *     Slot N+8: hasVoted mapping
 *     Slot N+9: upgradeProposals mapping
 *     Slot N+10: electionCount (legacy compat)
 *     --- V2 storage (placeholder to preserve layout) ---
 *     Slot N+11: __v2_upgradeGreeting_placeholder (string)
 *     --- V3 storage ---
 *     Slot N+12: voteChoice mapping
 *     Slot N+13: voteRevisionCount mapping
 */
contract VotingV3 is Initializable, UUPSUpgradeable {
    // ─── Enums ────────────────────────────────────────────────────────────────
    enum ElectionPhase { Registration, Voting, Completed }

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct Election {
        bytes32 id;
        string  title;
        string  description;
        string  bannerUrl;
        uint256 startTime;
        uint256 endTime;
        ElectionPhase phase;
        bool    exists;
    }

    struct Candidate {
        uint256 id;
        string  name;
        string  party;
        string  symbol;
        string  manifesto;
        string  photoUrl;
        uint256 voteCount;
    }

    struct UpgradeProposal {
        address newImplementation;
        uint256 approvalCount;
        bool    executed;
        mapping(address => bool) approvedBy;
    }

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 public constant GUARDIAN_COUNT     = 3;
    uint256 public constant APPROVAL_THRESHOLD = 2; // 2-of-3

    // ─── V1-Compatible Storage Layout (slots must match deployment order) ─────
    address public relayWallet;

    address[3] public guardians;
    uint256    public proposalCount;

    mapping(bytes32 => Election)                              public elections;
    mapping(bytes32 => mapping(uint256 => Candidate))         public candidates;
    mapping(bytes32 => uint256)                               public electionCandidateCount;

    bytes32[] public electionIds;

    mapping(bytes32 => mapping(bytes32 => bool)) public isRegisteredVoter;
    mapping(bytes32 => mapping(bytes32 => bool)) public hasVoted;

    mapping(uint256 => UpgradeProposal) public upgradeProposals;

    uint256 public electionCount; // legacy — kept for storage compat

    // ─── V2 Storage Placeholder ───────────────────────────────────────────────
    // VotingV2 added `upgradeGreeting` at this slot. We preserve the slot even
    // though we don't use it, so storage is compatible with existing proxies.
    string private __v2_upgradeGreeting_placeholder;

    // ─── V3 Storage ───────────────────────────────────────────────────────────

    /**
     * @dev Voter's current candidate choice per election.
     *      Value = candidateId + 1 (0 means "not voted yet").
     *      Needed to decrement the old candidate's count on re-vote.
     *
     * PRIVACY: maps nullifierHash → candidateId, not wallet → candidateId.
     */
    mapping(bytes32 => mapping(bytes32 => uint256)) public voteChoice;
    // voteChoice[voterNullifier][electionId] = candidateId + 1

    /**
     * @dev Tracks how many times each voter has voted in an election.
     */
    mapping(bytes32 => mapping(bytes32 => uint256)) public voteRevisionCount;
    // voteRevisionCount[voterNullifier][electionId] = number of times voted

    // ─── Events ───────────────────────────────────────────────────────────────
    event ElectionCreated(bytes32 indexed electionId, string title, uint256 startTime, uint256 endTime);
    event CandidateAdded(bytes32 indexed electionId, uint256 indexed candidateId, string name);
    event VoterRegistered(bytes32 indexed electionId, bytes32 indexed nullifierHash);
    event VoteCast(bytes32 indexed electionId, uint256 indexed candidateId); // V1 compat — no voter identity
    event PhaseChanged(bytes32 indexed electionId, ElectionPhase newPhase);
    event UpgradeProposed(uint256 indexed proposalId, address newImplementation, address proposedBy);
    event UpgradeApproved(uint256 indexed proposalId, address approvedBy, uint256 approvalCount);
    event UpgradeExecuted(uint256 indexed proposalId, address newImplementation);

    /**
     * @notice V3 privacy-preserving vote event — candidateId NOT emitted.
     * @param electionId  The election this vote belongs to
     * @param ballotHash  keccak256(electionId, candidateId, voterNullifier, salt)
     * @param isRevote    True if the voter changed their previous choice
     */
    event VoteCastPrivate(
        bytes32 indexed electionId,
        bytes32 ballotHash,
        bool    isRevote
    );

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyRelay() {
        require(msg.sender == relayWallet, "VotingV3: caller is not relay");
        _;
    }

    modifier onlyGuardian() {
        require(_isGuardian(msg.sender), "VotingV3: caller is not a guardian");
        _;
    }

    modifier electionExists(bytes32 _id) {
        require(elections[_id].exists, "VotingV3: election does not exist");
        _;
    }

    // ─── Constructor / Initializer ────────────────────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        address _relayWallet,
        address _guardian1,
        address _guardian2,
        address _guardian3
    ) public initializer {
        require(_relayWallet != address(0), "VotingV3: relay cannot be zero");
        require(_guardian1   != address(0), "VotingV3: guardian1 cannot be zero");
        require(_guardian2   != address(0), "VotingV3: guardian2 cannot be zero");
        require(_guardian3   != address(0), "VotingV3: guardian3 cannot be zero");
        require(
            _guardian1 != _guardian2 &&
            _guardian2 != _guardian3 &&
            _guardian1 != _guardian3,
            "VotingV3: guardians must be unique"
        );

        relayWallet  = _relayWallet;
        guardians[0] = _guardian1;
        guardians[1] = _guardian2;
        guardians[2] = _guardian3;
        electionCount  = 0;
        proposalCount  = 0;
    }

    // ─── Version ──────────────────────────────────────────────────────────────
    function version() external pure returns (string memory) { return "3.0.0"; }

    // ─── UUPS Upgrade Gate (2-of-3 guardians must approve) ───────────────────
    function _authorizeUpgrade(address newImplementation) internal override {
        bool found = false;
        for (uint256 i = 0; i < proposalCount; i++) {
            UpgradeProposal storage p = upgradeProposals[i];
            if (
                p.newImplementation == newImplementation &&
                !p.executed &&
                p.approvalCount >= APPROVAL_THRESHOLD
            ) {
                p.executed = true;
                found = true;
                emit UpgradeExecuted(i, newImplementation);
                break;
            }
        }
        require(found, "VotingV3: upgrade not approved by guardians");
    }

    // ─── Guardian: Propose / Approve / Execute Upgrade ────────────────────────
    function proposeUpgrade(address _newImplementation) external onlyGuardian returns (uint256) {
        require(_newImplementation != address(0), "VotingV3: zero address");
        uint256 pid = proposalCount++;
        UpgradeProposal storage p = upgradeProposals[pid];
        p.newImplementation = _newImplementation;
        p.approvalCount = 0;
        p.executed = false;
        emit UpgradeProposed(pid, _newImplementation, msg.sender);
        return pid;
    }

    function approveUpgrade(uint256 _proposalId) external onlyGuardian {
        UpgradeProposal storage p = upgradeProposals[_proposalId];
        require(p.newImplementation != address(0), "VotingV3: proposal does not exist");
        require(!p.executed,              "VotingV3: already executed");
        require(!p.approvedBy[msg.sender],"VotingV3: already approved");

        p.approvedBy[msg.sender] = true;
        p.approvalCount++;
        emit UpgradeApproved(_proposalId, msg.sender, p.approvalCount);
    }

    function executeUpgrade(uint256 _proposalId) external onlyGuardian {
        UpgradeProposal storage p = upgradeProposals[_proposalId];
        require(!p.executed,                          "VotingV3: already executed");
        require(p.approvalCount >= APPROVAL_THRESHOLD,"VotingV3: insufficient approvals");
        upgradeToAndCall(p.newImplementation, "");
    }

    // ─── Election Management (relay only) ─────────────────────────────────────
    function createElection(
        string memory _title,
        string memory _description,
        string memory _bannerUrl,
        uint256 _startTime,
        uint256 _endTime
    ) external onlyRelay returns (bytes32) {
        require(bytes(_title).length > 0,       "VotingV3: title empty");
        require(bytes(_description).length > 0, "VotingV3: description empty");
        require(_startTime > block.timestamp,   "VotingV3: start in past");
        require(_endTime > _startTime,          "VotingV3: end before start");

        bytes32 id = keccak256(abi.encodePacked(
            _title,
            _startTime,
            _endTime,
            block.timestamp,
            msg.sender,
            electionIds.length
        ));

        require(!elections[id].exists, "VotingV3: election ID collision");

        elections[id] = Election({
            id: id,
            title: _title,
            description: _description,
            bannerUrl: _bannerUrl,
            startTime: _startTime,
            endTime: _endTime,
            phase: ElectionPhase.Registration,
            exists: true
        });

        electionIds.push(id);
        electionCount = electionIds.length;

        emit ElectionCreated(id, _title, _startTime, _endTime);
        return id;
    }

    function addCandidate(
        bytes32 _electionId,
        string memory _name,
        string memory _party,
        string memory _symbol,
        string memory _manifesto,
        string memory _photoUrl
    ) external onlyRelay electionExists(_electionId) {
        require(
            elections[_electionId].phase == ElectionPhase.Registration,
            "VotingV3: not registration phase"
        );
        require(bytes(_name).length > 0,   "VotingV3: name empty");
        require(bytes(_party).length > 0,  "VotingV3: party empty");
        require(bytes(_symbol).length > 0, "VotingV3: symbol empty");

        uint256 cid = electionCandidateCount[_electionId]++;
        candidates[_electionId][cid] = Candidate({
            id: cid,
            name: _name,
            party: _party,
            symbol: _symbol,
            manifesto: _manifesto,
            photoUrl: _photoUrl,
            voteCount: 0
        });
        emit CandidateAdded(_electionId, cid, _name);
    }

    function transitionPhase(
        bytes32 _electionId,
        ElectionPhase _newPhase
    ) external onlyRelay electionExists(_electionId) {
        Election storage e = elections[_electionId];
        require(e.phase != ElectionPhase.Completed, "VotingV3: already completed");
        if (e.phase == ElectionPhase.Registration) {
            require(
                _newPhase == ElectionPhase.Voting || _newPhase == ElectionPhase.Completed,
                "VotingV3: invalid transition"
            );
        } else {
            require(_newPhase == ElectionPhase.Completed, "VotingV3: invalid transition");
        }
        if (_newPhase == ElectionPhase.Voting) {
            require(electionCandidateCount[_electionId] > 0, "VotingV3: no candidates");
        }
        e.phase = _newPhase;
        emit PhaseChanged(_electionId, _newPhase);
    }

    // ─── Voter Registration (relay only, per-election) ────────────────────────
    /**
     * @notice Register a voter for a specific election using their nullifier hash.
     *         nullifierHash = keccak256(abi.encodePacked(orgId, email, SERVER_IDENTITY_SECRET))
     */
    function registerVoterByRelay(
        bytes32 _electionId,
        bytes32 _nullifierHash
    ) external onlyRelay electionExists(_electionId) {
        require(_nullifierHash != bytes32(0),                    "VotingV3: zero hash");
        require(!isRegisteredVoter[_electionId][_nullifierHash], "VotingV3: already registered");
        isRegisteredVoter[_electionId][_nullifierHash] = true;
        emit VoterRegistered(_electionId, _nullifierHash);
    }

    // ─── V3 Vote Casting: Privacy + Re-Voting ─────────────────────────────────
    /**
     * @notice Cast (or re-cast) a vote with privacy-preserving event.
     *
     * @param _electionId      Election identifier
     * @param _candidateId     Candidate to vote for
     * @param _voterNullifier  Voter's nullifier hash
     * @param _ballotSalt      Random salt for ballot blinding (hides candidateId in event)
     *
     * RE-VOTING:
     *   - First vote: registers choice, increments candidate voteCount.
     *   - Re-vote:    decrements OLD candidate, increments NEW candidate.
     *   - Only the latest vote is reflected in the tally.
     *
     * COERCION RESISTANCE:
     *   If someone forces a voter to select Candidate A, the voter can later
     *   return privately and re-vote for Candidate B. The coercer cannot
     *   verify on-chain which candidate was chosen (VoteCastPrivate emits no candidateId).
     */
    function castVoteRelayedV3(
        bytes32 _electionId,
        uint256 _candidateId,
        bytes32 _voterNullifier,
        bytes32 _ballotSalt
    ) external onlyRelay electionExists(_electionId) {
        require(isRegisteredVoter[_electionId][_voterNullifier], "VotingV3: voter not registered");
        require(
            elections[_electionId].phase == ElectionPhase.Voting,
            "VotingV3: not voting phase"
        );
        require(
            _candidateId < electionCandidateCount[_electionId],
            "VotingV3: invalid candidate"
        );

        uint256 previousChoicePlusOne = voteChoice[_voterNullifier][_electionId];
        bool isRevote = previousChoicePlusOne > 0;

        if (isRevote) {
            uint256 oldCandidateId = previousChoicePlusOne - 1;
            if (oldCandidateId != _candidateId) {
                require(
                    candidates[_electionId][oldCandidateId].voteCount > 0,
                    "VotingV3: underflow guard"
                );
                candidates[_electionId][oldCandidateId].voteCount--;
                candidates[_electionId][_candidateId].voteCount++;
            }
            voteRevisionCount[_voterNullifier][_electionId]++;
        } else {
            candidates[_electionId][_candidateId].voteCount++;
            hasVoted[_voterNullifier][_electionId] = true;
        }

        voteChoice[_voterNullifier][_electionId] = _candidateId + 1;

        bytes32 ballotHash = keccak256(
            abi.encodePacked(_electionId, _candidateId, _voterNullifier, _ballotSalt)
        );
        emit VoteCastPrivate(_electionId, ballotHash, isRevote);
    }

    // ─── View Functions ───────────────────────────────────────────────────────
    function getElection(bytes32 _id) external view electionExists(_id) returns (Election memory) {
        return elections[_id];
    }

    function getElectionCount() external view returns (uint256) {
        return electionIds.length;
    }

    function getElectionIdAtIndex(uint256 _index) external view returns (bytes32) {
        require(_index < electionIds.length, "VotingV3: index out of bounds");
        return electionIds[_index];
    }

    function getAllElections() external view returns (Election[] memory) {
        uint256 count = electionIds.length;
        Election[] memory all = new Election[](count);
        for (uint256 i = 0; i < count; i++) {
            all[i] = elections[electionIds[i]];
        }
        return all;
    }

    function getAllElectionIds() external view returns (bytes32[] memory) {
        return electionIds;
    }

    function getCandidates(bytes32 _electionId) external view electionExists(_electionId) returns (Candidate[] memory) {
        uint256 count = electionCandidateCount[_electionId];
        Candidate[] memory list = new Candidate[](count);
        for (uint256 i = 0; i < count; i++) list[i] = candidates[_electionId][i];
        return list;
    }

    function getElectionResults(bytes32 _electionId) external view electionExists(_electionId) returns (Candidate[] memory) {
        require(elections[_electionId].phase == ElectionPhase.Completed, "VotingV3: not completed");
        return this.getCandidates(_electionId);
    }

    function getWinner(bytes32 _electionId) external view electionExists(_electionId) returns (Candidate memory) {
        require(elections[_electionId].phase == ElectionPhase.Completed, "VotingV3: not completed");
        uint256 count = electionCandidateCount[_electionId];
        require(count > 0, "VotingV3: no candidates");

        uint256 winId = 0;
        uint256 maxVotes = candidates[_electionId][0].voteCount;
        for (uint256 i = 1; i < count; i++) {
            if (candidates[_electionId][i].voteCount > maxVotes) {
                maxVotes = candidates[_electionId][i].voteCount;
                winId = i;
            }
        }
        return candidates[_electionId][winId];
    }

    function hasVoterVoted(bytes32 _nullifierHash, bytes32 _electionId) external view returns (bool) {
        return hasVoted[_nullifierHash][_electionId];
    }

    function isVoterRegisteredForElection(bytes32 _electionId, bytes32 _nullifierHash) external view returns (bool) {
        return isRegisteredVoter[_electionId][_nullifierHash];
    }

    function getGuardians() external view returns (address[3] memory) {
        return guardians;
    }

    function getUpgradeProposal(uint256 _pid) external view returns (
        address impl, uint256 approvals, bool executed
    ) {
        UpgradeProposal storage p = upgradeProposals[_pid];
        return (p.newImplementation, p.approvalCount, p.executed);
    }

    function hasGuardianApproved(uint256 _pid, address _guardian) external view returns (bool) {
        return upgradeProposals[_pid].approvedBy[_guardian];
    }

    /**
     * @notice V3: Check if a voter has voted and how many revisions they made.
     */
    function getVoteStatus(
        bytes32 _voterNullifier,
        bytes32 _electionId
    ) external view returns (bool voted, uint256 revisions) {
        uint256 choice = voteChoice[_voterNullifier][_electionId];
        return (choice > 0, voteRevisionCount[_voterNullifier][_electionId]);
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────
    function _isGuardian(address _addr) internal view returns (bool) {
        for (uint256 i = 0; i < GUARDIAN_COUNT; i++) {
            if (guardians[i] == _addr) return true;
        }
        return false;
    }
}

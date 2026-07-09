// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title VotingV1
 * @notice Upgradeable e-voting contract for independent organizations.
 *         - No voter wallets required (relay/gas-station model)
 *         - 3-guardian, 2-of-3 multi-sig controls upgrades
 *         - Voter identity = nullifier hash (keccak256 of orgId+memberId+secret)
 *         - No PII stored on-chain
 *         - Election IDs are unique keccak256 hashes (no sequential counter)
 *         - Voter registration is PER-ELECTION (same voter in multiple elections)
 */
contract VotingV1 is Initializable, UUPSUpgradeable {
    // ─── Enums ────────────────────────────────────────────────────────────────
    enum ElectionPhase { Registration, Voting, Completed }

    // ─── Structs ──────────────────────────────────────────────────────────────
    struct Election {
        bytes32 id;             // unique keccak256 hash
        string  title;
        string  description;
        string  bannerUrl;     // ImageKit CDN URL
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
        string  photoUrl;      // ImageKit CDN URL
        uint256 voteCount;
    }

    struct UpgradeProposal {
        address newImplementation;
        uint256 approvalCount;
        bool    executed;
        mapping(address => bool) approvedBy;
    }

    // ─── Constants ────────────────────────────────────────────────────────────
    uint256 public constant GUARDIAN_COUNT    = 3;
    uint256 public constant APPROVAL_THRESHOLD = 2; // 2-of-3

    // ─── State ────────────────────────────────────────────────────────────────
    address public relayWallet;             // platform gas-station wallet

    address[3] public guardians;            // fixed 3-guardian set
    uint256 public proposalCount;

    // Elections stored by unique bytes32 ID (not sequential index)
    mapping(bytes32 => Election)                              public elections;
    mapping(bytes32 => mapping(uint256 => Candidate))         public candidates;
    mapping(bytes32 => uint256)                               public electionCandidateCount;

    // Enumerable list of all election IDs (for getAllElections)
    bytes32[] public electionIds;

    // Per-election voter registration: electionId => nullifierHash => is registered
    mapping(bytes32 => mapping(bytes32 => bool))              public isRegisteredVoter;

    // Per-election vote tracking: nullifierHash => electionId => has voted
    mapping(bytes32 => mapping(bytes32 => bool))              public hasVoted;

    mapping(uint256 => UpgradeProposal)                       public upgradeProposals;

    // Legacy field kept for storage layout compatibility (unused)
    uint256 public electionCount;

    // ─── Events ───────────────────────────────────────────────────────────────
    event ElectionCreated(bytes32 indexed electionId, string title, uint256 startTime, uint256 endTime);
    event CandidateAdded(bytes32 indexed electionId, uint256 indexed candidateId, string name);
    event VoterRegistered(bytes32 indexed electionId, bytes32 indexed nullifierHash);
    event VoteCast(bytes32 indexed electionId, uint256 indexed candidateId); // no voter identity
    event PhaseChanged(bytes32 indexed electionId, ElectionPhase newPhase);
    event UpgradeProposed(uint256 indexed proposalId, address newImplementation, address proposedBy);
    event UpgradeApproved(uint256 indexed proposalId, address approvedBy, uint256 approvalCount);
    event UpgradeExecuted(uint256 indexed proposalId, address newImplementation);

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyRelay() {
        require(msg.sender == relayWallet, "VotingV1: caller is not relay");
        _;
    }

    modifier onlyGuardian() {
        require(_isGuardian(msg.sender), "VotingV1: caller is not a guardian");
        _;
    }

    modifier electionExists(bytes32 _id) {
        require(elections[_id].exists, "VotingV1: election does not exist");
        _;
    }

    // ─── Initializer (replaces constructor for proxy) ─────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        address _relayWallet,
        address _guardian1,
        address _guardian2,
        address _guardian3
    ) public initializer {
        // OZ v5: UUPSUpgradeable has no __UUPSUpgradeable_init to call

        require(_relayWallet != address(0), "VotingV1: relay cannot be zero");
        require(_guardian1   != address(0), "VotingV1: guardian1 cannot be zero");
        require(_guardian2   != address(0), "VotingV1: guardian2 cannot be zero");
        require(_guardian3   != address(0), "VotingV1: guardian3 cannot be zero");
        require(
            _guardian1 != _guardian2 &&
            _guardian2 != _guardian3 &&
            _guardian1 != _guardian3,
            "VotingV1: guardians must be unique"
        );

        relayWallet = _relayWallet;
        guardians[0] = _guardian1;
        guardians[1] = _guardian2;
        guardians[2] = _guardian3;
        electionCount = 0;
        proposalCount = 0;
    }

    // ─── UUPS Upgrade Gate (2-of-3 guardians must approve) ───────────────────
    function _authorizeUpgrade(address newImplementation) internal override {
        // Find the active proposal for this implementation
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
        require(found, "VotingV1: upgrade not approved by guardians");
    }

    // ─── Guardian: Propose Upgrade ────────────────────────────────────────────
    function proposeUpgrade(address _newImplementation) external onlyGuardian returns (uint256) {
        require(_newImplementation != address(0), "VotingV1: zero address");
        uint256 pid = proposalCount++;
        UpgradeProposal storage p = upgradeProposals[pid];
        p.newImplementation = _newImplementation;
        p.approvalCount = 0;
        p.executed = false;
        emit UpgradeProposed(pid, _newImplementation, msg.sender);
        return pid;
    }

    /// @notice A guardian approves an upgrade proposal.
    function approveUpgrade(uint256 _proposalId) external onlyGuardian {
        UpgradeProposal storage p = upgradeProposals[_proposalId];
        require(p.newImplementation != address(0), "VotingV1: proposal does not exist");
        require(!p.executed, "VotingV1: already executed");
        require(!p.approvedBy[msg.sender], "VotingV1: already approved");

        p.approvedBy[msg.sender] = true;
        p.approvalCount++;
        emit UpgradeApproved(_proposalId, msg.sender, p.approvalCount);
    }

    /// @notice Execute the upgrade once threshold is reached (calls upgradeToAndCall internally)
    function executeUpgrade(uint256 _proposalId) external onlyGuardian {
        UpgradeProposal storage p = upgradeProposals[_proposalId];
        require(!p.executed, "VotingV1: already executed");
        require(p.approvalCount >= APPROVAL_THRESHOLD, "VotingV1: insufficient approvals");
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
        require(bytes(_title).length > 0,       "VotingV1: title empty");
        require(bytes(_description).length > 0, "VotingV1: description empty");
        require(_startTime > block.timestamp,   "VotingV1: start in past");
        require(_endTime > _startTime,          "VotingV1: end before start");

        // Generate unique election ID — never collides even across chain restarts
        bytes32 id = keccak256(abi.encodePacked(
            _title,
            _startTime,
            _endTime,
            block.timestamp,
            msg.sender,
            electionIds.length
        ));

        require(!elections[id].exists, "VotingV1: election ID collision");

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
        electionCount = electionIds.length; // keep legacy field in sync

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
            "VotingV1: not registration phase"
        );
        require(bytes(_name).length > 0,   "VotingV1: name empty");
        require(bytes(_party).length > 0,  "VotingV1: party empty");
        require(bytes(_symbol).length > 0, "VotingV1: symbol empty");

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
        require(e.phase != ElectionPhase.Completed, "VotingV1: already completed");
        if (e.phase == ElectionPhase.Registration) {
            require(
                _newPhase == ElectionPhase.Voting || _newPhase == ElectionPhase.Completed,
                "VotingV1: invalid transition"
            );
        } else {
            require(_newPhase == ElectionPhase.Completed, "VotingV1: invalid transition");
        }
        if (_newPhase == ElectionPhase.Voting) {
            require(electionCandidateCount[_electionId] > 0, "VotingV1: no candidates");
        }
        e.phase = _newPhase;
        emit PhaseChanged(_electionId, _newPhase);
    }

    // ─── Voter Registration (relay only, PER-ELECTION) ───────────────────────
    /**
     * @notice Register a voter for a specific election using their nullifier hash.
     *         nullifierHash = keccak256(abi.encodePacked(orgId, email, SERVER_IDENTITY_SECRET))
     *         The same voter can be registered in multiple elections independently.
     */
    function registerVoterByRelay(
        bytes32 _electionId,
        bytes32 _nullifierHash
    ) external onlyRelay electionExists(_electionId) {
        require(_nullifierHash != bytes32(0),                             "VotingV1: zero hash");
        require(!isRegisteredVoter[_electionId][_nullifierHash],          "VotingV1: already registered");
        isRegisteredVoter[_electionId][_nullifierHash] = true;
        emit VoterRegistered(_electionId, _nullifierHash);
    }

    // ─── Gasless Vote Casting (relay only) ────────────────────────────────────
    /**
     * @notice Cast a vote on behalf of a verified voter.
     *         Voter proves identity via Email OTP → server verifies → relay submits this tx.
     *         voterNullifier links to registered voter without revealing identity.
     */
    function castVoteRelayed(
        bytes32 _electionId,
        uint256 _candidateId,
        bytes32 _voterNullifier
    ) external onlyRelay electionExists(_electionId) {
        require(isRegisteredVoter[_electionId][_voterNullifier],     "VotingV1: voter not registered");
        require(!hasVoted[_voterNullifier][_electionId],             "VotingV1: already voted");
        require(
            elections[_electionId].phase == ElectionPhase.Voting,
            "VotingV1: not voting phase"
        );
        require(
            _candidateId < electionCandidateCount[_electionId],
            "VotingV1: invalid candidate"
        );

        candidates[_electionId][_candidateId].voteCount++;
        hasVoted[_voterNullifier][_electionId] = true;
        emit VoteCast(_electionId, _candidateId); // no voter address emitted
    }

    // ─── View Functions ───────────────────────────────────────────────────────
    function getElection(bytes32 _id) external view electionExists(_id) returns (Election memory) {
        return elections[_id];
    }

    function getElectionCount() external view returns (uint256) {
        return electionIds.length;
    }

    function getElectionIdAtIndex(uint256 _index) external view returns (bytes32) {
        require(_index < electionIds.length, "VotingV1: index out of bounds");
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
        require(elections[_electionId].phase == ElectionPhase.Completed, "VotingV1: not completed");
        return this.getCandidates(_electionId);
    }

    function getWinner(bytes32 _electionId) external view electionExists(_electionId) returns (Candidate memory) {
        require(elections[_electionId].phase == ElectionPhase.Completed, "VotingV1: not completed");
        uint256 count = electionCandidateCount[_electionId];
        require(count > 0, "VotingV1: no candidates");

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

    // ─── Internal Helpers ─────────────────────────────────────────────────────
    function _isGuardian(address _addr) internal view returns (bool) {
        for (uint256 i = 0; i < GUARDIAN_COUNT; i++) {
            if (guardians[i] == _addr) return true;
        }
        return false;
    }

    /// @dev Required by UUPSUpgradeable
    function version() external pure virtual returns (string memory) { return "1.0.0"; }
}

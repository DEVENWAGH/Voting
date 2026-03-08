// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EnhancedVoting {
    // Enums
    enum ElectionPhase {
        Registration,
        Voting,
        Completed
    }

    // Structs
    struct Election {
        uint256 id;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        ElectionPhase phase;
        bool exists;
    }

    struct Candidate {
        uint256 id;
        string name;
        string party;
        string symbol;
        string manifesto;
        uint256 voteCount;
    }

    struct Voter {
        address walletAddress;
        bytes32 aadhaarHash;
        bool isRegistered;
        uint256 registrationTime;
    }

    // State variables
    address public electionCommission;
    uint256 public electionCount;

    // Mappings
    mapping(uint256 => Election) public elections;
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;
    mapping(bytes32 => address) public aadhaarToWallet;
    mapping(address => bytes32) public walletToAadhaar;
    mapping(address => Voter) public voters;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => uint256) public electionCandidateCount;

    // Events
    event ElectionCreated(
        uint256 indexed electionId,
        string title,
        uint256 startTime,
        uint256 endTime
    );

    event CandidateAdded(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        string name,
        string party
    );

    event VoterRegistered(
        address indexed voterAddress,
        bytes32 aadhaarHash
    );

    event VoteCast(
        uint256 indexed electionId,
        uint256 indexed candidateId
    );

    event PhaseChanged(
        uint256 indexed electionId,
        ElectionPhase newPhase
    );

    // Modifiers
    modifier onlyElectionCommission() {
        require(
            msg.sender == electionCommission,
            "Only Election Commission can perform this action"
        );
        _;
    }

    modifier electionExists(uint256 _electionId) {
        require(elections[_electionId].exists, "Election does not exist");
        _;
    }

    modifier voterRegistered() {
        require(voters[msg.sender].isRegistered, "Voter not registered");
        _;
    }

    // Constructor
    constructor() {
        electionCommission = msg.sender;
        electionCount = 0;
    }

    // Task 2.1: Create Election Function
    function createElection(
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime
    ) external onlyElectionCommission returns (uint256) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(bytes(_description).length > 0, "Description cannot be empty");
        require(_startTime > block.timestamp, "Start time must be in the future");
        require(_endTime > _startTime, "End time must be after start time");

        uint256 electionId = electionCount;

        elections[electionId] = Election({
            id: electionId,
            title: _title,
            description: _description,
            startTime: _startTime,
            endTime: _endTime,
            phase: ElectionPhase.Registration,
            exists: true
        });

        electionCount++;

        emit ElectionCreated(electionId, _title, _startTime, _endTime);

        return electionId;
    }

    // Task 2.2: Add Candidate Function
    function addCandidate(
        uint256 _electionId,
        string memory _name,
        string memory _party,
        string memory _symbol,
        string memory _manifesto
    ) external onlyElectionCommission electionExists(_electionId) {
        require(
            elections[_electionId].phase == ElectionPhase.Registration,
            "Can only add candidates during Registration phase"
        );
        require(bytes(_name).length > 0, "Candidate name cannot be empty");
        require(bytes(_party).length > 0, "Party name cannot be empty");
        require(bytes(_symbol).length > 0, "Party symbol cannot be empty");

        uint256 candidateId = electionCandidateCount[_electionId];

        candidates[_electionId][candidateId] = Candidate({
            id: candidateId,
            name: _name,
            party: _party,
            symbol: _symbol,
            manifesto: _manifesto,
            voteCount: 0
        });

        electionCandidateCount[_electionId]++;

        emit CandidateAdded(_electionId, candidateId, _name, _party);
    }

    // Task 2.3: Transition Election Phase Function
    function transitionElectionPhase(
        uint256 _electionId,
        ElectionPhase _newPhase
    ) external onlyElectionCommission electionExists(_electionId) {
        Election storage election = elections[_electionId];
        ElectionPhase currentPhase = election.phase;

        // Validate phase transitions
        require(
            currentPhase != ElectionPhase.Completed,
            "Cannot transition from Completed phase"
        );

        // Validate valid phase progression
        if (currentPhase == ElectionPhase.Registration) {
            require(
                _newPhase == ElectionPhase.Voting || _newPhase == ElectionPhase.Completed,
                "Can only transition to Voting or Completed from Registration"
            );
        } else if (currentPhase == ElectionPhase.Voting) {
            require(
                _newPhase == ElectionPhase.Completed,
                "Can only transition to Completed from Voting"
            );
        }

        // Additional validation: ensure at least one candidate exists before moving to Voting
        if (_newPhase == ElectionPhase.Voting) {
            require(
                electionCandidateCount[_electionId] > 0,
                "Cannot start voting without candidates"
            );
        }

        // Update the phase
        election.phase = _newPhase;

        emit PhaseChanged(_electionId, _newPhase);
    }

    // Task 2.4: Getter Functions for Election Data

    /**
     * @dev Get election details by ID
     * @param _electionId The ID of the election
     * @return Election struct with all election data
     */
    function getElection(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (Election memory)
    {
        return elections[_electionId];
    }

    /**
     * @dev Get all elections
     * @return Array of all Election structs
     */
    function getAllElections() external view returns (Election[] memory) {
        Election[] memory allElections = new Election[](electionCount);

        for (uint256 i = 0; i < electionCount; i++) {
            allElections[i] = elections[i];
        }

        return allElections;
    }

    /**
     * @dev Get all candidates for a specific election
     * @param _electionId The ID of the election
     * @return Array of Candidate structs for the election
     */
    function getCandidates(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (Candidate[] memory)
    {
        uint256 candidateCount = electionCandidateCount[_electionId];
        Candidate[] memory electionCandidates = new Candidate[](candidateCount);

        for (uint256 i = 0; i < candidateCount; i++) {
            electionCandidates[i] = candidates[_electionId][i];
        }

        return electionCandidates;
    }

    // Task 3.1: Register Voter Function
    /**
     * @dev Register a voter with their Aadhaar hash
     * @param _aadhaarHash The keccak256 hash of the voter's Aadhaar number
     * @return bool indicating successful registration
     */
    function registerVoter(bytes32 _aadhaarHash) external returns (bool) {
        // Check if Aadhaar hash is valid (not empty)
        require(_aadhaarHash != bytes32(0), "Invalid Aadhaar hash");

        // Check for duplicate Aadhaar registration (Requirement 2.5)
        require(
            aadhaarToWallet[_aadhaarHash] == address(0),
            "Aadhaar already registered"
        );

        // Check if wallet is already registered
        require(
            !voters[msg.sender].isRegistered,
            "Wallet already registered"
        );

        // Map aadhaarHash to wallet address (Requirement 2.4)
        aadhaarToWallet[_aadhaarHash] = msg.sender;
        walletToAadhaar[msg.sender] = _aadhaarHash;

        // Mark voter as registered (Requirement 2.4)
        voters[msg.sender] = Voter({
            walletAddress: msg.sender,
            aadhaarHash: _aadhaarHash,
            isRegistered: true,
            registrationTime: block.timestamp
        });

        emit VoterRegistered(msg.sender, _aadhaarHash);

        return true;
    }

    // Task 3.2: Cast Vote Function with Anonymity
    /**
     * @dev Cast a vote for a candidate in an election
     * @param _electionId The ID of the election
     * @param _candidateId The ID of the candidate to vote for
     * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.4
     */
    function castVote(uint256 _electionId, uint256 _candidateId)
        external
        voterRegistered
        electionExists(_electionId)
    {
        // Requirement 4.1: Verify voter has not already voted in that election
        require(
            !hasVoted[_electionId][msg.sender],
            "Already voted in this election"
        );

        // Verify election is in Voting phase
        require(
            elections[_electionId].phase == ElectionPhase.Voting,
            "Election is not in Voting phase"
        );

        // Verify candidate exists
        require(
            _candidateId < electionCandidateCount[_electionId],
            "Invalid candidate ID"
        );

        // Requirement 6.1: Increment candidate vote count without linking to voter
        // Requirement 4.2: Record vote with candidate and election identifiers
        candidates[_electionId][_candidateId].voteCount++;

        // Requirement 6.2: Mark voter as having voted in separate mapping
        // Requirement 4.3: Mark voter as having voted in that election
        hasVoted[_electionId][msg.sender] = true;

        // Requirement 6.4: Emit VoteCast event without voter identity
        // Event only includes electionId and candidateId, no voter address
        emit VoteCast(_electionId, _candidateId);
    }

    // Task 3.3: Result Calculation Functions

    /**
     * @dev Get election results with all candidates and their vote counts
     * @param _electionId The ID of the election
     * @return Array of Candidate structs with vote counts
     * Requirements: 5.1, 5.2
     */
    function getElectionResults(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (Candidate[] memory)
    {
        // Requirement 5.1: Only allow access when election is in Completed phase
        require(
            elections[_electionId].phase == ElectionPhase.Completed,
            "Results only available after election is completed"
        );

        // Requirement 5.2: Return all candidates with vote counts
        uint256 candidateCount = electionCandidateCount[_electionId];
        Candidate[] memory results = new Candidate[](candidateCount);

        for (uint256 i = 0; i < candidateCount; i++) {
            results[i] = candidates[_electionId][i];
        }

        return results;
    }

    /**
     * @dev Get the winning candidate of an election
     * @param _electionId The ID of the election
     * @return Candidate struct of the winner
     * Requirements: 5.1, 5.3
     */
    function getWinner(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (Candidate memory)
    {
        // Requirement 5.1: Only allow access when election is in Completed phase
        require(
            elections[_electionId].phase == ElectionPhase.Completed,
            "Winner can only be determined after election is completed"
        );

        uint256 candidateCount = electionCandidateCount[_electionId];
        require(candidateCount > 0, "No candidates in election");

        // Requirement 5.3: Identify candidate with most votes
        uint256 winningCandidateId = 0;
        uint256 maxVotes = candidates[_electionId][0].voteCount;

        for (uint256 i = 1; i < candidateCount; i++) {
            if (candidates[_electionId][i].voteCount > maxVotes) {
                maxVotes = candidates[_electionId][i].voteCount;
                winningCandidateId = i;
            }
        }

        return candidates[_electionId][winningCandidateId];
    }
}

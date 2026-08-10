// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./VotingV1.sol";

/**
 * @title VotingV3
 * @notice Privacy-hardened upgrade with re-voting (coercion resistance).
 *
 *   SECURITY CHANGES:
 *     1. VoteCast event replaced with VoteCastPrivate — no candidateId emitted.
 *     2. RE-VOTING: Voters can change their vote during the voting phase.
 *        If a coercer forces a vote, the voter can re-vote privately later.
 *        Only the LATEST vote counts. Old candidate's count is decremented.
 *     3. ballotSalt parameter blinds the on-chain event from observers.
 *
 *   STORAGE LAYOUT:
 *     - Inherits from VotingV1 to preserve all existing storage slots.
 *     - New state variables APPENDED at the end (safe for UUPS upgrade).
 *     - VotingV2's `upgradeGreeting` occupies one slot — we skip it with a
 *       placeholder to maintain layout compatibility.
 */
contract VotingV3 is VotingV1 {
    // ─── Storage Layout Placeholder ────────────────────────────────────────────
    // VotingV2 added `string public upgradeGreeting` at this slot.
    // We must preserve the slot even though we don't use it.
    string private __v2_upgradeGreeting_placeholder;

    // ─── New V3 State ──────────────────────────────────────────────────────────

    /**
     * @dev Stores the voter's current candidate choice per election.
     *      Value = candidateId + 1 (so that 0 means "not voted yet").
     *      This is needed to decrement the old candidate's voteCount on re-vote.
     *
     * PRIVACY NOTE: This mapping is on-chain and readable, but it maps
     * nullifierHash → candidateId. Without knowing the email/identity behind
     * the nullifierHash, this doesn't reveal WHO voted for whom.
     */
    mapping(bytes32 => mapping(bytes32 => uint256)) public voteChoice;
    // voteChoice[voterNullifier][electionId] = candidateId + 1

    /**
     * @dev Tracks how many times each voter has voted in an election.
     *      Useful for analytics and detecting potential coercion patterns.
     */
    mapping(bytes32 => mapping(bytes32 => uint256)) public voteRevisionCount;
    // voteRevisionCount[voterNullifier][electionId] = number of times voted

    // ─── New Events ────────────────────────────────────────────────────────────

    /**
     * @notice Privacy-preserving vote event.
     * @param electionId  The election this vote belongs to
     * @param ballotHash  keccak256(electionId, candidateId, voterNullifier, salt)
     * @param isRevote    True if this is a re-vote (changed from previous choice)
     */
    event VoteCastPrivate(
        bytes32 indexed electionId,
        bytes32 ballotHash,
        bool isRevote
    );

    // ─── Overridden Functions ──────────────────────────────────────────────────

    function version() external pure override returns (string memory) {
        return "3.0.0";
    }

    /**
     * @notice Cast a vote with privacy-preserving event + re-voting support.
     *
     * @param _electionId      Election identifier
     * @param _candidateId     Candidate to vote for
     * @param _voterNullifier  Voter's nullifier hash
     * @param _ballotSalt      Random salt for ballot blinding
     *
     * RE-VOTING MECHANISM:
     *   - First vote: registers the choice, increments candidate voteCount.
     *   - Re-vote: decrements OLD candidate's count, increments NEW candidate's count.
     *   - Only the latest vote is reflected in the tally.
     *   - The voter can re-vote unlimited times during the Voting phase.
     *
     * COERCION RESISTANCE:
     *   If someone forces a voter to select Candidate A, the voter can later
     *   return (in private) and re-vote for Candidate B. The coercer has no way
     *   to verify whether the voter changed their vote afterward.
     */
    function castVoteRelayedV3(
        bytes32 _electionId,
        uint256 _candidateId,
        bytes32 _voterNullifier,
        bytes32 _ballotSalt
    ) external onlyRelay electionExists(_electionId) {
        require(isRegisteredVoter[_electionId][_voterNullifier],     "VotingV3: voter not registered");
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
            // Decrement the OLD candidate's vote count
            uint256 oldCandidateId = previousChoicePlusOne - 1;

            // Only decrement if actually changing to a different candidate
            if (oldCandidateId != _candidateId) {
                require(
                    candidates[_electionId][oldCandidateId].voteCount > 0,
                    "VotingV3: underflow guard"
                );
                candidates[_electionId][oldCandidateId].voteCount--;
                // Increment the NEW candidate
                candidates[_electionId][_candidateId].voteCount++;
            }
            // If voting for the same candidate again, counts don't change

            voteRevisionCount[_voterNullifier][_electionId]++;
        } else {
            // First vote — just increment
            candidates[_electionId][_candidateId].voteCount++;
            // Mark as voted in the V1 hasVoted mapping (backwards compat)
            hasVoted[_voterNullifier][_electionId] = true;
        }

        // Store the current choice (candidateId + 1, so 0 = "not voted")
        voteChoice[_voterNullifier][_electionId] = _candidateId + 1;

        // Emit privacy-preserving event
        bytes32 ballotHash = keccak256(
            abi.encodePacked(_electionId, _candidateId, _voterNullifier, _ballotSalt)
        );
        emit VoteCastPrivate(_electionId, ballotHash, isRevote);
    }

    // ─── View Functions ────────────────────────────────────────────────────────

    /**
     * @notice Check if a voter has voted and how many revisions they made.
     */
    function getVoteStatus(
        bytes32 _voterNullifier,
        bytes32 _electionId
    ) external view returns (bool voted, uint256 revisions) {
        uint256 choice = voteChoice[_voterNullifier][_electionId];
        return (choice > 0, voteRevisionCount[_voterNullifier][_electionId]);
    }
}

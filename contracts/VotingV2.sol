// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./VotingV1.sol";

/**
 * @title VotingV2
 * @notice Upgraded logic contract for Block Vote.
 *         - Inherits from VotingV1 to preserve storage layout
 *         - Overrides version() to return "2.0.0"
 *         - Adds a new demo function to show logic upgrade
 */
contract VotingV2 is VotingV1 {
    // ─── New state (must be appended at the end of the storage layout if any) ───
    string public upgradeGreeting;

    // ─── Events ───────────────────────────────────────────────────────────────
    event GreetingChanged(string newGreeting);

    // ─── Overridden Functions ──────────────────────────────────────────────────
    function version() external pure override returns (string memory) {
        return "2.0.0";
    }

    // ─── New Functions ────────────────────────────────────────────────────────
    function setUpgradeGreeting(string calldata _greeting) external onlyGuardian {
        upgradeGreeting = _greeting;
        emit GreetingChanged(_greeting);
    }

    function helloWorld() external view returns (string memory) {
        if (bytes(upgradeGreeting).length > 0) {
            return upgradeGreeting;
        }
        return "Hello from VotingV2 upgrade! Logic is successfully modified, and state is preserved.";
    }
}

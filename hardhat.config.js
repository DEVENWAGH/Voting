import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-network-helpers";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";
import "solidity-coverage";
import dotenv from "dotenv";
dotenv.config();

/**
 * Aegis Protocol — Hardhat Config
 *
 * PRIMARY NETWORK: Private local node (yarn hardhat:node)
 *   - Runs at http://127.0.0.1:8545
 *   - 20 accounts × 10,000 ETH each = unlimited free test ETH
 *   - Zero cost, zero internet, instant transactions
 *   - No Sepolia, no Alchemy, no Infura required
 *
 * WORKFLOW:
 *   1. yarn hardhat:node       → starts private chain in Terminal 1
 *   2. yarn deploy:proxy       → deploys VotingV1 UUPS proxy to local chain
 *   3. yarn dev                → starts Next.js connected to local chain
 */

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    // ── Private Self-Hosted Chain (primary — no external dependencies) ────────
    hardhat: {
      chainId: 1337,
      // Give the relay wallet plenty of test ETH
      accounts: {
        count: 20,
        accountsBalance: "100000000000000000000000", // 100,000 ETH per account
      },
      mining: {
        auto: true,        // mine instantly on each tx
        interval: 0,
      },
    },

    // ── Local node (for when you run `yarn hardhat:node` separately) ──────────
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },
  },

  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};

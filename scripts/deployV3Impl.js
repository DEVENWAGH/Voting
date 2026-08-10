import hre from "hardhat";

/**
 * Deploy VotingV3 Implementation Contract
 *
 * This deploys the VotingV3 logic contract (NOT the proxy).
 * After deployment, use the guardian multi-sig UI to:
 *   1. Propose upgrade with the implementation address
 *   2. Get 2-of-3 guardian approvals
 *   3. Execute the upgrade
 *
 * Usage:
 *   yarn hardhat run scripts/deployV3Impl.js --network localhost
 *   yarn hardhat run scripts/deployV3Impl.js --network sepolia
 */

async function walletFromEnv(envKey, fallback, defaultAddress) {
  const key = process.env[envKey];
  if (key) return new hre.ethers.Wallet(key, hre.ethers.provider);
  if (fallback) return fallback;
  return { address: defaultAddress };
}

async function main() {
  console.log("🚀 Deploying VotingV3 Logic Contract (Privacy-Hardened)...");
  console.log("   Network:", hre.network.name);

  const signers = await hre.ethers.getSigners();
  let deployer;

  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("   Running on LOCAL network: using default Hardhat deployer.");
    deployer = signers[0];
  } else {
    console.log("   Running on LIVE network: loading keys from .env...");
    deployer = await walletFromEnv("DEPLOYER_PRIVATE_KEY", signers[0], "0x0");
  }

  console.log("   Deployer:", deployer.address);

  const VotingV3 = await hre.ethers.getContractFactory("VotingV3", deployer);
  const votingV3 = await VotingV3.deploy();
  await votingV3.waitForDeployment();
  const address = await votingV3.getAddress();

  console.log("\n✅ VotingV3 implementation contract successfully deployed!");
  console.log("📍 Implementation Address to use in Propose Upgrade form:");
  console.log(`👉 ${address} 👈`);
  console.log("\n📋 Changes in V3:");
  console.log("   - VoteCastPrivate event (no candidateId in event logs)");
  console.log("   - castVoteRelayedV3() with ballotSalt parameter");
  console.log("   - All existing data preserved (UUPS storage-compatible)");
  console.log("\n⚠️  Next steps:");
  console.log("   1. Go to the Guardian dashboard");
  console.log("   2. Propose upgrade with address:", address);
  console.log("   3. Get 2-of-3 guardian approvals");
  console.log("   4. Execute the upgrade");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});

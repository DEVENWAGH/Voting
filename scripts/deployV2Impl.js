import hre from "hardhat";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function walletFromEnv(envKey, fallback, defaultAddress) {
  const key = process.env[envKey];
  if (key) return new hre.ethers.Wallet(key, hre.ethers.provider);
  if (fallback) return fallback;
  return { address: defaultAddress };
}

async function main() {
  console.log("🚀 Deploying VotingV2 Logic Contract (Implementation Only)...");
  console.log("   Network:", hre.network.name);

  const signers = await hre.ethers.getSigners();
  let deployer;

  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("   Running on LOCAL network: using default Hardhat deployer.");
    deployer = signers[0];
  } else {
    console.log("   Running on LIVE network: loading keys from .env...");
    deployer = await walletFromEnv("DEPLOYER_PRIVATE_KEY", signers[0], "0xcda674D670C0b9Fc8C5037a21F00C8D7Db380f9A");
  }

  const VotingV2 = await hre.ethers.getContractFactory("VotingV2", deployer);
  const votingV2 = await VotingV2.deploy();
  await votingV2.waitForDeployment();
  const address = await votingV2.getAddress();

  console.log("\n✅ VotingV2 implementation contract successfully deployed!");
  console.log("📍 Implementation Address to use in Propose form:");
  console.log(`👉 ${address} 👈`);
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});

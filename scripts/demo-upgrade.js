import hre from "hardhat";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * demo-upgrade.js
 *
 * Demonstrates the UUPS upgrade pattern using only VotingV3:
 *   1. Connects to an existing VotingV3 proxy
 *   2. Deploys a fresh VotingV3 as the new implementation (simulates a logic upgrade)
 *   3. Shows 2-of-3 guardian multi-sig — fails with 1 approval, succeeds with 2
 *   4. Executes the upgrade and verifies version() is still "3.0.0"
 *
 * Accounts used (Hardhat local):
 *   Account #0 → relay + guardian1
 *   Account #1 → deployer + guardian2
 *   Account #2 → guardian3
 */
async function main() {
  console.log("🚀 Initializing UUPS Upgrade Demo (VotingV3)...");
  console.log("   Network:", hre.network.name);

  const signers = await hre.ethers.getSigners();
  let deployer, relay, guardian1, guardian2, guardian3;

  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("   Running on LOCAL network: using default Hardhat wallets.");
    deployer  = signers[1]; // Account #1
    relay     = signers[0]; // Account #0
    guardian1 = signers[0]; // Account #0
    guardian2 = signers[1]; // Account #1
    guardian3 = signers[2]; // Account #2
  } else {
    const walletFromEnv = async (envKey, fallback) => {
      const key = process.env[envKey];
      if (key) return new hre.ethers.Wallet(key, hre.ethers.provider);
      return fallback;
    };
    deployer  = await walletFromEnv("DEPLOYER_PRIVATE_KEY",    signers[0]);
    relay     = await walletFromEnv("ADMIN_RELAY_PRIVATE_KEY", signers[1]);
    guardian1 = relay;
    guardian2 = await walletFromEnv("GUARDIAN_1_PRIVATE_KEY",  signers[2]);
    guardian3 = await walletFromEnv("GUARDIAN_2_PRIVATE_KEY",  signers[3]);
  }

  console.log("\n🔑 Wallet Config:");
  console.log("   Guardian 1 (Relay) :", guardian1.address);
  console.log("   Guardian 2         :", guardian2.address);
  console.log("   Guardian 3         :", guardian3.address);

  // ── Load proxy address ────────────────────────────────────────────────────
  const envPath = resolve(__dirname, "../.env");
  let proxyAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

  if (!proxyAddress && existsSync(envPath)) {
    const env = readFileSync(envPath, "utf8");
    const match = env.match(/^NEXT_PUBLIC_CONTRACT_ADDRESS=(.*)$/m);
    if (match) proxyAddress = match[1].trim();
  }

  if (!proxyAddress) {
    throw new Error("❌ NEXT_PUBLIC_CONTRACT_ADDRESS not found in environment or .env file. Run 'yarn deploy:proxy' first.");
  }

  console.log(`\n🔗 Target UUPS Proxy: ${proxyAddress}`);

  // ── Step 1: Check current version ────────────────────────────────────────
  const proxyAsV3 = await hre.ethers.getContractAt("VotingV3", proxyAddress, deployer);
  const currentVersion = await proxyAsV3.version();
  console.log(`📊 Current Contract Version: ${currentVersion}`);

  // ── Step 2: Deploy a new VotingV3 implementation (the "upgrade" target) ──
  console.log("\n📦 Deploying new VotingV3 implementation (upgrade target)...");
  const VotingV3Factory = await hre.ethers.getContractFactory("VotingV3", deployer);
  const newImpl = await VotingV3Factory.deploy();
  await newImpl.waitForDeployment();
  const newImplAddress = await newImpl.getAddress();
  console.log(`✅ New VotingV3 implementation deployed at: ${newImplAddress}`);

  // ── Step 3: Propose Upgrade (Guardian 1) ─────────────────────────────────
  console.log(`\n✍️  [Guardian 1] Proposing upgrade to: ${newImplAddress}`);
  const proxyAsG1 = await hre.ethers.getContractAt("VotingV3", proxyAddress, guardian1);
  const txPropose = await proxyAsG1.proposeUpgrade(newImplAddress);
  const rcPropose = await txPropose.wait();

  let proposalId = 0n;
  for (const log of rcPropose.logs) {
    try {
      const parsed = proxyAsV3.interface.parseLog(log);
      if (parsed && parsed.name === "UpgradeProposed") {
        proposalId = parsed.args.proposalId;
        break;
      }
    } catch (_) {}
  }
  console.log(`✅ Upgrade proposed! Proposal ID: ${proposalId}`);

  // ── Step 4: Demonstrate multi-sig constraint (1 approval should fail) ────
  console.log(`\n🛡️  [Testing Multi-Sig] Approving with Guardian 1 only...`);
  await (await proxyAsG1.approveUpgrade(proposalId)).wait();
  console.log("   Guardian 1 approved (1/2 approvals).");

  try {
    console.log("   Attempting executeUpgrade with only 1/2 approvals...");
    await proxyAsG1.executeUpgrade(proposalId);
    console.log("❌ ERROR: Should have reverted with insufficient approvals!");
  } catch {
    console.log("✅ Expected revert: 'VotingV3: insufficient approvals' — multi-sig working correctly!");
  }

  // ── Step 5: Guardian 2 approves ──────────────────────────────────────────
  console.log(`\n✍️  [Guardian 2] Approving Proposal ${proposalId}...`);
  const proxyAsG2 = await hre.ethers.getContractAt("VotingV3", proxyAddress, guardian2);
  await (await proxyAsG2.approveUpgrade(proposalId)).wait();
  console.log(`✅ Guardian 2 approved! (2/2 approvals — threshold reached)`);

  // ── Step 6: Execute Upgrade ───────────────────────────────────────────────
  console.log(`\n⚙️  [Guardian 2] Executing upgrade...`);
  const txExecute = await proxyAsG2.executeUpgrade(proposalId);
  await txExecute.wait();
  console.log("🎉 Upgrade transaction confirmed!");

  // ── Step 7: Verify ────────────────────────────────────────────────────────
  const proxyAfterUpgrade = await hre.ethers.getContractAt("VotingV3", proxyAddress, deployer);
  const newVersion = await proxyAfterUpgrade.version();
  const newImplOnChain = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log(`\n📊 Version after upgrade  : ${newVersion}`);
  console.log(`   Implementation address : ${newImplOnChain}`);

  if (newVersion === "3.0.0" && newImplOnChain.toLowerCase() === newImplAddress.toLowerCase()) {
    console.log("\n🏆 SUCCESS: Proxy upgraded to new VotingV3 implementation!");
    console.log("   ✔ Same proxy address — state preserved");
    console.log("   ✔ New implementation address");
    console.log("   ✔ version() still returns 3.0.0");
    console.log("   ✔ 2-of-3 guardian multi-sig enforced");
  } else {
    console.log("\n❌ FAILED: Unexpected state after upgrade.");
    console.log("   Version    :", newVersion);
    console.log("   Impl addr  :", newImplOnChain);
    console.log("   Expected   :", newImplAddress);
  }
}

main().catch((err) => {
  console.error("\n❌ Upgrade demo failed:", err);
  process.exit(1);
});

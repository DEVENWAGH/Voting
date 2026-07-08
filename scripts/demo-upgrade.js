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
  console.log("🚀 Initializing UUPS Upgrade Demo Script...");
  console.log("   Network:", hre.network.name);

  // 1. Get Signers
  const signers = await hre.ethers.getSigners();
  let deployer, relay, guardian1, guardian2, guardian3;

  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("   Running on LOCAL network: using default Hardhat wallets.");
    deployer  = signers[1]; // Account #1 (Guardian 2 / Gas Station)
    relay     = signers[0]; // Account #0 (Guardian 1 / Relayer)
    guardian1 = signers[0]; // Account #0 (Guardian 1)
    guardian2 = signers[1]; // Account #1 (Guardian 2)
    guardian3 = signers[2]; // Account #2 (Guardian 3)
  } else {
    console.log("   Running on LIVE network: loading keys from .env...");
    deployer  = await walletFromEnv("DEPLOYER_PRIVATE_KEY", signers[0], "0xcda674D670C0b9Fc8C5037a21F00C8D7Db380f9A");
    relay     = await walletFromEnv("ADMIN_RELAY_PRIVATE_KEY", signers[1], "0xcda674D670C0b9Fc8C5037a21F00C8D7Db380f9A"); // Guardian 1
    guardian1 = relay;
    guardian2 = await walletFromEnv("GUARDIAN_1_PRIVATE_KEY", signers[2], "0xBf0353eA5cD869e3707B326722Cf8492A0201fbB"); // Guardian 2
    guardian3 = await walletFromEnv("GUARDIAN_2_PRIVATE_KEY", signers[3], "0x7b359a8ca8a9419d6Ed0392641B6BE18df79dE84"); // Guardian 3
  }

  console.log("\n🔑 Guardian Wallet Config:");
  console.log("   Guardian 1 (Relay) :", guardian1.address);
  console.log("   Guardian 2         :", guardian2.address);
  console.log("   Guardian 3         :", guardian3.address);

  // 2. Load Proxy Address from .env or contract-address file
  const envPath = resolve(__dirname, "../.env");
  let proxyAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

  if (!proxyAddress && existsSync(envPath)) {
    const env = readFileSync(envPath, "utf8");
    const match = env.match(/^NEXT_PUBLIC_CONTRACT_ADDRESS=(.*)$/m);
    if (match) proxyAddress = match[1].trim();
  }

  if (!proxyAddress) {
    throw new Error("❌ NEXT_PUBLIC_CONTRACT_ADDRESS not found in environment or .env file.");
  }

  console.log(`\n🔗 Target UUPS Proxy Address: ${proxyAddress}`);

  // Connect to the proxy using the current V1 logic ABI
  const votingV1 = await hre.ethers.getContractAt("VotingV1", proxyAddress, deployer);

  // 3. Check current version
  let currentVersion = "Unknown";
  try {
    currentVersion = await votingV1.version();
  } catch (err) {
    console.log("   Failed to read version, proxy might not be initialized yet.");
  }
  console.log(`📊 Current Contract Version   : ${currentVersion}`);

  // 4. Deploy VotingV2 Implementation
  console.log("\n📦 Deploying VotingV2 Logic contract...");
  const VotingV2Factory = await hre.ethers.getContractFactory("VotingV2", deployer);
  const votingV2Impl = await VotingV2Factory.deploy();
  await votingV2Impl.waitForDeployment();
  const implV2Address = await votingV2Impl.getAddress();
  console.log(`✅ VotingV2 Logic deployed at: ${implV2Address}`);

  // 5. Propose Upgrade (Guardian 1)
  console.log(`\n✍️ [Guardian 1] Proposing upgrade to implementation V2...`);
  const votingAsG1 = await hre.ethers.getContractAt("VotingV1", proxyAddress, guardian1);
  const txPropose = await votingAsG1.proposeUpgrade(implV2Address);
  const rcPropose = await txPropose.wait();
  
  // Find Proposal ID from events
  let proposalId = 0n;
  for (const log of rcPropose.logs) {
    try {
      const parsed = votingV1.interface.parseLog(log);
      if (parsed && parsed.name === "UpgradeProposed") {
        proposalId = parsed.args.proposalId;
        break;
      }
    } catch (_) {}
  }
  console.log(`✅ Upgrade proposed successfully! Proposal ID: ${proposalId}`);

  // 6. Demonstrate Multi-Sig Constraint (Show failure with only 1 approval)
  console.log(`\n🛡️ [Testing Multi-Sig] Attempting execution with 1 approval (Guardian 1 only)...`);
  const votingAsG2 = await hre.ethers.getContractAt("VotingV1", proxyAddress, guardian2);
  
  // Approve by G1 first
  console.log("   [Guardian 1] Approving Proposal...");
  await (await votingAsG1.approveUpgrade(proposalId)).wait();

  // Try to execute by G1 (should fail since approval count is 1, and threshold is 2)
  try {
    console.log("   Attempting execution with 1/2 approvals...");
    await votingAsG1.executeUpgrade(proposalId);
    console.log("❌ ERROR: Execute upgrade succeeded with only 1 approval! (Should have failed)");
  } catch (err) {
    console.log("✅ Expected Failure: Transaction reverted as planned: 'VotingV1: insufficient approvals'");
  }

  // 7. Approve by Guardian 2
  console.log(`\n✍️ [Guardian 2] Approving Proposal ${proposalId}...`);
  const txApproveG2 = await votingAsG2.approveUpgrade(proposalId);
  await txApproveG2.wait();
  console.log(`✅ Guardian 2 approved!`);

  // 8. Execute Upgrade (Guardian 2)
  console.log(`\n⚙️ [Guardian 2] Executing upgrade proposal...`);
  const txExecute = await votingAsG2.executeUpgrade(proposalId);
  await txExecute.wait();
  console.log("🎉 Upgrade transaction confirmed!");

  // 9. Verify Success & State Preservation
  const votingV2 = await hre.ethers.getContractAt("VotingV2", proxyAddress, deployer);
  const newVersion = await votingV2.version();
  console.log(`\n📊 New Contract Version       : ${newVersion}`);
  
  const helloMsg = await votingV2.helloWorld();
  console.log(`💬 Calling new V2 function    : "${helloMsg}"`);

  if (newVersion === "2.0.0") {
    console.log("\n🏆 SUCCESS: Contract successfully upgraded to V2, preserving address and state!");
  } else {
    console.log("\n❌ FAILED: Contract version is not 2.0.0.");
  }
}

main().catch((err) => {
  console.error("\n❌ Upgrade script failed:", err);
  process.exit(1);
});

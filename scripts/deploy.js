import hre from "hardhat";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("🚀 Deploying EnhancedVoting contract...");
  console.log("   Network:", hre.network.name);

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("   Deployer:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("   Balance:", hre.ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Deployer has no ETH. Fund your wallet before deploying.");
  }

  // Deploy the contract
  const EnhancedVoting = await hre.ethers.getContractFactory("EnhancedVoting");
  const voting = await EnhancedVoting.deploy();
  await voting.waitForDeployment();

  const address = await voting.getAddress();
  console.log("\n✅ EnhancedVoting deployed to:", address);

  // Copy ABI to lib/contracts/
  const artifact = await hre.artifacts.readArtifact("EnhancedVoting");
  const outputDir = resolve(__dirname, "../lib/contracts");
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    resolve(outputDir, "EnhancedVoting.json"),
    JSON.stringify(artifact, null, 2)
  );
  console.log("   ABI saved to lib/contracts/EnhancedVoting.json");

  // Auto-update .env with the new contract address
  const envPath = resolve(__dirname, "../.env");
  if (existsSync(envPath)) {
    let envContent = readFileSync(envPath, "utf8");
    if (envContent.includes("NEXT_PUBLIC_CONTRACT_ADDRESS=")) {
      envContent = envContent.replace(
        /NEXT_PUBLIC_CONTRACT_ADDRESS=.*/,
        `NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`
      );
    } else {
      envContent += `\nNEXT_PUBLIC_CONTRACT_ADDRESS=${address}`;
    }
    writeFileSync(envPath, envContent);
    console.log(`\n✅ .env updated: NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  } else {
    console.log("\n📝 Add to your .env:");
    console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  }

  if (hre.network.name === "sepolia") {
    console.log("\n⏳ Waiting 5 block confirmations before Etherscan verification...");
    await voting.deploymentTransaction().wait(5);

    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on Etherscan!");
    } catch (err) {
      if (err.message.includes("Already Verified")) {
        console.log("ℹ️  Contract already verified.");
      } else {
        console.warn("⚠️  Etherscan verification failed:", err.message);
      }
    }
  }
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});

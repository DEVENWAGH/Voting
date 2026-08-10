import hre from "hardhat";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("🚀 Deploying VotingV3 as UUPS Proxy...");
  console.log("   Network:", hre.network.name);

  const signers = await hre.ethers.getSigners();
  let deployer, relay, guardian1, guardian2, guardian3;

  if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
    console.log("   Running on LOCAL network: using default Hardhat wallets.");
    deployer  = signers[1]; // Account #1
    relay     = signers[0]; // Account #0 — relay wallet (matches ADMIN_RELAY_PRIVATE_KEY)
    guardian1 = signers[0]; // Account #0
    guardian2 = signers[1]; // Account #1
    guardian3 = signers[2]; // Account #2
  } else {
    console.log("   Running on LIVE network: loading keys from .env...");
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

  console.log("   Deployer  :", deployer.address);
  console.log("   Relay     :", relay.address);
  console.log("   Guardian 1:", guardian1.address);
  console.log("   Guardian 2:", guardian2.address);
  console.log("   Guardian 3:", guardian3.address);

  const VotingV3 = await hre.ethers.getContractFactory("VotingV3", deployer);

  // Deploy as UUPS proxy — VotingV3 is the initial implementation
  const proxy = await hre.upgrades.deployProxy(
    VotingV3,
    [
      relay.address,
      guardian1.address,
      guardian2.address,
      guardian3.address,
    ],
    {
      kind: "uups",
      initializer: "initialize",
    }
  );
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implAddress  = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);

  // Verify the version
  const ver = await proxy.version();
  console.log("\n✅ Proxy deployed to        :", proxyAddress);
  console.log("   Implementation address   :", implAddress);
  console.log("   Contract version         :", ver);

  // ── Save ABI ────────────────────────────────────────────────────────────────
  const artifact = await hre.artifacts.readArtifact("VotingV3");
  const outputDir = resolve(__dirname, "../lib/contracts");
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  // Write VotingV3.json (primary ABI)
  writeFileSync(
    resolve(outputDir, "VotingV3.json"),
    JSON.stringify(artifact, null, 2)
  );
  // Keep VotingV1.json as an alias so any remaining import still works
  writeFileSync(
    resolve(outputDir, "VotingV1.json"),
    JSON.stringify(artifact, null, 2)
  );
  console.log("   ABI saved to lib/contracts/VotingV3.json (and VotingV1.json alias)");

  // ── Update .env ─────────────────────────────────────────────────────────────
  const envPath = resolve(__dirname, "../.env");
  if (existsSync(envPath)) {
    let env = readFileSync(envPath, "utf8");

    const replace = (key, value) => {
      const regex = new RegExp(`^${key}=.*`, "m");
      if (regex.test(env)) {
        env = env.replace(regex, `${key}=${value}`);
      } else {
        env += `\n${key}=${value}`;
      }
    };

    replace("NEXT_PUBLIC_CONTRACT_ADDRESS", proxyAddress);
    replace("CONTRACT_IMPL_ADDRESS",        implAddress);
    replace("ADMIN_RELAY_ADDRESS",          relay.address);
    replace("GUARDIAN_1_ADDRESS",           guardian1.address);
    replace("GUARDIAN_2_ADDRESS",           guardian2.address);
    replace("GUARDIAN_3_ADDRESS",           guardian3.address);
    replace("NEXT_PUBLIC_GUARDIAN_1",       guardian1.address);
    replace("NEXT_PUBLIC_GUARDIAN_2",       guardian2.address);
    replace("NEXT_PUBLIC_GUARDIAN_3",       guardian3.address);
    replace("NEXT_PUBLIC_DEPLOYER_ADDRESS", deployer.address);

    if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
      replace("RPC_URL",             "http://127.0.0.1:8545");
      replace("NEXT_PUBLIC_RPC_URL", "http://127.0.0.1:8545");
    } else {
      const sepoliaRpc = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || "";
      replace("RPC_URL",             sepoliaRpc);
      replace("NEXT_PUBLIC_RPC_URL", sepoliaRpc);
    }

    writeFileSync(envPath, env);
    console.log("\n✅ .env updated with new proxy/impl addresses and wallet info");
  }

  console.log("\n📋 Summary:");
  console.log("   NEXT_PUBLIC_CONTRACT_ADDRESS =", proxyAddress);
  console.log("   CONTRACT_IMPL_ADDRESS        =", implAddress);
  console.log("   ADMIN_RELAY_ADDRESS          =", relay.address);
  console.log("\n🎉 VotingV3 UUPS proxy is live! Use 'yarn demo:upgrade' to test upgrades.");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});

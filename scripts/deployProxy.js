import hre from "hardhat";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
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
  console.log("🚀 Deploying VotingV1 as UUPS Proxy...");
  console.log("   Network:", hre.network.name);

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
    relay     = await walletFromEnv("ADMIN_RELAY_PRIVATE_KEY", signers[1], "0xcda674D670C0b9Fc8C5037a21F00C8D7Db380f9A");
    guardian1 = relay;
    guardian2 = await walletFromEnv("GUARDIAN_1_PRIVATE_KEY", signers[2], "0xBf0353eA5cD869e3707B326722Cf8492A0201fbB");
    guardian3 = await walletFromEnv("GUARDIAN_2_PRIVATE_KEY", signers[3], "0x7b359a8ca8a9419d6Ed0392641B6BE18df79dE84");
  }

  console.log("   Deployer  :", deployer.address);
  console.log("   Relay     :", relay.address);
  console.log("   Guardian 1:", guardian1.address);
  console.log("   Guardian 2:", guardian2.address);
  console.log("   Guardian 3:", guardian3.address);

  const VotingV1 = await hre.ethers.getContractFactory("VotingV1", deployer);

  // Deploy as UUPS proxy — OpenZeppelin handles the ERC1967 proxy automatically
  const proxy = await hre.upgrades.deployProxy(
    VotingV1,
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

  console.log("\n✅ Proxy deployed to        :", proxyAddress);
  console.log("   Implementation address   :", implAddress);

  // ── Save ABI ────────────────────────────────────────────────────────────────
  const artifact = await hre.artifacts.readArtifact("VotingV1");
  const outputDir = resolve(__dirname, "../lib/contracts");
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    resolve(outputDir, "VotingV1.json"),
    JSON.stringify(artifact, null, 2)
  );
  console.log("   ABI saved to lib/contracts/VotingV1.json");

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

    replace("NEXT_PUBLIC_CONTRACT_ADDRESS",   proxyAddress);
    replace("CONTRACT_IMPL_ADDRESS",          implAddress);
    replace("ADMIN_RELAY_ADDRESS",            relay.address);
    replace("GUARDIAN_1_ADDRESS",             guardian1.address);
    replace("GUARDIAN_2_ADDRESS",             guardian2.address);
    replace("GUARDIAN_3_ADDRESS",             guardian3.address);
    replace("NEXT_PUBLIC_GUARDIAN_1",         guardian1.address);
    replace("NEXT_PUBLIC_GUARDIAN_2",         guardian2.address);
    replace("NEXT_PUBLIC_GUARDIAN_3",         guardian3.address);
    replace("NEXT_PUBLIC_DEPLOYER_ADDRESS",   deployer.address);

    if (hre.network.name === "localhost" || hre.network.name === "hardhat") {
      replace("RPC_URL",                      "http://127.0.0.1:8545");
      replace("NEXT_PUBLIC_RPC_URL",           "http://127.0.0.1:8545");
    } else {
      const sepoliaRpc = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/dsi1THtX01kZlCl-eMP08";
      replace("RPC_URL",                      sepoliaRpc);
      replace("NEXT_PUBLIC_RPC_URL",           sepoliaRpc);
    }

    writeFileSync(envPath, env);
    console.log("\n✅ .env updated with proxy address, impl address, relay & guardian addresses, and RPC URLs");
  }

  console.log("\n📋 Summary:");
  console.log("   NEXT_PUBLIC_CONTRACT_ADDRESS =", proxyAddress);
  console.log("   CONTRACT_IMPL_ADDRESS        =", implAddress);
  console.log("   ADMIN_RELAY_ADDRESS          =", relay.address);
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});

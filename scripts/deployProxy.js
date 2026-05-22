import hre from "hardhat";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log("🚀 Deploying VotingV1 as UUPS Proxy...");
  console.log("   Network:", hre.network.name);

  const signers = await hre.ethers.getSigners();
  const deployer  = signers[0];
  const relay     = signers[1]; // gas-station relay wallet
  const guardian1 = signers[1]; // same as relay for local dev
  const guardian2 = signers[2];
  const guardian3 = signers[3];

  console.log("   Deployer  :", deployer.address);
  console.log("   Relay     :", relay.address);
  console.log("   Guardian 1:", guardian1.address);
  console.log("   Guardian 2:", guardian2.address);
  console.log("   Guardian 3:", guardian3.address);

  const VotingV1 = await hre.ethers.getContractFactory("VotingV1");

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

    writeFileSync(envPath, env);
    console.log("\n✅ .env updated with proxy address, impl address, relay & guardian addresses");
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

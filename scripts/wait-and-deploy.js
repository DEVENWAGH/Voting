/**
 * scripts/wait-and-deploy.js
 *
 * Waits for the local Hardhat node to be ready, then deploys the contract.
 * Used by `yarn dev` so everything starts with a single command.
 *
 * Cross-platform — works on Windows, Mac, and Linux.
 */
import http from 'node:http';
import { execSync } from 'node:child_process';

const RPC_URL = 'http://127.0.0.1:8545';
const MAX_RETRIES = 30;        // 30 seconds max wait
const RETRY_INTERVAL_MS = 1000;

function ping() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 });
    const req = http.request(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function waitForNode() {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      await ping();
      console.log('\n✅ Hardhat node is ready!');
      return;
    } catch {
      process.stdout.write(`\r⏳ Waiting for Hardhat node... (${i}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, RETRY_INTERVAL_MS));
    }
  }
  console.error('\n❌ Hardhat node did not start within 30 seconds.');
  process.exit(1);
}

async function main() {
  await waitForNode();

  if (process.env.SKIP_DB_RESET === 'true' || process.env.SKIP_DB_RESET === '1') {
    console.log('⏭️  SKIP_DB_RESET is set — skipping automatic MongoDB reset.');
  } else {
    console.log('🧹 Auto-resetting local MongoDB data to sync with fresh Hardhat node...\n');
    try {
      execSync('node scripts/reset-mongodb.js', {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    } catch {
      console.warn('⚠️  MongoDB auto-reset failed or skipped (check database connection).');
    }
  }

  console.log('\n🚀 Deploying contract...\n');
  try {
    execSync('npx hardhat run scripts/deployProxy.js --network localhost', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch {
    console.error('❌ Contract deployment failed.');
    process.exit(1);
  }
  console.log('\n✅ All done — handing off to Next.js...\n');
}

main();

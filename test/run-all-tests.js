/**
 * BlockVote — Master Test Runner
 * ============================================================
 * Runs ALL test suites in sequence and produces a final report.
 *
 * Run: node test/run-all-tests.js
 *
 * Suites:
 *   1. Contract tests      (yarn hardhat test)
 *   2. Unit tests          (yarn test)
 *   3. Security attacks    (yarn hardhat test securityAttacks)
 *   4. E2E integration     (yarn hardhat run test/integration/e2e.js)
 */

import { execSync, spawnSync } from "child_process";

// ── ANSI colours ───────────────────────────────────────────────────────────
const G = "\x1b[32m";
const R = "\x1b[31m";
const Y = "\x1b[33m";
const C = "\x1b[36m";
const B = "\x1b[1m";
const X = "\x1b[0m";

const DIVIDER = `${C}${"─".repeat(55)}${X}`;

function header(title) {
  console.log(`\n${DIVIDER}`);
  console.log(`${B}${C}  ${title}${X}`);
  console.log(DIVIDER);
}

function runSuite(label, command, cwd = process.cwd()) {
  console.log(`\n${B}▶ ${label}${X}`);
  console.log(`  ${Y}$ ${command}${X}\n`);

  const result = spawnSync(command, {
    shell: true,
    cwd,
    stdio: "inherit",
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  if (result.status !== 0) {
    console.log(`\n${R}${B}✗ SUITE FAILED: ${label}${X}`);
    return false;
  }
  console.log(`\n${G}${B}✓ SUITE PASSED: ${label}${X}`);
  return true;
}

async function main() {
  const results = [];
  const start = Date.now();

  header("BlockVote — Complete Test Suite");
  console.log(`${Y}Starting all test suites…${X}\n`);

  // ─── Suite 1: Hardhat Contract Tests ────────────────────────────────────
  header("Suite 1 · Contract Tests (VotingV3.test.js)");
  results.push({
    name: "Contract Tests",
    passed: runSuite(
      "VotingV3 contract tests",
      "npx hardhat test test/VotingV3.test.js --network hardhat"
    ),
  });

  // ─── Suite 2: Security Attack Tests ─────────────────────────────────────
  header("Suite 2 · Security Attack Simulations");
  results.push({
    name: "Security Attacks",
    passed: runSuite(
      "Security attack simulations",
      "npx hardhat test test/securityAttacks.test.js --network hardhat"
    ),
  });

  // ─── Suite 3: Unit Tests (Mocha) ─────────────────────────────────────────
  header("Suite 3 · Unit Tests (rateLimit + preflight + biometric)");
  results.push({
    name: "Rate Limit Tests",
    passed: runSuite(
      "Rate limiter unit tests",
      "npx mocha test/rateLimit.test.js --timeout 10000"
    ),
  });

  results.push({
    name: "Preflight Cache Tests",
    passed: runSuite(
      "Preflight cache unit tests",
      "npx mocha test/preflightCache.test.js --timeout 10000"
    ),
  });

  results.push({
    name: "Biometric Tests",
    passed: runSuite(
      "Biometric utility tests",
      "npx mocha test/biometric.test.js --timeout 10000"
    ),
  });

  // ─── Suite 4: E2E Integration Test ──────────────────────────────────────
  header("Suite 4 · End-to-End Integration Test");
  results.push({
    name: "E2E Integration",
    passed: runSuite(
      "Full election lifecycle (deploy → vote → upgrade)",
      "npx hardhat run test/integration/e2e.js --network hardhat"
    ),
  });

  // ─── Final Report ────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  header(`Final Report  (${elapsed}s)`);
  for (const r of results) {
    const icon = r.passed ? `${G}✓${X}` : `${R}✗${X}`;
    console.log(`  ${icon} ${r.name}`);
  }

  console.log(`\n  ${G}Passed: ${passed}${X}`);
  if (failed > 0) {
    console.log(`  ${R}Failed: ${failed}${X}`);
    console.log(`\n${R}${B}⚠  Some tests failed. Fix before deploying.${X}\n`);
    process.exit(1);
  } else {
    console.log(`  ${G}Failed: 0${X}`);
    console.log(`\n${G}${B}✓ All suites passed — safe to deploy!${X}\n`);
  }
}

main();

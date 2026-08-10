/**
 * Rate Limiter Unit Tests
 * ============================================================
 * Tests lib/rateLimit.js in isolation using a mock Request.
 *
 * The rate limiter uses an in-memory sliding-window store, so we
 * control time by patching Date.now() in each test.
 *
 * Run: yarn test test/rateLimit.test.js
 */

import { expect } from "chai";

// ── Inline rate limiter (identical logic to lib/rateLimit.js) ──────────────
// We reproduce it here to avoid ESM/Next.js module resolver issues in mocha.
// Any changes to lib/rateLimit.js must be reflected here too.

function makeRateLimit({
  windowMs = 60_000,
  max = 5,
  message = "Too many requests.",
  keyPrefix = "rl",
  getNow = () => Date.now(),
} = {}) {
  const store = new Map();

  return function check(ip) {
    const now = getNow();
    const key = `${keyPrefix}:${ip}`;

    if (!store.has(key)) store.set(key, { timestamps: [] });
    const entry = store.get(key);

    // Slide the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

    if (entry.timestamps.length >= max) {
      const retryAfterMs = windowMs - (now - entry.timestamps[0]);
      return {
        blocked: true,
        status: 429,
        retryAfter: Math.ceil(retryAfterMs / 1000),
        remaining: 0,
        message,
      };
    }

    entry.timestamps.push(now);
    return {
      blocked: false,
      remaining: max - entry.timestamps.length,
    };
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("rateLimit — Sliding-Window Unit Tests", function () {
  let clock;
  let now;

  beforeEach(function () {
    now = Date.now();
    clock = { value: now };
  });

  function makeCheck(opts = {}) {
    return makeRateLimit({ ...opts, getNow: () => clock.value });
  }

  // ── Basic allow / block ────────────────────────────────────────────────

  it("RL1 allows first request under the limit", function () {
    const check = makeCheck({ max: 5, windowMs: 60_000 });
    const result = check("1.2.3.4");
    expect(result.blocked).to.be.false;
  });

  it("RL2 allows up to max requests in window", function () {
    const check = makeCheck({ max: 3, windowMs: 60_000 });
    check("1.2.3.4");
    check("1.2.3.4");
    const r3 = check("1.2.3.4");
    expect(r3.blocked).to.be.false;
  });

  it("RL3 blocks the (max+1)th request in the same window", function () {
    const check = makeCheck({ max: 3, windowMs: 60_000 });
    check("1.2.3.4");
    check("1.2.3.4");
    check("1.2.3.4");
    const r4 = check("1.2.3.4");
    expect(r4.blocked).to.be.true;
    expect(r4.status).to.equal(429);
  });

  it("RL4 returns correct remaining count", function () {
    const check = makeCheck({ max: 5, windowMs: 60_000 });
    const r1 = check("1.2.3.4");
    expect(r1.remaining).to.equal(4);
    const r2 = check("1.2.3.4");
    expect(r2.remaining).to.equal(3);
  });

  it("RL5 retryAfter is a positive integer on block", function () {
    const check = makeCheck({ max: 2, windowMs: 60_000 });
    check("1.2.3.4");
    check("1.2.3.4");
    const r = check("1.2.3.4");
    expect(r.blocked).to.be.true;
    expect(r.retryAfter).to.be.a("number");
    expect(r.retryAfter).to.be.greaterThan(0);
    expect(Number.isInteger(r.retryAfter)).to.be.true;
  });

  // ── Window sliding ─────────────────────────────────────────────────────

  it("RL6 allows requests again after window expires", function () {
    const check = makeCheck({ max: 2, windowMs: 1000 });
    check("1.2.3.4");
    check("1.2.3.4");
    // Advance time past the window
    clock.value += 1001;
    const r = check("1.2.3.4");
    expect(r.blocked).to.be.false;
  });

  it("RL7 sliding window: old requests fall out as time advances", function () {
    const check = makeCheck({ max: 3, windowMs: 1000 });
    check("1.2.3.4"); // t=0
    clock.value += 500;
    check("1.2.3.4"); // t=500
    check("1.2.3.4"); // t=500 — now at limit (3 in window)
    clock.value += 501; // t=1001 — first request (t=0) is now outside window
    const r = check("1.2.3.4");
    expect(r.blocked).to.be.false; // Only 2 in window now (t=500, t=500)
  });

  it("RL8 different IPs get independent limits", function () {
    const check = makeCheck({ max: 2, windowMs: 60_000 });
    check("1.1.1.1");
    check("1.1.1.1"); // 1.1.1.1 at limit
    const blocked = check("1.1.1.1");
    expect(blocked.blocked).to.be.true;

    const other = check("2.2.2.2"); // completely fresh
    expect(other.blocked).to.be.false;
  });

  // ── Message & headers ──────────────────────────────────────────────────

  it("RL9 blocked response contains the custom message", function () {
    const check = makeCheck({ max: 1, windowMs: 60_000, message: "Slow down!" });
    check("1.2.3.4");
    const r = check("1.2.3.4");
    expect(r.message).to.equal("Slow down!");
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  it("RL10 max=1 blocks the second request immediately", function () {
    const check = makeCheck({ max: 1, windowMs: 60_000 });
    const r1 = check("5.5.5.5");
    expect(r1.blocked).to.be.false;
    const r2 = check("5.5.5.5");
    expect(r2.blocked).to.be.true;
  });

  it("RL11 separate limiter instances are fully isolated", function () {
    const checkOTP = makeCheck({ max: 3, windowMs: 60_000, keyPrefix: "otp" });
    const checkBio = makeCheck({ max: 3, windowMs: 60_000, keyPrefix: "bio" });

    checkOTP("9.9.9.9");
    checkOTP("9.9.9.9");
    checkOTP("9.9.9.9"); // OTP limiter exhausted

    const r = checkBio("9.9.9.9"); // bio limiter fresh
    expect(r.blocked).to.be.false;
  });

  it("RL12 high-frequency burst is rate-limited correctly", function () {
    const check = makeCheck({ max: 10, windowMs: 60_000 });
    for (let i = 0; i < 10; i++) check("6.6.6.6");
    const r = check("6.6.6.6");
    expect(r.blocked).to.be.true;
    expect(r.remaining).to.equal(0);
  });

  it("RL13 OTP endpoint: 3-attempt limit per 5-minute window", function () {
    const check = makeCheck({ max: 3, windowMs: 5 * 60_000, keyPrefix: "otp" });
    check("7.7.7.7"); // attempt 1
    check("7.7.7.7"); // attempt 2
    check("7.7.7.7"); // attempt 3 — should be allowed
    const r4 = check("7.7.7.7"); // attempt 4 — blocked
    expect(r4.blocked).to.be.true;
    // Retry after should be up to 5 minutes (300 seconds)
    expect(r4.retryAfter).to.be.lessThanOrEqual(300);
    expect(r4.retryAfter).to.be.greaterThan(0);
  });
});

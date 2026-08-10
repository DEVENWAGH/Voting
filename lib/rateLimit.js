/**
 * lib/rateLimit.js
 * In-memory sliding-window rate limiter for API routes.
 *
 * PRIVACY NOTE:
 *   This rate limiter uses IP addresses for throttling, but the IP is never
 *   stored alongside vote data. Rate limiting happens BEFORE any vote
 *   processing, and the IP is discarded after the window expires.
 *
 * Usage:
 *   import { rateLimit } from '@/lib/rateLimit';
 *
 *   const limiter = rateLimit({ windowMs: 60_000, max: 5 });
 *
 *   export async function POST(req) {
 *     const limited = limiter(req);
 *     if (limited) return limited; // Returns 429 response
 *     // ... handle request
 *   }
 */

import { NextResponse } from 'next/server';

const stores = new Map();

/**
 * Creates a rate limiter middleware function.
 *
 * @param {object} options
 * @param {number} options.windowMs  — Time window in milliseconds (default: 60s)
 * @param {number} options.max       — Max requests per window per key (default: 10)
 * @param {string} options.message   — Error message for 429 responses
 * @param {string} options.keyPrefix — Prefix to isolate limiter instances
 * @returns {function} — Call with (req) → null if allowed, NextResponse if blocked
 */
export function rateLimit({
  windowMs = 60_000,
  max = 10,
  message = 'Too many requests. Please try again later.',
  keyPrefix = 'rl',
} = {}) {
  // Each limiter instance gets its own store
  const storeKey = `${keyPrefix}_${windowMs}_${max}`;
  if (!stores.has(storeKey)) {
    stores.set(storeKey, new Map());
  }
  const store = stores.get(storeKey);

  // Periodic cleanup of expired entries (every 5 minutes)
  let lastCleanup = Date.now();
  const CLEANUP_INTERVAL = 5 * 60 * 1000;

  return function check(req) {
    const now = Date.now();

    // Cleanup stale entries periodically
    if (now - lastCleanup > CLEANUP_INTERVAL) {
      lastCleanup = now;
      for (const [key, entry] of store) {
        // Remove entries where all timestamps are outside the window
        entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
        if (entry.timestamps.length === 0) store.delete(key);
      }
    }

    // Extract client identifier — use forwarded IP or fallback
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    const key = `${keyPrefix}:${ip}`;

    // Get or create entry
    if (!store.has(key)) {
      store.set(key, { timestamps: [] });
    }
    const entry = store.get(key);

    // Remove timestamps outside the current window
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

    // Check if over limit
    if (entry.timestamps.length >= max) {
      const retryAfterMs = windowMs - (now - entry.timestamps[0]);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);

      return NextResponse.json(
        { error: message },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(max),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil((now + retryAfterMs) / 1000)),
          },
        },
      );
    }

    // Record this request
    entry.timestamps.push(now);
    return null; // Allowed
  };
}

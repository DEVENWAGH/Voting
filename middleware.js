import { NextResponse } from 'next/server';

/**
 * SECURITY HEADERS + AUTH REDIRECT MIDDLEWARE
 *
 * Applies security headers to all matched routes and handles
 * authentication redirects for protected/public pages.
 */

// ─── Security Headers ─────────────────────────────────────────────────────────
const SECURITY_HEADERS = {
  // Prevent clickjacking — the voting UI must never be embedded in an iframe
  'X-Frame-Options': 'DENY',
  // Prevent MIME-type sniffing attacks
  'X-Content-Type-Options': 'nosniff',
  // Control referrer information — don't leak vote-related URLs
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Restrict browser features — disable unnecessary APIs during voting
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
  // Force HTTPS in production
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  // Prevent XSS attacks — disable inline scripts except Next.js required ones
  'X-XSS-Protection': '1; mode=block',
};

// Strict CSP for the voting flow — no analytics, no third-party scripts
const VOTE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js requires these
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://ik.imagekit.io https://*.ftcdn.net",
  "media-src 'self' blob:",        // For biometric camera feed
  "connect-src 'self'",            // No third-party API calls during voting
  "frame-ancestors 'none'",        // Never allow iframe embedding
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// Standard CSP for non-voting pages (slightly more permissive)
const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://ik.imagekit.io https://*.ftcdn.net",
  "media-src 'self' blob:",
  "connect-src 'self' https://nominatim.openstreetmap.org https://api.pinata.cloud https://*.pinata.cloud",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function middleware(req) {
  const { nextUrl } = req;
  const path = nextUrl.pathname;

  // Auth.js v5 stores the session in this cookie
  const sessionToken =
    req.cookies.get('authjs.session-token')?.value ||
    req.cookies.get('__Secure-authjs.session-token')?.value;

  const isLoggedIn = !!sessionToken;

  // Routes that logged-in users should NOT see → redirect to /dashboard
  const authPages = ['/', '/login', '/signup'];

  // Routes that require authentication → redirect to /login
  const protectedPages = ['/dashboard'];

  // ─── Auth redirects ───────────────────────────────────────────────────────
  if (isLoggedIn && authPages.includes(path)) {
    const response = NextResponse.redirect(new URL('/dashboard', nextUrl));
    applyHeaders(response, path);
    return response;
  }

  if (!isLoggedIn && protectedPages.some(p => path.startsWith(p))) {
    const response = NextResponse.redirect(new URL('/login', nextUrl));
    applyHeaders(response, path);
    return response;
  }

  // ─── Apply security headers to all responses ──────────────────────────────
  const response = NextResponse.next();
  applyHeaders(response, path);
  return response;
}

function applyHeaders(response, path) {
  // Apply all security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  // Use strict CSP on voting paths (no analytics scripts allowed)
  const isVotePath = path.startsWith('/vote') || path.startsWith('/api/auth/verify-otp');
  response.headers.set(
    'Content-Security-Policy',
    isVotePath ? VOTE_CSP : DEFAULT_CSP,
  );
}

export const config = {
  matcher: ['/', '/login', '/signup', '/dashboard/:path*', '/vote/:path*', '/verify', '/api/:path*'],
};


import { NextResponse } from 'next/server';

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

  if (isLoggedIn && authPages.includes(path)) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }

  if (!isLoggedIn && protectedPages.some(p => path.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/signup', '/dashboard/:path*'],
};

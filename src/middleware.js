import { NextResponse } from 'next/server';

/**
 * Next.js Middleware — Route Shape Protection
 *
 * Handles top-level routing rules:
 * - Redirects the root path to /login
 * - Allows all (auth) routes to pass through freely
 * - Allows all (pos) routes to pass through to client-side guards
 *
 * NOTE: Token validation cannot be done here because Redux Persist
 * stores tokens in localStorage, which is inaccessible at the edge.
 * Real auth enforcement is handled by AuthGuard and StoreGuard
 * client components inside the (pos) layout.
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Redirect root to login
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static  (Next.js static files)
     * - _next/image   (Next.js image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
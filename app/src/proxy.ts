import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic auth checks (Next.js 16 proxy convention).
 * Real authorization happens server-side in layouts/actions — this only
 * avoids rendering portal chrome for obviously-signed-out users.
 */
const SESSION_COOKIE = "better-auth.session_token";
// secureCookies (production) prefixes the cookie name.
const COOKIE_NAMES = [
  SESSION_COOKIE,
  "__session-better-auth.session_token",
  "__Secure-better-auth.session_token",
  "__Host-better-auth.session_token",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = COOKIE_NAMES.some((n) => request.cookies.has(n));

  if (!hasSession && pathname.startsWith("/portal")) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // NOTE: signed-in users on /sign-in are redirected by the page itself after
  // a real session check — an optimistic cookie check here can loop forever
  // with stale cookies.
  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*"],
};

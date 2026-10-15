import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Optimistic auth checks (Next.js 16 proxy convention) + per-request CSP nonce.
 * Real authorization happens server-side in layouts/actions — this only
 * avoids rendering portal chrome for obviously-signed-out users.
 *
 * CSP wiring: every matched request gets a fresh nonce (base64 of
 * `crypto.randomUUID()`), forwarded to the render as the `x-nonce` request
 * header (the root layout reads it via `headers()` for the theme script)
 * and enforced on the response as `Content-Security-Policy`. Next.js
 * extracts the nonce from the request CSP header automatically and stamps
 * it on framework scripts/styles — which is why the root layout must read
 * `headers()`, opting every route into dynamic rendering (portal pages are
 * `force-dynamic` already; marketing/auth pages lose static prerendering).
 */
const SESSION_COOKIE = "better-auth.session_token";
// secureCookies (production) prefixes the cookie name.
const COOKIE_NAMES = [
  SESSION_COOKIE,
  "__session-better-auth.session_token",
  "__Secure-better-auth.session_token",
  "__Host-better-auth.session_token",
];

/**
 * Baseline Content-Security-Policy, enforced by the proxy on every matched
 * page request (API/static/prefetch excluded by the matcher below).
 *
 * Survey notes (re-verify before tightening):
 * - script-src: NO 'unsafe-inline'. Next.js 16 stamps the request nonce on
 *   bootstrapping/framework scripts itself (it parses the CSP header off the
 *   request — hence `x-nonce` + the CSP header both set on requestHeaders
 *   below). The lone hand-written inline script (theme reader in the root
 *   layout) gets the nonce explicitly via `headers()`. `'strict-dynamic'`
 *   lets Next's nonced bootstrap trust its own dynamic chunks; plain 'self'
 *   is kept as the fallback for browsers that ignore strict-dynamic.
 *   Dev only: React dev overlays use eval → 'unsafe-eval' in development.
 * - style-src 'self' 'unsafe-inline': pragmatic compromise. Next inlines
 *   critical CSS and <style> keyframe blocks (auth-shell, evidence-chip,
 *   interactive, portal-shell-server) that it does NOT nonce, so a
 *   nonce-only style-src would break styling. 'unsafe-inline' for styles
 *   does not enable script execution; risk accepted and documented.
 * - font-src: next/font/google self-hosts the woff2 files, but the CSS
 *   comes from fonts.googleapis.com — both allow-listed.
 * - img-src 'self' data:: NO <img src="data:…"> exists today, but
 *   `social-buttons.tsx` embeds the Google "G" as inline SVG <path> (fine —
 *   inline SVG is not img-src), and QR codes render server-side as inline
 *   SVG. data: is kept as a safety margin for favicons/any future
 *   server-rendered data-URI thumbnails; it cannot execute script.
 * - worker-src 'self': three.js/R3F on the landing page run on the main
 *   thread today (no createObjectURL / Worker / blob: found anywhere in
 *   src/). blob: deliberately NOT allow-listed — revisit if a worker-based
 *   drei feature (e.g. drei Text/troika, Draco/KTX2 loaders) is added.
 * - frame-src 'self': the org review page embeds
 *   <iframe src="/api/files/…"> for source-document review. frame-ancestors
 *   'none' (mirrors X-Frame-Options DENY) stops anyone embedding us.
 * - connect-src 'self': all client fetches are same-origin (auth client uses
 *   window.location.origin; Resend/Gemini calls are server-to-server, never
 *   from the browser). No report-uri: there is no reporting endpoint, so
 *   violations would go nowhere — omitted deliberately.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return (
    `default-src 'self'; ` +
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}; ` +
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ` +
    `font-src 'self' https://fonts.gstatic.com; ` +
    `img-src 'self' data:; ` +
    `worker-src 'self'; ` +
    `connect-src 'self'; ` +
    `frame-src 'self'; ` +
    `object-src 'none'; ` +
    `base-uri 'self'; ` +
    `form-action 'self'; ` +
    `frame-ancestors 'none'; ` +
    `upgrade-insecure-requests`
  );
}

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
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next.js reads the nonce off the *request* CSP header during rendering.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // CSP on every page (portal auth redirect above needs it too), but skip
  // API routes, Next static/image assets, the file iframe bytes, and
  // router prefetches — none of them render HTML that needs a policy.
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

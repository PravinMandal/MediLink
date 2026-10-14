import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // Framework version disclosure: the X-Powered-By header advertises Next.js
  // to every scanner. Off everywhere (headers below layer the rest).
  poweredByHeader: false,
  // The dev-only route indicator ("N" badge, bottom-left) floats over the
  // sidebar footer and reads as a broken app element in screenshots.
  devIndicators: false,
  experimental: {
    serverActions: {
      // Vercel's proxy caps request bodies at 4.5 MB — anything larger is
      // rejected before our code runs, so a bigger limit here is a lie.
      bodySizeLimit: "4mb",
    },
  },
  // Research finding (practitioner guides, HIPAA): PHI pages must never sit
  // in shared caches. Portal routes are force-dynamic (no static/ISR), and
  // this header belt-and-braces it at the CDN/proxy layer too.
  async headers() {
    // Baseline clickjacking/MIME/referrer posture for every route (portal
    // ones get the PHI no-store layer on top). No CSP yet: Next.js inlines
    // bootstrapping scripts that a strict policy would break — that needs a
    // nonce-based policy once the app stabilizes, not a header that 500s
    // the portal on deploy day.
    const baseline = [
      // PHI must never render inside an attacker's iframe.
      { key: "X-Frame-Options", value: "DENY" },
      // The old content-type- sniffing attacks turn JSON/PDF into script.
      { key: "X-Content-Type-Options", value: "nosniff" },
      // Never leak patient-URL query strings to linked external sites.
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Vercel always serves TLS: first visit upgrades, later visits pin.
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      // Permissions we never need — close the fingerprinting surface.
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    return [
      {
        source: "/:path*",
        headers: baseline,
      },
      {
        source: "/portal/:path*",
        headers: [
          ...baseline,
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      {
        source: "/api/files/:path*",
        headers: [
          ...baseline,
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;

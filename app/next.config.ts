import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
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
    return [
      {
        source: "/portal/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
      {
        source: "/api/files/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;

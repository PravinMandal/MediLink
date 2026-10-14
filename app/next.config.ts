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
};

export default nextConfig;

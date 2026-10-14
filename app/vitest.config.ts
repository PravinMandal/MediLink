import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Single process: one embedded PGlite instance for the whole suite.
    fileParallelism: false,
    hookTimeout: 180_000,
    testTimeout: 120_000,
  },
});

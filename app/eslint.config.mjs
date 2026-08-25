import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React Compiler's purity lint: server components legitimately read the
      // clock during render (dynamic pages), and R3F/three mutate objects
      // inside useFrame by design. Both patterns are established in this
      // codebase (see docs/decisions.md).
      "react-hooks/purity": "off",
    },
  },
]);

export default eslintConfig;

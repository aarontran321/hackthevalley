import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off"
    }
  },
  // Vendored, minified third-party code. Linting it produced 752 problems that
  // buried every real one, so `npm run lint` was effectively unusable.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "extension/vendor/**"
  ])
]);

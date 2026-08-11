import { nextJsConfig } from "@freelancerhisab/eslint-config/next-js";

// This used to be an empty ruleset — `next lint` reported "0 warnings" simply
// because nothing was ever checked. `nextJsConfig` brings in the Next.js
// core-web-vitals rules, TypeScript's recommended set, and react-hooks
// (exhaustive-deps, rules-of-hooks), matching what `packages/eslint-config`
// already ships for exactly this purpose.
export default nextJsConfig;

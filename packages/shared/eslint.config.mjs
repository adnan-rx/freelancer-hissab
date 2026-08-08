import js from "@eslint/js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];

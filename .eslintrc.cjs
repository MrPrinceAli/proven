/** Shared ESLint config for every TypeScript package. apps/web extends this plus next/core-web-vitals. */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  env: { es2022: true, node: true },
  ignorePatterns: ["node_modules", "dist", ".next", "coverage", "out", "cache"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": "error",
  },
};

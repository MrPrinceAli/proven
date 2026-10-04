import { defineConfig } from "vitest/config";

// Only the TypeScript ABI tests; lib/ contains OpenZeppelin's own JS test-suite.
export default defineConfig({
  test: {
    include: ["test-ts/**/*.test.ts"],
  },
});

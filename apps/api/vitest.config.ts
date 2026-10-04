import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Test files share one database.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});

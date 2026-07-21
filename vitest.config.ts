import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/tests/**/*.test.ts"],
    // Integration fixtures compile temporary repositories and contend for CPU
    // when Vitest runs files in parallel.
    testTimeout: 30_000,
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Each test file starts its own PGlite (~1.1 GB at peak). With the default (one worker per core),
    // 7 at once used up an 8 GB laptop's memory and froze it. One at a time: slower (~50 s), but safe.
    maxWorkers: 1,
  },
});

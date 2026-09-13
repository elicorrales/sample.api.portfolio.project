import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Starts one PostgreSQL server for the whole run; each test file gets its own database in it.
    globalSetup: ["tests/global-setup.ts"],
    // One test file at a time. With PGlite, each file used ~1.1 GB and 7 at once froze the laptop
    // (decision 11). A shared PostgreSQL server should use far less; measure before raising this.
    maxWorkers: 1,
  },
});

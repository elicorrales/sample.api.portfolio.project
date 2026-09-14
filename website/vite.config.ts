import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.tsx"],
    // A fake browser page inside Node, so components can render without opening Chrome.
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    // One test file at a time, like the API: the laptop's memory is tight. Measure before raising this.
    maxWorkers: 1,
  },
});

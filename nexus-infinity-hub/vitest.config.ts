import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // happy-dom env supports both DOM component tests AND plain logic tests.
    // jsdom/happy-dom envs require the threads pool — the forks pool times out
    // spawning DOM-env workers on Windows (vitest 4.1.10).
    environment: "happy-dom",
    globals: false,
    pool: "threads",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});


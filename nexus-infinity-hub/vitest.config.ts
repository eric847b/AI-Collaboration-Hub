import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // globals disabled: tests import { describe,it,expect } from "vitest" explicitly.
    // globals:true + vitest 4.1.10 triggers a flaky "reading 'config'" runtime-init race on Windows.
    globals: false,
    pool: "forks",
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


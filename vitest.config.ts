import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@aloysius-g1/ui", replacement: fileURLToPath(new URL("./packages/ui/src", import.meta.url)) },
      { find: "@", replacement: fileURLToPath(new URL("./apps/web/src", import.meta.url)) },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["apps/**/*.test.ts", "apps/**/*.test.tsx", "packages/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    pool: "forks",
    forkTimeout: 120000,
    testTimeout: 30000,
  },
});
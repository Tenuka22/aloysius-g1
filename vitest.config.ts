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
    // *.integration.test.ts files exercise the real database (bun:sqlite) and
    // must run under the Bun runtime via `bun test`, not vitest's Node-based
    // worker pool, which cannot resolve "bun:sqlite". See package.json's
    // "test:integration" script.
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    pool: "forks",
    forkTimeout: 120000,
    testTimeout: 30000,
  },
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export type TestDatabase = {
  databasePath: string;
  cleanup: () => void;
};

/**
 * Provisions a throwaway SQLite database file with the current Drizzle schema
 * pushed into it (via `drizzle-kit push`), and points every env var
 * `@aloysius-g1/env/server` requires at safe, isolated test values for the
 * lifetime of the process.
 *
 * Call this once per test file, in a top-level (non-async-body) statement or
 * inside `beforeAll`, BEFORE importing any module that transitively calls
 * `createDb()`/`createAuth()` — those read `process.env` once at import time,
 * so importing them first would bind to whatever `DATABASE_URL` was already
 * set (or none). Use a dynamic `await import(...)` after calling this.
 *
 * `DATABASE_URL` is always force-overridden (never reused from a real `.env`)
 * so a test can never accidentally run against a real dev/prod database.
 */
export function provisionTestDatabase(): TestDatabase {
  const dir = mkdtempSync(join(tmpdir(), "aloysius-g1-test-db-"));
  const databasePath = join(dir, "test.db");

  process.env.DATABASE_URL = `file:${databasePath}`;
  process.env.BETTER_AUTH_SECRET ??= "test-only-secret-at-least-32-characters-long";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  process.env.CORS_ORIGIN ??= "http://localhost:3001";
  process.env.NODE_ENV = "test";

  const dbPackageDir = fileURLToPath(new URL("..", import.meta.url));
  const result = spawnSync(
    "bun",
    ["x", "drizzle-kit", "push", "--config=drizzle.config.ts", "--force"],
    {
      cwd: dbPackageDir,
      env: { ...process.env, DATABASE_URL: `file:${databasePath}` },
      encoding: "utf-8",
      timeout: 60_000,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `drizzle-kit push failed while provisioning test database:\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }

  return {
    databasePath,
    cleanup: () => {
      // On Windows, SQLite may still hold the file open briefly after the last
      // query (bun:sqlite/better-sqlite3 don't always release the handle the
      // instant a Database object goes out of scope), so an immediate rmSync
      // can hit EBUSY. Retry a few times before giving up.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          rmSync(dir, { recursive: true, force: true });
          return;
        } catch (error) {
          if (attempt === 4) {
            // A held SQLite file handle (Windows) shouldn't fail the test run;
            // the OS temp directory will be reclaimed eventually.
            console.warn(`[test-db] could not remove temp database at ${dir}:`, error);
            return;
          }
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        }
      }
    },
  };
}

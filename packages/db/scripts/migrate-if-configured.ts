import { spawnSync } from "node:child_process";

/**
 * Deploy-time migration runner for build pipelines (Vercel's `vercel-build`,
 * the Docker image's start command). Unlike `drizzle-kit migrate` directly,
 * this skips instead of failing when no database is configured, so a preview
 * deployment without Turso credentials attached still builds - it just serves
 * without having migrated.
 *
 * Reads `process.env.TURSO_DATABASE_URL` directly rather than importing
 * `@aloysius-admissions/env/server`: that module throws at import time when
 * the variable is missing, which would defeat the graceful skip below.
 */
if (!process.env.TURSO_DATABASE_URL) {
  console.log("[migrate] TURSO_DATABASE_URL not set, skipping migration");
  process.exit(0);
}

const result = spawnSync("bunx", ["drizzle-kit", "migrate", "--config=drizzle.config.ts"], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);

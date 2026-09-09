import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@aloysius-admissions/env/server";

/**
 * Absolute path of the SQLite file.
 *
 * A relative DATABASE_URL is resolved against the repository root rather than
 * the process working directory, so the same value works whichever app or
 * script opens the database.
 *
 * This lives in its own module so the backup and restore scripts can resolve
 * the path without importing `./index`, which opens a connection on load.
 */
export function resolveDatabasePath(): string {
  const configuredPath = env.DATABASE_URL.replace(/^file:/, "");
  if (isAbsolute(configuredPath)) return configuredPath;
  // `import.meta.dir` is Bun-only; the server now runs under Node as well.
  const moduleDir = fileURLToPath(new URL(".", import.meta.url));
  return join(moduleDir, "../../../", configuredPath.replace(/^([.][.][\\/])+/, ""));
}

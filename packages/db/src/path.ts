import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@aloysius-admissions/env/server";

/**
 * Whether a configured database URL points at a hosted Turso database rather
 * than a local SQLite file. Turso databases are addressed as `libsql://...`
 * (or the `https://` alias); anything else - a bare path or a `file:` URL -
 * is a local file opened directly by the libSQL client.
 */
export function isRemoteDatabaseUrl(url: string): boolean {
  return /^(libsql|https?):\/\//i.test(url);
}

/**
 * The URL the libSQL client should connect with: the configured value
 * unchanged for a remote Turso database, or an absolute `file:` URL for
 * local development.
 */
export function resolveDatabaseUrl(): string {
  const configured = env.TURSO_DATABASE_URL;
  return isRemoteDatabaseUrl(configured) ? configured : `file:${resolveDatabasePath()}`;
}

/**
 * Absolute path of the local SQLite file backing `TURSO_DATABASE_URL` in
 * development.
 *
 * A relative `TURSO_DATABASE_URL` is resolved against the repository root
 * rather than the process working directory, so the same value works
 * whichever app or script opens the database.
 *
 * This lives in its own module so the backup and restore scripts can resolve
 * the path without importing `./index`, which opens a connection on load.
 *
 * Throws for a remote Turso URL: there is no local file to resolve, and the
 * file-based backup/restore scripts only apply to local development.
 */
export function resolveDatabasePath(): string {
  const configured = env.TURSO_DATABASE_URL;
  if (isRemoteDatabaseUrl(configured)) {
    throw new Error(
      `resolveDatabasePath() cannot resolve a filesystem path for a remote Turso database (TURSO_DATABASE_URL=${configured}). File-based backup/restore only apply to local development.`,
    );
  }
  const configuredPath = configured.replace(/^file:/, "");
  if (isAbsolute(configuredPath)) return configuredPath;
  // `import.meta.dir` is Bun-only; the server now runs under Node as well.
  const moduleDir = fileURLToPath(new URL(".", import.meta.url));
  return join(moduleDir, "../../../", configuredPath.replace(/^([.][.][\\/])+/, ""));
}

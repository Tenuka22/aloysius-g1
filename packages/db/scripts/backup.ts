import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { env } from "@aloysius-admissions/env/server";

/** Newest backups are always kept, however old they are. */
const MIN_BACKUPS = 10;
/** Backups younger than this are kept even beyond MIN_BACKUPS. */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Hard ceiling so the retention window can never fill the disk. */
const MAX_BACKUPS = 200;

function resolveDbPath(): string {
  const configuredPath = env.DATABASE_URL.replace(/^file:/, "");
  return isAbsolute(configuredPath)
    ? configuredPath
    : join(import.meta.dir, "../../../", configuredPath.replace(/^([.][.][\\/])+/, ""));
}

function backupsDir(dbPath: string): string {
  return join(dirname(dbPath), "backups");
}

function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}-${ms}`;
}

interface BackupFile {
  name: string;
  path: string;
  mtimeMs: number;
  size: number;
}

function listBackups(dir: string): BackupFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .map((name) => {
      const path = join(dir, name);
      const stat = statSync(path);
      return { name, path, mtimeMs: stat.mtimeMs, size: stat.size };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * Retention is age-aware on purpose. A purely count-based window (keep the last
 * N) is destroyed by a burst: a boot crash-loop under `restart: unless-stopped`
 * re-runs this script once per restart and can evict every real backup within
 * seconds. Age is the property we actually care about; MIN_BACKUPS is the floor
 * for quiet periods and MAX_BACKUPS the ceiling for busy ones.
 */
function pruneOldBackups(dir: string): void {
  const files = listBackups(dir);
  const cutoff = Date.now() - RETENTION_MS;
  // Newest-first ordering makes both "the newest MIN_BACKUPS" and "younger than
  // the cutoff" prefixes of the list, so everything kept is the longer prefix.
  const firstExpired = files.findIndex(
    (file, index) => index >= MIN_BACKUPS && file.mtimeMs < cutoff,
  );
  const keepCount = Math.min(firstExpired === -1 ? files.length : firstExpired, MAX_BACKUPS);

  for (const file of files.slice(keepCount)) {
    unlinkSync(file.path);
    console.log(`  pruned old backup: ${file.name}`);
  }
}

/**
 * `VACUUM INTO` is deterministic for identical database content, so comparing
 * the fresh snapshot against the newest existing one tells us whether anything
 * actually changed. This is what makes a restart storm harmless: every retry
 * snapshots the same bytes, so every retry after the first is a no-op instead
 * of another eviction from the retention window.
 */
function isDuplicateOf(candidate: string, previous: BackupFile | undefined): boolean {
  if (!previous) return false;
  if (statSync(candidate).size !== previous.size) return false;
  const digest = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
  return digest(candidate) === digest(previous.path);
}

/**
 * Snapshots the database. Returns the new backup's path, or `null` when the
 * database is byte-identical to the most recent backup and no file was written.
 */
function backup(): string | null {
  const dbPath = resolveDbPath();
  const dir = backupsDir(dbPath);
  mkdirSync(dir, { recursive: true });

  const previous = listBackups(dir)[0];
  const dest = join(dir, `${timestamp()}.db`);

  // Remove if exists (shouldn't happen with ms precision, but safety check)
  if (existsSync(dest)) {
    unlinkSync(dest);
  }

  const db = new Database(dbPath);
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  db.close();

  if (isDuplicateOf(dest, previous)) {
    unlinkSync(dest);
    console.log(`backup skipped: database unchanged since ${previous?.name}`);
    return null;
  }

  const sizeKB = (statSync(dest).size / 1024).toFixed(1);
  console.log(`backup created: ${dest} (${sizeKB} KB)`);

  pruneOldBackups(dir);
  return dest;
}

export { backup, resolveDbPath, backupsDir };

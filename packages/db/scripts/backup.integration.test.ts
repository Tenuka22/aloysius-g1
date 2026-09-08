import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, readdirSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  backup as BackupFn,
  backupsDir as BackupsDirFn,
  resolveDbPath as ResolveDbPathFn,
} from "./backup";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Mirrors MIN_BACKUPS in backup.ts. */
const MIN_BACKUPS = 10;

interface TestContext {
  databasePath: string;
  tempDir: string;
  backup: typeof BackupFn;
  dir: string;
}

let context: TestContext;

function listBackupNames(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".db"))
    .sort();
}

/** Writes a row so the next VACUUM INTO necessarily produces different bytes. */
function mutateDatabase(): void {
  const db = new Database(context.databasePath);
  db.exec("CREATE TABLE IF NOT EXISTS backup_probe (id INTEGER PRIMARY KEY, v TEXT)");
  db.exec(`INSERT INTO backup_probe (v) VALUES ('${crypto.randomUUID()}')`);
  db.close();
}

function ageBackups(names: string[], ageMs: number): void {
  const seconds = (Date.now() - ageMs) / 1000;
  for (const name of names) {
    utimesSync(join(context.dir, name), seconds, seconds);
  }
}

beforeAll(async () => {
  // These tests exercise snapshotting and retention, not the application
  // schema, so they provision a bare SQLite file rather than going through
  // test-utils' drizzle-kit push. DATABASE_URL is force-set (never inherited)
  // so a run can never touch a real database.
  const tempDir = mkdtempSync(join(tmpdir(), "aloysius-admissions-backup-"));
  const databasePath = join(tempDir, "test.db");
  new Database(databasePath).close();

  process.env.DATABASE_URL = databasePath;
  process.env.BETTER_AUTH_SECRET ??= "test-only-secret-at-least-32-characters-long";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  process.env.CORS_ORIGIN ??= "http://localhost:3001";
  process.env.NODE_ENV = "test";

  // Dynamic import required, not stylistic: backup.ts resolves DATABASE_URL
  // through @aloysius-admissions/env/server at module-load time, so a static
  // import would be hoisted above the assignments above and bind to the real
  // dev database instead of the throwaway one.
  const module = await import("./backup");
  const resolveDbPath: typeof ResolveDbPathFn = module.resolveDbPath;
  const backupsDir: typeof BackupsDirFn = module.backupsDir;
  context = { databasePath, tempDir, backup: module.backup, dir: backupsDir(resolveDbPath()) };
});

afterAll(() => rmSync(context.tempDir, { recursive: true, force: true }));

describe("backup", () => {
  it("writes a snapshot when the database has changed", () => {
    mutateDatabase();
    const created = context.backup();

    expect(created).not.toBeNull();
    expect(listBackupNames(context.dir)).toContain(created!.split(/[\\/]/).pop()!);
  });

  it("skips the snapshot when the database is unchanged", () => {
    const before = listBackupNames(context.dir);

    expect(context.backup()).toBeNull();
    expect(listBackupNames(context.dir)).toEqual(before);
  });

  /**
   * The regression this file exists for: a boot crash-loop under
   * `restart: unless-stopped` re-ran the backup once per restart and, with a
   * purely count-based window, evicted every real backup within seconds.
   */
  it("preserves existing history across a restart storm", () => {
    mutateDatabase();
    context.backup();
    const history = listBackupNames(context.dir);
    expect(history.length).toBeGreaterThan(0);

    for (let i = 0; i < 50; i++) {
      expect(context.backup()).toBeNull();
    }

    expect(listBackupNames(context.dir)).toEqual(history);
  });

  it("keeps backups that are still inside the retention window", () => {
    mutateDatabase();
    expect(context.backup()).not.toBeNull();

    ageBackups(listBackupNames(context.dir), 10 * DAY_MS);
    const aged = listBackupNames(context.dir);

    mutateDatabase();
    expect(context.backup()).not.toBeNull();

    expect(listBackupNames(context.dir)).toEqual(expect.arrayContaining(aged));
  });

  it("prunes backups past the retention window once the minimum is satisfied", () => {
    for (let i = 0; i < MIN_BACKUPS + 2; i++) {
      mutateDatabase();
      expect(context.backup()).not.toBeNull();
    }

    const names = listBackupNames(context.dir);
    expect(names.length).toBeGreaterThan(MIN_BACKUPS);

    const stale = names.slice(0, names.length - MIN_BACKUPS);
    ageBackups(stale, 90 * DAY_MS);

    mutateDatabase();
    expect(context.backup()).not.toBeNull();

    const remaining = listBackupNames(context.dir);
    for (const name of stale) {
      expect(remaining).not.toContain(name);
    }
    // The floor still holds: the newest MIN_BACKUPS survive regardless of age.
    expect(remaining.length).toBeGreaterThanOrEqual(MIN_BACKUPS);
  });
});

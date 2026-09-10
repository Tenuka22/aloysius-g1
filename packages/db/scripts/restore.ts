import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { env } from "@aloysius-admissions/env/server";
import { createClient } from "@libsql/client";
import { isRemoteDatabaseUrl, resolveDatabasePath } from "../src/path";

function resolveDbPath(): string {
  return resolveDatabasePath();
}

function backupsDir(dbPath: string): string {
  return join(dirname(dbPath), "backups");
}

function listBackups(
  dbPath: string,
): Array<{ name: string; path: string; size: string; date: Date }> {
  const dir = backupsDir(dbPath);
  mkdirSync(dir, { recursive: true });

  return readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => {
      const full = join(dir, f);
      const stat = statSync(full);
      const sizeKB = (stat.size / 1024).toFixed(1);
      return { name: f, path: full, size: `${sizeKB} KB`, date: stat.mtime };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

async function restore(target?: string): Promise<void> {
  // Turso's hosted databases have their own point-in-time recovery; this
  // file-based restore only applies to the local SQLite file used in dev.
  if (isRemoteDatabaseUrl(env.TURSO_DATABASE_URL)) {
    console.error(
      "restore is not supported against a remote Turso database; use Turso's point-in-time recovery instead (`turso db restore` or the Turso dashboard).",
    );
    process.exit(1);
  }

  const dbPath = resolveDbPath();
  const backups = listBackups(dbPath);

  if (backups.length === 0) {
    console.error("no backups found");
    process.exit(1);
  }

  let chosen;
  if (target) {
    chosen = backups.find((b) => b.name === target || b.path === target);
    if (!chosen) {
      console.error(`backup not found: ${target}`);
      console.log("available backups:");
      for (const b of backups) {
        console.log(`  ${b.name} (${b.size})`);
      }
      process.exit(1);
    }
  } else {
    chosen = backups[0];
    console.log("restoring latest backup:");
  }

  console.log(`  file: ${chosen.name}`);
  console.log(`  size: ${chosen.size}`);
  console.log(`  date: ${chosen.date.toISOString()}`);

  // Checkpoint WAL before restore
  const currentDb = createClient({ url: `file:${dbPath}` });
  await currentDb.execute("PRAGMA wal_checkpoint(TRUNCATE)");
  currentDb.close();

  copyFileSync(chosen.path, dbPath);
  console.log(`restored to: ${dbPath}`);
}

// Run if called directly
const targetArg = process.argv[2];
await restore(targetArg);

export { restore, listBackups };

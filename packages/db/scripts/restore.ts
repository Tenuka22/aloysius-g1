import { env } from "@aloysius-g1/env/server";
import { Database } from "bun:sqlite";
import { dirname, isAbsolute, join } from "node:path";
import { mkdirSync, readdirSync, statSync, copyFileSync } from "node:fs";

function resolveDbPath(): string {
  const configuredPath = env.DATABASE_URL.replace(/^file:/, "");
  return isAbsolute(configuredPath)
    ? configuredPath
    : join(import.meta.dir, "../../../", configuredPath.replace(/^([.][.][\\/])+/, ""));
}

function backupsDir(dbPath: string): string {
  return join(dirname(dbPath), "backups");
}

function listBackups(dbPath: string): Array<{ name: string; path: string; size: string; date: Date }> {
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

function restore(target?: string): void {
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
  const currentDb = new Database(dbPath);
  currentDb.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  currentDb.close();

  copyFileSync(chosen.path, dbPath);
  console.log(`restored to: ${dbPath}`);
}

// Run if called directly
const targetArg = process.argv[2];
restore(targetArg);

export { restore, listBackups };

import { env } from "@aloysius-g1/env/server";
import { Database } from "bun:sqlite";
import { dirname, isAbsolute, join } from "node:path";
import { mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from "node:fs";

const MAX_BACKUPS = 10;

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

function pruneOldBackups(dir: string): void {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => ({ name: f, time: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  for (const file of files.slice(MAX_BACKUPS)) {
    unlinkSync(join(dir, file.name));
    console.log(`  pruned old backup: ${file.name}`);
  }
}

function backup(): string {
  const dbPath = resolveDbPath();
  const dir = backupsDir(dbPath);
  mkdirSync(dir, { recursive: true });

  const dest = join(dir, `${timestamp()}.db`);

  // Remove if exists (shouldn't happen with ms precision, but safety check)
  if (existsSync(dest)) {
    unlinkSync(dest);
  }

  const db = new Database(dbPath);
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  db.close();

  const size = statSync(dest).size;
  const sizeKB = (size / 1024).toFixed(1);
  console.log(`backup created: ${dest} (${sizeKB} KB)`);

  pruneOldBackups(dir);
  return dest;
}

// Run if called directly
backup();

export { backup, resolveDbPath, backupsDir };

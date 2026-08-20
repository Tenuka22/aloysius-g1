import { env } from "@aloysius-g1/env/server";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { dirname, isAbsolute, join } from "node:path";
import { mkdirSync } from "node:fs";

import * as schema from "./schema";

export { applications } from "./schema/applications";

export function createDb() {
  const configuredPath = env.DATABASE_URL.replace(/^file:/, "");
  const databasePath = isAbsolute(configuredPath)
    ? configuredPath
    : join(import.meta.dir, "../../../", configuredPath.replace(/^([.][.][\\/])+/, ""));
  mkdirSync(dirname(databasePath), { recursive: true });
  return drizzle(new Database(databasePath), { schema });
}

export const db = createDb();

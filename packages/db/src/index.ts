import { env } from "@aloysius-admissions/env/server";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { dirname, isAbsolute, join } from "node:path";
import { mkdirSync } from "node:fs";

import * as schema from "./schema";

export {
  g1Applications,
  g1ApplicationSettings,
  g1ApplicationAccessRequests,
  g1ApplicationMarks,
  g1SchoolCoordinateOverrides,
} from "./schema/g1-logic";

export function createDb() {
  const configuredPath = env.DATABASE_URL.replace(/^file:/, "");
  const databasePath = isAbsolute(configuredPath)
    ? configuredPath
    : join(import.meta.dir, "../../../", configuredPath.replace(/^([.][.][\\/])+/, ""));
  mkdirSync(dirname(databasePath), { recursive: true });
  return drizzle(new Database(databasePath), { schema });
}

export const db = createDb();

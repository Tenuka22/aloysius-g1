import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";
import { resolveDatabasePath } from "./path";

export { resolveDatabasePath } from "./path";

export {
  g1Applications,
  g1ApplicationSettings,
  g1ApplicationAccessRequests,
  g1ApplicationMarks,
  g1SchoolCoordinateOverrides,
} from "./schema/g1-logic";

export function createDb() {
  const databasePath = resolveDatabasePath();
  mkdirSync(dirname(databasePath), { recursive: true });
  // better-sqlite3 rather than bun:sqlite: the server is a TanStack Start app
  // whose dev SSR environment runs under Node, which cannot load `bun:sqlite`.
  return drizzle(new Database(databasePath), { schema });
}

export const db = createDb();

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "@aloysius-admissions/env/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { isRemoteDatabaseUrl, resolveDatabasePath, resolveDatabaseUrl } from "./path";
import * as schema from "./schema";

export { resolveDatabasePath, resolveDatabaseUrl, isRemoteDatabaseUrl } from "./path";

export {
  g1Applications,
  g1ApplicationSettings,
  g1ApplicationAccessRequests,
  g1ApplicationMarks,
  g1SchoolCoordinateOverrides,
} from "./schema/g1-logic";

export function createDb() {
  // Local dev/test only: a remote Turso database needs no filesystem
  // directory, and resolveDatabasePath() throws for one.
  if (!isRemoteDatabaseUrl(env.TURSO_DATABASE_URL)) {
    mkdirSync(dirname(resolveDatabasePath()), { recursive: true });
  }
  const client = createClient({ url: resolveDatabaseUrl(), authToken: env.TURSO_AUTH_TOKEN });
  return drizzle(client, { schema });
}

export const db = createDb();

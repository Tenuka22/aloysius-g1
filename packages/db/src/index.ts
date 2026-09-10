import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "@aloysius-admissions/env/server";
import type { Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql/driver-core";

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

/** The shared server-side database handle. Only `@aloysius-admissions/api` may import this module. */
export type Database = LibSQLDatabase<typeof schema> & { $client: Client };

export async function createDb(): Promise<Database> {
  // Drizzle's default `drizzle-orm/libsql` entry statically imports the native
  // `@libsql/client`, whose module body eagerly `require()`s a
  // platform-specific binary the instant it loads. Bundlers inline that body
  // into the server chunk and run it on module load, so *any* import of the
  // default entry 500s every request on a host without the binary (e.g.
  // Vercel's serverless runtime). The granular `drizzle-orm/libsql/web` and
  // `.../node` entries each pull in only one client - `@libsql/client/web` (a
  // pure `fetch()` implementation, no native code) and `@libsql/client/node`
  // (native) respectively - so importing each *dynamically*, per branch,
  // keeps the native binary out of the module graph any remote deployment
  // ever loads. The native path is reached only for a local `file:` URL,
  // which self-hosted (Docker/Podman) deployments use and where the binary is
  // present.
  if (isRemoteDatabaseUrl(env.TURSO_DATABASE_URL)) {
    const { drizzle } = await import("drizzle-orm/libsql/web");
    return drizzle({
      connection: { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN },
      schema,
    });
  }

  mkdirSync(dirname(resolveDatabasePath()), { recursive: true });
  const { drizzle } = await import("drizzle-orm/libsql/node");
  return drizzle({ connection: { url: resolveDatabaseUrl() }, schema });
}

export const db = await createDb();

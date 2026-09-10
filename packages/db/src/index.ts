import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { env } from "@aloysius-admissions/env/server";
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

export async function createDb() {
  // The default `@libsql/client` (Node build) eagerly requires a
  // platform-specific native binary (e.g. `@libsql/linux-x64-gnu`) as soon as
  // it is imported, even when only talking to a remote database over HTTP.
  // Vercel's serverless file tracing does not see that dynamic require and
  // the binary 404s at runtime, so a remote Turso database must go through
  // `@libsql/client/web` instead - a pure `fetch()` implementation with no
  // native code. That variant cannot open a local `file:` URL, so local dev
  // keeps using the native client, imported dynamically so its native-binary
  // side effect never runs (and never needs bundling) in the deployed app.
  if (isRemoteDatabaseUrl(env.TURSO_DATABASE_URL)) {
    const { createClient } = await import("@libsql/client/web");
    const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
    return drizzle(client, { schema });
  }

  mkdirSync(dirname(resolveDatabasePath()), { recursive: true });
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url: resolveDatabaseUrl() });
  return drizzle(client, { schema });
}

export const db = await createDb();

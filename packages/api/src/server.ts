import {
  createAuth,
  ensureSiteAdmin as ensureSiteAdminWith,
  ensureSubAdmins as ensureSubAdminsWith,
} from "@aloysius-admissions/auth";
import { CLIENT_IP_HEADER } from "@aloysius-admissions/auth/client-ip-header";
import { db } from "@aloysius-admissions/db";

/**
 * Server-only surface the web app mounts.
 *
 * The app used to reach `@aloysius-admissions/auth` and `.../db` directly. It
 * now goes through this package instead, so the browser-facing app keeps a
 * single workspace dependency and nothing pulls the database driver toward the client
 * bundle by accident.
 */

/** The configured Better Auth instance, shared by the mounted handler. */
export const auth = createAuth(db);

export { CLIENT_IP_HEADER };

/** Seeds the site admin account, bound to this package's shared `db` and `auth`. */
export function ensureSiteAdmin(): Promise<void> {
  return ensureSiteAdminWith(db, auth);
}

/** Seeds every configured sub-admin account, bound to this package's shared `db` and `auth`. */
export function ensureSubAdmins(): Promise<void> {
  return ensureSubAdminsWith(db, auth);
}

export type DatabaseHealth = {
  status: "healthy" | "unhealthy";
  latencyMs: number;
};

/** Round-trips a trivial query so a probe can tell "serving HTML" from "serving data". */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const started = Date.now();
  try {
    await db.$client.execute("SELECT 1");
    return { status: "healthy", latencyMs: Date.now() - started };
  } catch {
    return { status: "unhealthy", latencyMs: Date.now() - started };
  }
}

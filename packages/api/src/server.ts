import { db } from "@aloysius-admissions/db";
import { createAuth, ensureSiteAdmin, ensureSubAdmins } from "@aloysius-admissions/auth";
import { CLIENT_IP_HEADER } from "@aloysius-admissions/auth/client-ip-header";
import { backup } from "@aloysius-admissions/db/scripts/backup";

/**
 * Server-only surface the web app mounts.
 *
 * The app used to reach `@aloysius-admissions/auth` and `.../db` directly. It
 * now goes through this package instead, so the browser-facing app keeps a
 * single workspace dependency and nothing pulls `bun:sqlite` toward the client
 * bundle by accident.
 */

/** The configured Better Auth instance, shared by the mounted handler. */
export const auth = createAuth();

export { CLIENT_IP_HEADER, ensureSiteAdmin, ensureSubAdmins, backup };

export type DatabaseHealth = {
  status: "healthy" | "unhealthy";
  latencyMs: number;
};

/** Round-trips a trivial query so a probe can tell "serving HTML" from "serving data". */
export function checkDatabaseHealth(): DatabaseHealth {
  const started = Date.now();
  try {
    db.$client.prepare("SELECT 1").get();
    return { status: "healthy", latencyMs: Date.now() - started };
  } catch {
    return { status: "unhealthy", latencyMs: Date.now() - started };
  }
}

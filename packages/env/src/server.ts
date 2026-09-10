import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    /** A `file:` path for local dev, or a `libsql://...-turso.io` URL in production. */
    TURSO_DATABASE_URL: z.string().min(1),
    /** Required when TURSO_DATABASE_URL is a remote Turso database; unused for a local file. */
    TURSO_AUTH_TOKEN: z.string().optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    ADMIN_PASSWORD: z.string().min(8).default("admin123456"),
    SUB_ADMIN_PASSWORD: z.string().min(8).default("subadmin123456"),
    /**
     * Comma-separated sub-admin logins seeded on boot. Each is created with
     * SUB_ADMIN_PASSWORD if missing and has its role reasserted every start,
     * so a sub-admin cannot silently lose access by being edited elsewhere.
     */
    SUB_ADMIN_EMAILS: z.string().default("subadmin@aloysiuscollege.lk"),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

export function getSubAdminEmails(): string[] {
  return env.SUB_ADMIN_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

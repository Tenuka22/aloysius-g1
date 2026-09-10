import type { Database } from "@aloysius-admissions/db";
import * as schema from "@aloysius-admissions/db/schema/auth";
import { env, getSubAdminEmails } from "@aloysius-admissions/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword } from "better-auth/crypto";
import { admin, multiSession } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq } from "drizzle-orm";
import { CLIENT_IP_HEADER } from "./client-ip-header";

const SITE_ADMIN_EMAIL = "admin@aloysiuscollege.lk";

/**
 * Logins whose role the system owns. The `databaseHooks` below reassert these
 * on every create and update, so a privileged account cannot drift to "user"
 * through an ordinary profile edit. Sub-admins are included because they were
 * previously absent: nothing seeded them and nothing pinned their role.
 */
const EMAIL_ROLES: Record<string, string> = {
  [SITE_ADMIN_EMAIL]: "admin",
  ...Object.fromEntries(getSubAdminEmails().map((email) => [email, "sub-admin"])),
};

function getAdminPassword(): string {
  return env.ADMIN_PASSWORD;
}

function getSubAdminPassword(): string {
  return env.SUB_ADMIN_PASSWORD;
}

export function createAuth(db: Database) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",

      schema: schema,
    }),
    // The app is served from a single origin now, so the only trusted origin
    // is its own public URL.
    trustedOrigins: [env.BETTER_AUTH_URL],
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
          input: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const role = EMAIL_ROLES[user.email?.toLowerCase() ?? ""];
            return { data: { ...user, role: role ?? user.role ?? "user" } };
          },
        },
        update: {
          before: async (user) => {
            const role = EMAIL_ROLES[user.email?.toLowerCase() ?? ""];
            return role ? { data: { ...user, role } } : { data: user };
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    session: {
      // Without this, every authClient.getSession() call (route beforeLoad
      // guards run this on every navigation) hits the DB to revalidate the
      // session token, adding a network+DB round trip before the page can
      // render. The cookie cache embeds a short-lived signed session copy in
      // the cookie itself so repeat calls within the window are free.
      cookieCache: {
        enabled: true,
        maxAge: 60, // seconds
      },
    },
    // better-auth turns on its own per-IP limiter in production by default,
    // with stricter buckets on the sign-in/sign-up paths. Kept off so the API
    // never answers 429 to a legitimate caller.
    rateLimit: {
      enabled: false,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      ipAddress: {
        ipAddressHeaders: [CLIENT_IP_HEADER],
      },
      defaultCookieAttributes: {
        // The API is served from the same origin as the app, so the cookie no
        // longer has to be a cross-site one. `none` would additionally force
        // `secure`, which breaks plain-http local development.
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        httpOnly: true,
      },
    },
    // tanstackStartCookies must stay last: it wraps the preceding plugins so
    // any Set-Cookie they produce is written through TanStack Start.
    plugins: [admin(), multiSession(), tanstackStartCookies()],
  });
}

/** The configured better-auth instance. Named here so callers depend on the
 * contract this module owns rather than on `typeof createAuth`. */
export type AuthInstance = ReturnType<typeof createAuth>;

export async function ensureSiteAdmin(db: Database, authInstance: AuthInstance) {
  const existing = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, SITE_ADMIN_EMAIL))
    .limit(1);
  const user = existing[0];

  if (!user) {
    const password = getAdminPassword();
    await authInstance.api.createUser({
      body: {
        email: SITE_ADMIN_EMAIL,
        password,
        name: "Site Admin",
        role: "admin",
      },
    });
    console.log(`[auth] Created site admin: ${SITE_ADMIN_EMAIL}`);
    console.log(`[auth] Password set from ADMIN_PASSWORD env var`);
    return;
  }

  const credentialAccount = await db
    .select()
    .from(schema.account)
    .where(eq(schema.account.userId, user.id))
    .limit(10);
  const existingCredential = credentialAccount.find(
    (account) => account.providerId === "credential",
  );

  if (!existingCredential) {
    const password = getAdminPassword();
    const hashed = await hashPassword(password);
    await db.insert(schema.account).values({
      id: crypto.randomUUID(),
      issuer: "credential",
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: hashed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`[auth] Added missing credential for site admin: ${SITE_ADMIN_EMAIL}`);
    console.log(`[auth] Password set from ADMIN_PASSWORD env var`);
  }

  await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, user.id));

  console.log(`[auth] Ensured site admin: ${SITE_ADMIN_EMAIL}`);
}

export async function ensureSubAdmin(
  db: Database,
  email: string,
  name: string,
  authInstance: AuthInstance,
) {
  const existing = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  const user = existing[0];

  if (!user) {
    const password = getSubAdminPassword();
    await authInstance.api.createUser({
      body: {
        email,
        password,
        name,
      },
    });
    const created = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);
    if (created[0]) {
      await db
        .update(schema.user)
        .set({ role: "sub-admin" })
        .where(eq(schema.user.id, created[0].id));
    }
    console.log(`[auth] Created sub-admin: ${email}`);
    console.log(`[auth] Password set from SUB_ADMIN_PASSWORD env var`);
    return;
  }

  const credentialAccount = await db
    .select()
    .from(schema.account)
    .where(eq(schema.account.userId, user.id))
    .limit(10);
  const existingCredential = credentialAccount.find(
    (account) => account.providerId === "credential",
  );

  if (!existingCredential) {
    const password = getSubAdminPassword();
    const hashed = await hashPassword(password);
    await db.insert(schema.account).values({
      id: crypto.randomUUID(),
      issuer: "credential",
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: hashed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`[auth] Added missing credential for sub-admin: ${email}`);
    console.log(`[auth] Password set from SUB_ADMIN_PASSWORD env var`);
  }

  await db.update(schema.user).set({ role: "sub-admin" }).where(eq(schema.user.id, user.id));

  console.log(`[auth] Ensured sub-admin: ${email}`);
}

/**
 * Seeds every login listed in SUB_ADMIN_EMAILS.
 *
 * `ensureSubAdmin` has existed for a while but nothing ever called it, so a
 * deployment started with an admin and no sub-admins at all. Failures are
 * logged per account rather than thrown: one bad address must not stop the
 * server from booting, the way a throw here previously would have.
 */
export async function ensureSubAdmins(db: Database, authInstance: AuthInstance) {
  const emails = getSubAdminEmails();
  if (emails.length === 0) {
    console.log("[auth] No SUB_ADMIN_EMAILS configured; skipping sub-admin seed");
    return;
  }

  for (const email of emails) {
    const name = email.split("@")[0] ?? "Sub Admin";
    try {
      await ensureSubAdmin(db, email, name, authInstance);
    } catch (error) {
      console.error(`[auth] Could not ensure sub-admin ${email}:`, error);
    }
  }
}

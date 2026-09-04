import { eq } from "drizzle-orm";
import { createDb } from "@aloysius-g1/db";
import * as schema from "@aloysius-g1/db/schema/auth";
import { env } from "@aloysius-g1/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword } from "better-auth/crypto";
import { admin, multiSession } from "better-auth/plugins";

const SITE_ADMIN_EMAIL = "admin@aloysiuscollege.lk";
const EMAIL_ROLES: Record<string, string> = {
  [SITE_ADMIN_EMAIL]: "admin",
};

/**
 * Generates a one-time random password for a freshly-provisioned admin account.
 * Never reused: printed once at creation time so the operator can hand it off
 * and the real admin can change it immediately.
 */
function generateTemporaryPassword(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",

      schema: schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
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
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [admin(), multiSession()],
  });
}

export const auth = createAuth();

export async function ensureSiteAdmin(authInstance: ReturnType<typeof createAuth> = auth) {
  const db = createDb();
  const existing = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, SITE_ADMIN_EMAIL))
    .limit(1);
  const user = existing[0];

  if (!user) {
    const password = generateTemporaryPassword();
    await authInstance.api.createUser({
      body: {
        email: SITE_ADMIN_EMAIL,
        password,
        name: "Site Admin",
        role: "admin",
      },
    });
    console.log(`[auth] Created site admin: ${SITE_ADMIN_EMAIL}`);
    console.log(`[auth] Temporary password (shown once, change immediately): ${password}`);
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
    // Site admin user exists (e.g. provisioned via another provider) but has no
    // password credential yet: create one with a fresh one-time password. An
    // existing credential's password is NEVER touched here, since rotating it
    // on every boot would silently undo any password the admin has since set.
    const password = generateTemporaryPassword();
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
    console.log(`[auth] Temporary password (shown once, change immediately): ${password}`);
  }

  await db
    .update(schema.user)
    .set({ role: "admin" })
    .where(eq(schema.user.id, user.id));

  console.log(`[auth] Ensured site admin: ${SITE_ADMIN_EMAIL}`);
}

export async function ensureSubAdmin(
  email: string,
  name: string,
  authInstance: ReturnType<typeof createAuth> = auth,
) {
  const db = createDb();
  const existing = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);
  const user = existing[0];

  if (!user) {
    const password = generateTemporaryPassword();
    await authInstance.api.createUser({
      body: {
        email,
        password,
        name,
      },
    });
    const created = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
    if (created[0]) {
      await db.update(schema.user).set({ role: "sub-admin" }).where(eq(schema.user.id, created[0].id));
    }
    console.log(`[auth] Created sub-admin: ${email}`);
    console.log(`[auth] Temporary password (shown once, change immediately): ${password}`);
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
    // Sub-admin user exists but has no password credential yet: create one with
    // a fresh one-time password. An existing credential's password is NEVER
    // touched here, since rotating it on every run would silently undo a password
    // the sub-admin has since set.
    const password = generateTemporaryPassword();
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
    console.log(`[auth] Temporary password (shown once, change immediately): ${password}`);
  }

  await db
    .update(schema.user)
    .set({ role: "sub-admin" })
    .where(eq(schema.user.id, user.id));

  console.log(`[auth] Ensured sub-admin: ${email}`);
}

import { eq } from "drizzle-orm";
import { createDb } from "@aloysius-g1/db";
import * as schema from "@aloysius-g1/db/schema/auth";
import { env } from "@aloysius-g1/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword } from "better-auth/crypto";
import { admin } from "better-auth/plugins";

const SITE_ADMIN_EMAIL = "admin@aloysiuscollege.lk";
const SITE_ADMIN_PASSWORD = "12345678";
const EMAIL_ROLES: Record<string, string> = {
  [SITE_ADMIN_EMAIL]: "admin",
};

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
    plugins: [admin()],
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
    await authInstance.api.createUser({
      body: {
        email: SITE_ADMIN_EMAIL,
        password: SITE_ADMIN_PASSWORD,
        name: "Site Admin",
        role: "admin",
      },
    });
    console.log(`[auth] Created site admin: ${SITE_ADMIN_EMAIL}`);
    return;
  }

  const password = await hashPassword(SITE_ADMIN_PASSWORD);
  const credentialAccount = await db
    .select()
    .from(schema.account)
    .where(eq(schema.account.userId, user.id))
    .limit(10);
  const existingCredential = credentialAccount.find(
    (account) => account.providerId === "credential",
  );

  if (existingCredential) {
    await db
      .update(schema.account)
      .set({ password })
      .where(eq(schema.account.id, existingCredential.id));
  } else {
    await db.insert(schema.account).values({
      id: crypto.randomUUID(),
      issuer: "credential",
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await db
    .update(schema.user)
    .set({ role: "admin" })
    .where(eq(schema.user.id, user.id));

  console.log(`[auth] Ensured site admin: ${SITE_ADMIN_EMAIL}`);
}

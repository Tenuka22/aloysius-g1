import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import * as authSchema from "@aloysius-admissions/db/schema/auth";
import { type TestDatabase, provisionTestDatabase } from "@aloysius-admissions/db/test-utils";
import type { Auth } from "better-auth";
import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type {
  createAuth as CreateAuthFn,
  ensureSiteAdmin as EnsureSiteAdminFn,
  ensureSubAdmin as EnsureSubAdminFn,
} from "./index";

type AuthSchema = typeof authSchema;

interface TestContext {
  testDb: TestDatabase;
  ensureSiteAdmin: typeof EnsureSiteAdminFn;
  ensureSubAdmin: typeof EnsureSubAdminFn;
  db: LibSQLDatabase<AuthSchema>;
  auth: Auth;
}

/**
 * Dynamic imports here are required, not stylistic: packages/auth/src/index.ts
 * and @aloysius-admissions/db both call createDb()/createAuth() as a *module-load-time*
 * side effect (`export const auth = createAuth()`, `export const db =
 * createDb()`), which reads TURSO_DATABASE_URL/BETTER_AUTH_SECRET from process.env at
 * that instant. A static import would be hoisted and evaluated before
 * provisionTestDatabase() has set those vars, silently binding to the wrong
 * (or no) database.
 *
 * This file runs under `bun test` (see package.json's "test:integration"),
 * not vitest, matching the other integration suites in this repo.
 */
async function setUpTestContext(): Promise<TestContext> {
  const testDb = provisionTestDatabase();
  const authModule = await import("./index");
  const dbModule = await import("@aloysius-admissions/db");
  const createAuthFn: typeof CreateAuthFn = authModule.createAuth;
  return {
    testDb,
    ensureSiteAdmin: authModule.ensureSiteAdmin,
    ensureSubAdmin: authModule.ensureSubAdmin,
    db: dbModule.createDb(),
    auth: createAuthFn(),
  };
}

let context: TestContext;

const SITE_ADMIN_EMAIL = "admin@aloysiuscollege.lk";
const OLD_HARDCODED_PASSWORD = "12345678";

/** Extracts every one-time password printed via console.log during `run()`. */
async function capturePrintedPasswords(run: () => Promise<void>): Promise<string[]> {
  const spy = spyOn(console, "log").mockImplementation(() => undefined);
  await run();
  const passwords = spy.mock.calls
    .map((call) => String(call[0]))
    .map((line) => line.match(/Temporary password \(shown once, change immediately\): (.+)$/)?.[1])
    .filter((password): password is string => Boolean(password));
  spy.mockRestore();
  return passwords;
}

async function credentialAccountFor(email: string) {
  const [user] = await context.db
    .select()
    .from(authSchema.user)
    .where(eq(authSchema.user.email, email))
    .limit(1);
  if (!user) return { user: undefined, credential: undefined };
  const accounts = await context.db
    .select()
    .from(authSchema.account)
    .where(eq(authSchema.account.userId, user.id));
  return { user, credential: accounts.find((account) => account.providerId === "credential") };
}

beforeAll(async () => {
  context = await setUpTestContext();
});

afterAll(() => {
  context.testDb.cleanup();
});

describe("ensureSiteAdmin", () => {
  it("creates the site admin with a random one-time password, not a hardcoded one", async () => {
    const passwords = await capturePrintedPasswords(() => context.ensureSiteAdmin(context.auth));

    expect(passwords).toHaveLength(1);
    const [generatedPassword] = passwords;
    expect(generatedPassword).not.toBe(OLD_HARDCODED_PASSWORD);
    expect(generatedPassword!.length).toBeGreaterThanOrEqual(32);

    const { user, credential } = await credentialAccountFor(SITE_ADMIN_EMAIL);
    expect(user?.role).toBe("admin");
    expect(credential).toBeDefined();

    await expect(
      context.auth.api.signInEmail({
        body: { email: SITE_ADMIN_EMAIL, password: generatedPassword! },
      }),
    ).resolves.toBeDefined();

    await expect(
      context.auth.api.signInEmail({
        body: { email: SITE_ADMIN_EMAIL, password: OLD_HARDCODED_PASSWORD },
      }),
    ).rejects.toBeDefined();
  });

  it("never touches the password on a subsequent run (regression: used to silently reset it every boot)", async () => {
    const { credential: before } = await credentialAccountFor(SITE_ADMIN_EMAIL);

    const passwords = await capturePrintedPasswords(() => context.ensureSiteAdmin(context.auth));
    expect(passwords).toHaveLength(0);

    const { credential: after } = await credentialAccountFor(SITE_ADMIN_EMAIL);
    expect(after?.password).toBe(before?.password);
  });

  it("still ensures the admin role even when the account already exists", async () => {
    await context.db
      .update(authSchema.user)
      .set({ role: "user" })
      .where(eq(authSchema.user.email, SITE_ADMIN_EMAIL));
    await context.ensureSiteAdmin(context.auth);
    const { user } = await credentialAccountFor(SITE_ADMIN_EMAIL);
    expect(user?.role).toBe("admin");
  });
});

describe("ensureSubAdmin", () => {
  const email = "sub-admin@aloysiuscollege.lk";

  it("creates a sub-admin with a random one-time password, not a hardcoded one", async () => {
    const passwords = await capturePrintedPasswords(() =>
      context.ensureSubAdmin(email, "Sub Admin", context.auth),
    );

    expect(passwords).toHaveLength(1);
    const [generatedPassword] = passwords;
    expect(generatedPassword).not.toBe(OLD_HARDCODED_PASSWORD);

    const { user, credential } = await credentialAccountFor(email);
    expect(user?.role).toBe("sub-admin");
    expect(credential).toBeDefined();

    await expect(
      context.auth.api.signInEmail({ body: { email, password: generatedPassword! } }),
    ).resolves.toBeDefined();
  });

  it("never touches the password on a subsequent run", async () => {
    const { credential: before } = await credentialAccountFor(email);

    const passwords = await capturePrintedPasswords(() =>
      context.ensureSubAdmin(email, "Sub Admin", context.auth),
    );
    expect(passwords).toHaveLength(0);

    const { credential: after } = await credentialAccountFor(email);
    expect(after?.password).toBe(before?.password);
  });
});

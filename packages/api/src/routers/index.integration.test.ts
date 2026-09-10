import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { type TestDatabase, provisionTestDatabase } from "@aloysius-admissions/db/test-utils";
import { ORPCError, call } from "@orpc/server";
import type { Context } from "../context";
import type { appRouter as AppRouter } from "./index";

interface TestContext {
  testDb: TestDatabase;
  appRouter: typeof AppRouter;
}

/** Minimal shape this test file reads back out of an application's `data` JSON blob. */
type ApplicantFixture = { applicant?: { fullName?: string } };

function applicantFullName(data: unknown): string | undefined {
  // `data` is our own test fixture, not untrusted input - its shape is known and
  // controlled by the `application.create`/`update` calls right above each read.
  const fixture = data as ApplicantFixture;
  return fixture.applicant?.fullName;
}

/**
 * Dynamic import is required, not stylistic: importing `./index` transitively
 * imports `@aloysius-admissions/db`, which calls `createDb()` as a
 * module-load-time side effect (`export const db = await createDb()`), which
 * reads TURSO_DATABASE_URL from process.env at that instant. A static import
 * would be hoisted and evaluated before provisionTestDatabase() has set that
 * var, silently binding to the wrong (or no) database.
 *
 * This file runs under `bun test` (see package.json's "test:integration"),
 * not vitest, matching the other integration suites in this repo.
 */
async function setUpTestContext(): Promise<TestContext> {
  const testDb = provisionTestDatabase();
  const routerModule = await import("./index");
  return { testDb, appRouter: routerModule.appRouter };
}

let context: TestContext;

function anonymousContext(): Context {
  return { auth: null, session: null };
}

function userContext(role: "user" | "admin" | "sub-admin", id = "test-user"): Context {
  // Only the fields auth-policy.ts and the procedures under test actually read
  // (session.user.role / session.user.id) are populated; better-auth's full
  // Session shape has many more fields no handler here touches.
  const session = { session: {}, user: { id, role } } as unknown as Context["session"];
  return { auth: null, session };
}

async function openSubmissionWindow(intakeYear: string) {
  await call(
    context.appRouter.admin.settings.update,
    { opensAt: "2000-01-01T00:00:00.000Z", closesAt: "2100-01-01T00:00:00.000Z", intakeYear },
    { context: userContext("admin") },
  );
}

beforeAll(async () => {
  context = await setUpTestContext();
});

afterAll(() => {
  context.testDb.cleanup();
});

describe("admin procedure guard", () => {
  it("rejects an unauthenticated caller with UNAUTHORIZED", async () => {
    await expect(
      call(
        context.appRouter.admin.overview,
        { intakeYear: "2027" },
        { context: anonymousContext() },
      ),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a signed-in non-admin caller with FORBIDDEN", async () => {
    await expect(
      call(
        context.appRouter.admin.overview,
        { intakeYear: "2027" },
        { context: userContext("user") },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an admin caller through", async () => {
    const result = await call(
      context.appRouter.admin.overview,
      { intakeYear: "2027" },
      { context: userContext("admin") },
    );
    expect(result).toHaveProperty("total");
  });
});

describe("application create → get → update → submit", () => {
  const intakeYear = "2031-app-flow";

  beforeAll(async () => {
    await openSubmissionWindow(intakeYear);
  });

  it("round-trips a full application lifecycle", async () => {
    const created = await call(
      context.appRouter.application.create,
      { data: { applicant: { fullName: "Integration Test Applicant" } }, intakeYear },
      { context: anonymousContext() },
    );
    expect(created.accessKey).toMatch(/^ALY-/);

    const fetched = await call(
      context.appRouter.application.get,
      { accessKey: created.accessKey },
      { context: anonymousContext() },
    );
    expect(applicantFullName(fetched.data)).toBe("Integration Test Applicant");
    expect(fetched.submittedAt).toBeNull();

    await call(
      context.appRouter.application.update,
      { accessKey: created.accessKey, data: { applicant: { fullName: "Updated Name" } } },
      { context: anonymousContext() },
    );
    const afterUpdate = await call(
      context.appRouter.application.get,
      { accessKey: created.accessKey },
      { context: anonymousContext() },
    );
    expect(applicantFullName(afterUpdate.data)).toBe("Updated Name");

    await call(
      context.appRouter.application.submit,
      { accessKey: created.accessKey },
      { context: anonymousContext() },
    );
    const afterSubmit = await call(
      context.appRouter.application.get,
      { accessKey: created.accessKey },
      { context: anonymousContext() },
    );
    expect(afterSubmit.submittedAt).not.toBeNull();
  });

  it("never leaks one application to a different application's access key (no IDOR)", async () => {
    const first = await call(
      context.appRouter.application.create,
      { data: { applicant: { fullName: "Applicant One" } }, intakeYear },
      { context: anonymousContext() },
    );
    const second = await call(
      context.appRouter.application.create,
      { data: { applicant: { fullName: "Applicant Two" } }, intakeYear },
      { context: anonymousContext() },
    );

    const fetchedFirst = await call(
      context.appRouter.application.get,
      { accessKey: first.accessKey },
      { context: anonymousContext() },
    );
    const fetchedSecond = await call(
      context.appRouter.application.get,
      { accessKey: second.accessKey },
      { context: anonymousContext() },
    );
    expect(applicantFullName(fetchedFirst.data)).toBe("Applicant One");
    expect(applicantFullName(fetchedSecond.data)).toBe("Applicant Two");
  });

  it("rejects an access key that does not exist with NOT_FOUND", async () => {
    await expect(
      call(
        context.appRouter.application.get,
        { accessKey: "ALY-this-key-was-never-issued-by-anyone-00000000" },
        { context: anonymousContext() },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("intake year isolation", () => {
  const yearA = "2032-isolation-a";
  const yearB = "2032-isolation-b";

  beforeAll(async () => {
    await openSubmissionWindow(yearA);
    await openSubmissionWindow(yearB);
    await call(
      context.appRouter.application.create,
      { data: { applicant: { fullName: "Year A Applicant 1" } }, intakeYear: yearA },
      { context: anonymousContext() },
    );
    await call(
      context.appRouter.application.create,
      { data: { applicant: { fullName: "Year A Applicant 2" } }, intakeYear: yearA },
      { context: anonymousContext() },
    );
    await call(
      context.appRouter.application.create,
      { data: { applicant: { fullName: "Year B Applicant 1" } }, intakeYear: yearB },
      { context: anonymousContext() },
    );
  });

  it("admin.overview only counts applications for the requested intake year", async () => {
    const overviewA = await call(
      context.appRouter.admin.overview,
      { intakeYear: yearA },
      { context: userContext("admin") },
    );
    const overviewB = await call(
      context.appRouter.admin.overview,
      { intakeYear: yearB },
      { context: userContext("admin") },
    );
    expect(overviewA.total).toBe(2);
    expect(overviewB.total).toBe(1);
  });

  it("admin.settings for one year never leaks into another year", async () => {
    const unconfiguredYear = "2032-never-configured";
    const settings = await call(
      context.appRouter.admin.settings.get,
      { intakeYear: unconfiguredYear },
      { context: userContext("admin") },
    );
    expect(settings).toBeNull();

    const configured = await call(
      context.appRouter.admin.settings.get,
      { intakeYear: yearA },
      { context: userContext("admin") },
    );
    expect(configured).not.toBeNull();
  });
});

describe("application marks: applicant-submitted vs admin-authoritative isolation", () => {
  const intakeYear = "2033-marks";
  let applicationId: string;
  let accessKey: string;

  beforeAll(async () => {
    await openSubmissionWindow(intakeYear);
    const created = await call(
      context.appRouter.application.create,
      { data: { applicant: { fullName: "Marks Test Applicant" } }, intakeYear },
      { context: anonymousContext() },
    );
    accessKey = created.accessKey;

    // application.get doesn't return the row id; look it up via the admin
    // overview's "recent" list, matching on the fixture's unique applicant name.
    const overview = await call(
      context.appRouter.admin.overview,
      { intakeYear },
      { context: userContext("admin") },
    );
    const record = overview.recent.find((entry) => entry.applicantName === "Marks Test Applicant");
    expect(record).toBeDefined();
    applicationId = record!.id;
  });

  it("a forged applicant-submitted mark never appears in the admin's authoritative view", async () => {
    await call(
      context.appRouter.application.saveIndicativeMarks,
      {
        accessKey,
        marks: [
          {
            categoryType: "6.1",
            total: 100,
            breakdown: [{ label: "Forged", marks: 100, max: 100 }],
          },
        ],
      },
      { context: anonymousContext() },
    );

    const adminMarks = await call(
      context.appRouter.admin.admissions.getMarks,
      { applicationId },
      { context: userContext("admin") },
    );
    expect(adminMarks).toHaveLength(0);
  });

  it("an admin-saved mark never appears in the applicant's own indicative-marks view", async () => {
    await call(
      context.appRouter.admin.admissions.saveMarks,
      {
        applicationId,
        categoryType: "6.1",
        breakdown: [{ label: "Verified", marks: 42, max: 100 }],
        total: 42,
      },
      { context: userContext("admin") },
    );

    const applicantMarks = await call(
      context.appRouter.application.getMarks,
      { accessKey },
      { context: anonymousContext() },
    );
    // The applicant's own view must still only ever show their own earlier
    // submission (from the previous test in this block) - never the admin's
    // "Verified"/42 mark that was just saved for the same category.
    expect(applicantMarks).toHaveLength(1);
    expect(applicantMarks[0]?.total).toBe(100);
    expect(applicantMarks[0]?.total).not.toBe(42);

    const adminMarks = await call(
      context.appRouter.admin.admissions.getMarks,
      { applicationId },
      { context: userContext("admin") },
    );
    expect(adminMarks).toHaveLength(1);
    expect(adminMarks[0]?.total).toBe(42);
  });

  it("rejects an out-of-range indicative mark", async () => {
    await expect(
      call(
        context.appRouter.application.saveIndicativeMarks,
        {
          accessKey,
          marks: [
            {
              categoryType: "6.1",
              total: 999,
              breakdown: [{ label: "Too high", marks: 999, max: 100 }],
            },
          ],
        },
        { context: anonymousContext() },
      ),
    ).rejects.toBeInstanceOf(ORPCError);
  });
});

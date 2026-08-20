import { EventPublisher, eventIterator } from "@orpc/server";
import type { RouterClient } from "@orpc/server";

import { adminProcedure, protectedProcedure, publicProcedure } from "../index";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { createDb } from "@aloysius-g1/db";
import { applications } from "@aloysius-g1/db";
import { eq } from "drizzle-orm";
import { env } from "@aloysius-g1/env/server";

const db = createDb();
const draftSchema = z.record(z.string(), z.unknown());
const withoutSchoolPreferences = (data: Record<string, unknown>) => {
  const { schools: _removed, ...sanitized } = data;
  return sanitized;
};
const keySchema = z.string().min(32).max(128);
const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
const createAccessKey = () => `ALY-${randomBytes(32).toString("base64url")}`;
const submissionOpensAt = new Date("2026-09-09T00:00:00+05:30");
const updatesCloseAt = new Date("2026-09-12T00:00:00+05:30");
const submissionLocked = () => env.NODE_ENV === "production" && new Date() < submissionOpensAt;
const applicationEvents = new EventPublisher<{ "application-count": { count: number } }>();
const applicationCount = async () => (await db.select({ id: applications.id }).from(applications).all()).length;
const publishApplicationChange = async () => applicationEvents.publish("application-count", { count: await applicationCount() });
const applicationRecord = (row: typeof applications.$inferSelect) => {
  const data = row.data as { applicant?: { fullName?: string; gender?: string; religion?: string; educationMedium?: string; dateOfBirth?: string; birthCertificateNumber?: string }; guardian?: { email?: string }; location?: { latitude?: number | null; longitude?: number | null } };
  const email = data.guardian?.email?.trim() ?? "";
  const errors = [
    !data.applicant?.fullName && "missing_full_name",
    !data.applicant?.birthCertificateNumber && "missing_birth_certificate",
    !data.applicant?.dateOfBirth && "missing_date_of_birth",
    data.applicant?.gender === "Female" && "female_applicant",
    ["Catholic", "Christian"].includes(data.applicant?.religion ?? "") && "restricted_religion",
    email && !/^\S+@\S+\.\S+$/.test(email) && "invalid_email",
    (data.location?.latitude == null || data.location?.longitude == null) && "missing_location",
  ].filter(Boolean) as string[];
  return { id: row.id, applicantName: data.applicant?.fullName || "Unnamed applicant", status: row.submittedAt ? "submitted" : "draft", createdAt: row.createdAt, updatedAt: row.updatedAt, submittedAt: row.submittedAt, accessKeyHint: row.accessKeyHint, validationErrors: errors };
};

export const appRouter = {
  application: {
    create: publicProcedure.input(z.object({ data: draftSchema })).handler(async ({ input }) => {
      const accessKey = createAccessKey();
      const now = new Date();
      const birthCertificateNumber = typeof input.data.applicant === "object" && input.data.applicant !== null && "birthCertificateNumber" in input.data.applicant
        ? String((input.data.applicant as { birthCertificateNumber?: unknown }).birthCertificateNumber ?? "").trim().toUpperCase()
        : "";
      if (!birthCertificateNumber) throw new Error("Birth certificate number is required");
      const existing = await db.select({ id: applications.id }).from(applications).where(eq(applications.birthCertificateNumber, birthCertificateNumber)).get();
      if (existing) throw new Error("An application already exists for this birth certificate number");
      const data = withoutSchoolPreferences(input.data);
      await db.insert(applications).values({ id: randomUUID(), accessKeyHash: hashKey(accessKey), accessKeyHint: accessKey.slice(-6), birthCertificateNumber, data, createdAt: now, updatedAt: now });
      await publishApplicationChange();
      return { accessKey, data };
    }),
    get: publicProcedure.input(z.object({ accessKey: keySchema })).handler(async ({ input }) => {
      const row = await db.select().from(applications).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!row) throw new Error("Application key not found");
      return { data: withoutSchoolPreferences(row.data as Record<string, unknown>), updatedAt: row.updatedAt, accessKeyHint: row.accessKeyHint };
    }),
    remove: publicProcedure.input(z.object({ accessKey: keySchema })).handler(async ({ input }) => {
      const row = await db.select({ id: applications.id }).from(applications).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!row) throw new Error("Application key not found");
      await db.delete(applications).where(eq(applications.id, row.id)).run();
      await publishApplicationChange();
      return { deleted: true };
    }),
    liveCount: publicProcedure.output(eventIterator(z.object({ count: z.number() }))).handler(async function* ({ signal }) {
      yield { count: await applicationCount() };
      for await (const payload of applicationEvents.subscribe("application-count", { signal })) yield payload;
    }),
    count: publicProcedure.handler(async () => ({ count: await applicationCount() })),
    update: publicProcedure.input(z.object({ accessKey: keySchema, data: draftSchema })).handler(async ({ input }) => {
      const updatedAt = new Date();
      const birthCertificateNumber = typeof input.data.applicant === "object" && input.data.applicant !== null && "birthCertificateNumber" in input.data.applicant
        ? String((input.data.applicant as { birthCertificateNumber?: unknown }).birthCertificateNumber ?? "").trim().toUpperCase()
        : "";
      if (!birthCertificateNumber) throw new Error("Birth certificate number is required");
      const current = await db.select({ id: applications.id }).from(applications).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!current) throw new Error("Application key not found");
      const currentRecord = await db.select({ submittedAt: applications.submittedAt }).from(applications).where(eq(applications.id, current.id)).get();
      if (currentRecord?.submittedAt && updatedAt >= updatesCloseAt) throw new Error("Updates closed on 11 September 2026");
      const duplicate = await db.select({ id: applications.id }).from(applications).where(eq(applications.birthCertificateNumber, birthCertificateNumber)).get();
      if (duplicate && duplicate.id !== current?.id) throw new Error("An application already exists for this birth certificate number");
      await db.update(applications).set({ birthCertificateNumber, data: withoutSchoolPreferences(input.data), updatedAt }).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).run();
      await publishApplicationChange();
      return { updatedAt };
    }),
    status: publicProcedure.handler(() => ({ submissionLocked: submissionLocked(), submissionOpensAt: submissionOpensAt.toISOString(), environment: env.NODE_ENV })),
    submit: publicProcedure.input(z.object({ accessKey: keySchema })).handler(async ({ input }) => {
      if (submissionLocked()) throw new Error("Submissions open on 9 September 2026");
      const row = await db.select({ id: applications.id }).from(applications).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!row) throw new Error("Application key not found");
      await db.update(applications).set({ submittedAt: new Date(), updatedAt: new Date() }).where(eq(applications.id, row.id)).run();
      await publishApplicationChange();
      return { accepted: true };
    }),
  },
  admin: {
    overview: adminProcedure.handler(async () => {
      const rows = await db.select().from(applications).all();
      const records = rows.map(applicationRecord);
      return { total: records.length, drafts: records.filter((record) => record.status === "draft").length, submitted: records.filter((record) => record.status === "submitted").length, invalidEmail: records.filter((record) => record.validationErrors.includes("invalid_email")).length, incomplete: records.filter((record) => record.validationErrors.length > 0).length, recent: records.slice().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 10) };
    }),
    applications: adminProcedure.input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(25), query: z.string().trim().default("") })).handler(async ({ input }) => {
      const all = (await db.select().from(applications).all()).map(applicationRecord).filter((record) => record.applicantName.toLowerCase().includes(input.query.toLowerCase()) || record.accessKeyHint.toLowerCase().includes(input.query.toLowerCase()));
      const start = (input.page - 1) * input.pageSize;
      return { total: all.length, page: input.page, pageSize: input.pageSize, items: all.slice(start, start + input.pageSize) };
    }),
    application: {
      get: adminProcedure.input(z.object({ id: z.string().uuid() })).handler(async ({ input }) => {
        const row = await db.select().from(applications).where(eq(applications.id, input.id)).get();
        if (!row) throw new Error("Application not found");
        return { id: row.id, data: withoutSchoolPreferences(row.data as Record<string, unknown>), createdAt: row.createdAt, updatedAt: row.updatedAt, submittedAt: row.submittedAt };
      }),
      update: adminProcedure.input(z.object({ id: z.string().uuid(), data: draftSchema })).handler(async ({ input }) => {
        const updatedAt = new Date();
        const birthCertificateNumber = typeof input.data.applicant === "object" && input.data.applicant !== null && "birthCertificateNumber" in input.data.applicant
          ? String((input.data.applicant as { birthCertificateNumber?: unknown }).birthCertificateNumber ?? "").trim().toUpperCase() : "";
        if (!birthCertificateNumber) throw new Error("Birth certificate number is required");
        const duplicate = await db.select({ id: applications.id }).from(applications).where(eq(applications.birthCertificateNumber, birthCertificateNumber)).get();
        if (duplicate && duplicate.id !== input.id) throw new Error("An application already exists for this birth certificate number");
        const changed = await db.update(applications).set({ birthCertificateNumber, data: withoutSchoolPreferences(input.data), updatedAt }).where(eq(applications.id, input.id)).run();
        if (!changed.changes) throw new Error("Application not found");
        await publishApplicationChange();
        return { updatedAt };
      }),
      remove: adminProcedure.input(z.object({ id: z.string().uuid() })).handler(async ({ input }) => {
        const deleted = await db.delete(applications).where(eq(applications.id, input.id)).run();
        if (!deleted.changes) throw new Error("Application not found");
        await publishApplicationChange();
        return { deleted: true };
      }),
    },
  },
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;

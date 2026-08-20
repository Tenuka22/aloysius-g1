import { EventPublisher, eventIterator } from "@orpc/server";
import type { RouterClient } from "@orpc/server";

import { adminProcedure, protectedProcedure, publicProcedure } from "../index";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { createDb } from "@aloysius-g1/db";
import { applicationAccessRequests, applicationSettings, applications } from "@aloysius-g1/db";
import { and, eq } from "drizzle-orm";
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
const createSessionCode = () => `26${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
const uniqueSessionCode = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const sessionCode = createSessionCode();
    const existing = await db.select({ id: applications.id }).from(applications).where(eq(applications.sessionCode, sessionCode)).get();
    if (!existing) return sessionCode;
  }
  throw new Error("Could not allocate an application session code");
};
const ensureSessionCode = async (row: typeof applications.$inferSelect) => {
  if (row.sessionCode) return row.sessionCode;
  const sessionCode = await uniqueSessionCode();
  await db.update(applications).set({ sessionCode }).where(eq(applications.id, row.id)).run();
  return sessionCode;
};
const defaultOpensAt = new Date("2026-09-09T00:00:00+05:30");
const defaultClosesAt = new Date("2026-09-12T00:00:00+05:30");
const getApplicationWindow = async () => {
  const existing = await db.select().from(applicationSettings).where(eq(applicationSettings.id, "default")).get();
  if (existing) return existing;
  const now = new Date();
  const defaults = { id: "default", opensAt: defaultOpensAt, closesAt: defaultClosesAt, updatedAt: now };
  await db.insert(applicationSettings).values(defaults).onConflictDoNothing();
  return (await db.select().from(applicationSettings).where(eq(applicationSettings.id, "default")).get()) ?? defaults;
};
const submissionLocked = (window: { opensAt: Date; closesAt: Date }) => new Date() < window.opensAt || new Date() > window.closesAt;
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
  return { id: row.id, sessionCode: row.sessionCode, applicantName: data.applicant?.fullName || "Unnamed applicant", status: row.submittedAt ? "submitted" : "draft", createdAt: row.createdAt, updatedAt: row.updatedAt, submittedAt: row.submittedAt, accessKeyHint: row.accessKeyHint, validationErrors: errors };
};

export const appRouter = {
  application: {
    create: publicProcedure.input(z.object({ data: draftSchema.default({}) })).handler(async ({ input }) => {
      const accessKey = createAccessKey();
      const sessionCode = await uniqueSessionCode();
      const now = new Date();
      const window = await getApplicationWindow();
      if (submissionLocked(window)) throw new Error("New applications can only be created during the configured form window");
      const birthCertificateNumber = typeof input.data.applicant === "object" && input.data.applicant !== null && "birthCertificateNumber" in input.data.applicant
        ? String((input.data.applicant as { birthCertificateNumber?: unknown }).birthCertificateNumber ?? "").trim().toUpperCase()
        : "";
      const data = withoutSchoolPreferences(input.data);
      const existing = birthCertificateNumber ? await db.select({ id: applications.id }).from(applications).where(eq(applications.birthCertificateNumber, birthCertificateNumber)).get() : null;
      if (existing) throw new Error("An application already exists for this birth certificate number");
      await db.insert(applications).values({ id: randomUUID(), sessionCode, accessKeyHash: hashKey(accessKey), accessKeyHint: accessKey.slice(-6), birthCertificateNumber: birthCertificateNumber || null, data, createdAt: now, updatedAt: now });
      await publishApplicationChange();
      return { accessKey, sessionCode, data };
    }),
    lookup: publicProcedure.input(z.object({ sessionCode: z.string().regex(/^\d{2}[A-Z]{3}\d{3}$/) })).handler(async ({ input }) => {
      const row = await db.select({ sessionCode: applications.sessionCode, data: applications.data, submittedAt: applications.submittedAt, updatedAt: applications.updatedAt }).from(applications).where(eq(applications.sessionCode, input.sessionCode.toUpperCase())).get();
      if (!row) throw new Error("Application session not found");
      const data = row.data as { applicant?: { fullName?: string } };
      return { sessionCode: row.sessionCode, applicantName: data.applicant?.fullName || "Unnamed applicant", status: row.submittedAt ? "submitted" : "draft", updatedAt: row.updatedAt };
    }),
    get: publicProcedure.input(z.object({ accessKey: keySchema })).handler(async ({ input }) => {
      const row = await db.select().from(applications).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!row) throw new Error("Application key not found");
      return { data: withoutSchoolPreferences(row.data as Record<string, unknown>), updatedAt: row.updatedAt, accessKeyHint: row.accessKeyHint, sessionCode: await ensureSessionCode(row), submittedAt: row.submittedAt };
    }),
    checkBirthCertificate: publicProcedure.input(z.object({ birthCertificateNumber: z.string().trim().min(1) })).handler(async ({ input }) => {
      const birthCertificateNumber = input.birthCertificateNumber.trim().toUpperCase();
      const row = await db.select({ id: applications.id }).from(applications).where(eq(applications.birthCertificateNumber, birthCertificateNumber)).get();
      return { exists: Boolean(row) };
    }),
    requestAccess: publicProcedure.input(z.object({ birthCertificateNumber: z.string().trim().min(1).optional(), sessionCode: z.string().trim().min(1).optional(), guardianNic: z.string().trim().min(1).optional(), applicantName: z.string().trim().min(1), contactEmail: z.email(), contactPhone: z.string().trim().optional(), accessKey: keySchema.optional(), requestType: z.enum(["access", "removal"]).default("access") }).refine((input) => Boolean(input.birthCertificateNumber || input.sessionCode || input.guardianNic || input.accessKey), "A birth certificate number, session code, guardian NIC, or access key is required")).handler(async ({ input }) => {
      const keyRow = input.accessKey ? await db.select({ id: applications.id, birthCertificateNumber: applications.birthCertificateNumber }).from(applications).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).get() : null;
      const codeRow = input.sessionCode ? await db.select({ id: applications.id, birthCertificateNumber: applications.birthCertificateNumber }).from(applications).where(eq(applications.sessionCode, input.sessionCode.trim().toUpperCase())).get() : null;
      const birthCertificateNumber = input.birthCertificateNumber?.trim().toUpperCase() || keyRow?.birthCertificateNumber || codeRow?.birthCertificateNumber;
      let row = keyRow ?? codeRow ?? (birthCertificateNumber ? await db.select({ id: applications.id, birthCertificateNumber: applications.birthCertificateNumber }).from(applications).where(eq(applications.birthCertificateNumber, birthCertificateNumber)).get() : null);
      if (!row && input.guardianNic) {
        const normalizedNic = input.guardianNic.trim().toUpperCase();
        const candidates = await db.select({ id: applications.id, birthCertificateNumber: applications.birthCertificateNumber, data: applications.data }).from(applications).all();
        row = candidates.find((candidate) => String((candidate.data as { guardian?: { nic?: string } }).guardian?.nic ?? "").trim().toUpperCase() === normalizedNic) ?? null;
      }
      if (!row) throw new Error("No application was found for this birth certificate number");
      const resolvedBirthCertificateNumber = row.birthCertificateNumber;
      if (!resolvedBirthCertificateNumber) throw new Error("This application does not have a birth certificate number yet");
      const existing = await db.select({ id: applicationAccessRequests.id }).from(applicationAccessRequests).where(and(eq(applicationAccessRequests.applicationId, row.id), eq(applicationAccessRequests.requestType, input.requestType))).get();
      if (!existing) await db.insert(applicationAccessRequests).values({ id: randomUUID(), applicationId: row.id, birthCertificateNumber: resolvedBirthCertificateNumber, applicantName: input.applicantName.trim(), contactEmail: input.contactEmail.trim().toLowerCase(), ...(input.contactPhone?.trim() ? { contactPhone: input.contactPhone.trim() } : {}), requestType: input.requestType, status: "open", createdAt: new Date(), resolvedAt: null });
      return { submitted: true };
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
      const current = await db.select({ id: applications.id }).from(applications).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!current) throw new Error("Application key not found");
      const window = await getApplicationWindow();
      if (submissionLocked(window)) throw new Error("Applications can only be updated during the configured form window");
      const duplicate = await db.select({ id: applications.id }).from(applications).where(eq(applications.birthCertificateNumber, birthCertificateNumber)).get();
      if (duplicate && duplicate.id !== current?.id) throw new Error("An application already exists for this birth certificate number");
      await db.update(applications).set({ birthCertificateNumber: birthCertificateNumber || null, data: withoutSchoolPreferences(input.data), updatedAt }).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).run();
      await publishApplicationChange();
      return { updatedAt };
    }),
    status: publicProcedure.handler(async () => { const window = await getApplicationWindow(); return { submissionLocked: submissionLocked(window), submissionOpensAt: window.opensAt.toISOString(), submissionClosesAt: window.closesAt.toISOString(), environment: env.NODE_ENV }; }),
    submit: publicProcedure.input(z.object({ accessKey: keySchema })).handler(async ({ input }) => {
      const window = await getApplicationWindow();
      if (submissionLocked(window)) throw new Error("Submissions are outside the configured form window");
      const row = await db.select({ id: applications.id }).from(applications).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!row) throw new Error("Application key not found");
      await db.update(applications).set({ submittedAt: new Date(), updatedAt: new Date() }).where(eq(applications.id, row.id)).run();
      await publishApplicationChange();
      return { accepted: true };
    }),
  },
  admin: {
    accessRequests: {
      query: adminProcedure.handler(async () => db.select().from(applicationAccessRequests).where(eq(applicationAccessRequests.status, "open")).all()),
      rotateKey: adminProcedure.input(z.object({ requestId: z.string().uuid() })).handler(async ({ input }) => {
        const request = await db.select().from(applicationAccessRequests).where(eq(applicationAccessRequests.id, input.requestId)).get();
        if (!request) throw new Error("Access request not found");
        if (request.requestType !== "access") throw new Error("Only access requests can generate a replacement key");
        const accessKey = createAccessKey();
        await db.update(applications).set({ accessKeyHash: hashKey(accessKey), accessKeyHint: accessKey.slice(-6), updatedAt: new Date() }).where(eq(applications.id, request.applicationId)).run();
        await db.update(applicationAccessRequests).set({ status: "resolved", resolvedAt: new Date() }).where(eq(applicationAccessRequests.id, request.id)).run();
        return { accessKey, applicationId: request.applicationId };
      }),
      deleteAfterRemovalRequest: adminProcedure.input(z.object({ requestId: z.string().uuid() })).handler(async ({ input }) => {
        const request = await db.select().from(applicationAccessRequests).where(eq(applicationAccessRequests.id, input.requestId)).get();
        if (!request) throw new Error("Removal request not found");
        if (request.requestType !== "removal") throw new Error("Only removal requests can delete an application");
        await db.delete(applications).where(eq(applications.id, request.applicationId)).run();
        await db.update(applicationAccessRequests).set({ status: "resolved", resolvedAt: new Date() }).where(eq(applicationAccessRequests.id, request.id)).run();
        await publishApplicationChange();
        return { deleted: true };
      }),
      dismiss: adminProcedure.input(z.object({ requestId: z.string().uuid() })).handler(async ({ input }) => { await db.update(applicationAccessRequests).set({ status: "dismissed", resolvedAt: new Date() }).where(eq(applicationAccessRequests.id, input.requestId)).run(); return { dismissed: true }; }),
    },
    settings: {
      get: adminProcedure.handler(async () => { const window = await getApplicationWindow(); return { opensAt: window.opensAt, closesAt: window.closesAt, updatedAt: window.updatedAt }; }),
      update: adminProcedure.input(z.object({ opensAt: z.coerce.date(), closesAt: z.coerce.date() })).handler(async ({ input }) => {
        if (input.closesAt <= input.opensAt) throw new Error("The closing time must be after the opening time");
        const updatedAt = new Date();
        await db.insert(applicationSettings).values({ id: "default", opensAt: input.opensAt, closesAt: input.closesAt, updatedAt }).onConflictDoUpdate({ target: applicationSettings.id, set: { opensAt: input.opensAt, closesAt: input.closesAt, updatedAt } });
        return { opensAt: input.opensAt, closesAt: input.closesAt, updatedAt };
      }),
    },
    overview: adminProcedure.handler(async () => {
      const rows = await db.select().from(applications).all();
      const records = rows.map(applicationRecord);
      return { total: records.length, drafts: records.filter((record) => record.status === "draft").length, submitted: records.filter((record) => record.status === "submitted").length, invalidEmail: records.filter((record) => record.validationErrors.includes("invalid_email")).length, incomplete: records.filter((record) => record.validationErrors.length > 0).length, recent: records.slice().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 10) };
    }),
    applications: adminProcedure.input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(25), query: z.string().trim().default("") })).handler(async ({ input }) => {
      const all = (await db.select().from(applications).all()).map(applicationRecord).filter((record) => record.applicantName.toLowerCase().includes(input.query.toLowerCase()) || record.sessionCode.toLowerCase().includes(input.query.toLowerCase()) || record.accessKeyHint.toLowerCase().includes(input.query.toLowerCase()));
      const start = (input.page - 1) * input.pageSize;
      return { total: all.length, page: input.page, pageSize: input.pageSize, items: all.slice(start, start + input.pageSize) };
    }),
    application: {
      get: adminProcedure.input(z.object({ id: z.string().uuid() })).handler(async ({ input }) => {
        const row = await db.select().from(applications).where(eq(applications.id, input.id)).get();
        if (!row) throw new Error("Application not found");
        return { id: row.id, sessionCode: await ensureSessionCode(row), data: withoutSchoolPreferences(row.data as Record<string, unknown>), createdAt: row.createdAt, updatedAt: row.updatedAt, submittedAt: row.submittedAt };
      }),
      update: adminProcedure.input(z.object({ id: z.string().uuid(), data: draftSchema })).handler(async ({ input }) => {
        const updatedAt = new Date();
        const birthCertificateNumber = typeof input.data.applicant === "object" && input.data.applicant !== null && "birthCertificateNumber" in input.data.applicant
          ? String((input.data.applicant as { birthCertificateNumber?: unknown }).birthCertificateNumber ?? "").trim().toUpperCase() : "";
        if (!birthCertificateNumber) throw new Error("Birth certificate number is required");
        const duplicate = await db.select({ id: applications.id }).from(applications).where(eq(applications.birthCertificateNumber, birthCertificateNumber)).get();
        if (duplicate && duplicate.id !== input.id) throw new Error("An application already exists for this birth certificate number");
        const existing = await db.select({ id: applications.id }).from(applications).where(eq(applications.id, input.id)).get();
        if (!existing) throw new Error("Application not found");
        await db.update(applications).set({ birthCertificateNumber, data: withoutSchoolPreferences(input.data), updatedAt }).where(eq(applications.id, input.id)).run();
        await publishApplicationChange();
        return { updatedAt };
      }),
      remove: adminProcedure.input(z.object({ id: z.string().uuid() })).handler(async ({ input }) => {
        const existing = await db.select({ id: applications.id }).from(applications).where(eq(applications.id, input.id)).get();
        if (!existing) throw new Error("Application not found");
        await db.delete(applications).where(eq(applications.id, input.id)).run();
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

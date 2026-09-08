import { EventPublisher, eventIterator } from "@orpc/server";
import { ORPCError } from "@orpc/client";

import { adminProcedure, subAdminProcedure, publicProcedure } from "../index";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { createDb } from "@aloysius-admissions/db";
import { g1ApplicationAccessRequests, g1ApplicationMarks, g1ApplicationSettings, g1Applications, g1SchoolCoordinateOverrides } from "@aloysius-admissions/db";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { env } from "@aloysius-admissions/env/server";
import {
  accessRequestIssues,
  applicationValidationErrors,
  createAccessKey,
  createSessionCode,
  defaultSubmissionWindow,
  draftSchema,
  extractBirthCertificateNumber,
  hashKey,
  isAdmissionsAvailable,
  isSubmissionLocked,
  isValidSubmissionWindow,
  keySchema,
  sessionCodePattern,
  withoutSchoolPreferences,
} from "../g1-logic";
import type { ApplicationData } from "../g1-logic";

const db = createDb();
const uniqueSessionCode = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const sessionCode = createSessionCode();
    const existing = await db.select({ id: g1Applications.id }).from(g1Applications).where(eq(g1Applications.sessionCode, sessionCode)).get();
    if (!existing) return sessionCode;
  }
  throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not allocate an application session code" });
};
const ensureSessionCode = async (row: typeof g1Applications.$inferSelect) => {
  if (row.sessionCode) return row.sessionCode;
  const sessionCode = await uniqueSessionCode();
  await db.update(g1Applications).set({ sessionCode }).where(eq(g1Applications.id, row.id)).run();
  return sessionCode;
};
const defaultOpensAt = defaultSubmissionWindow().opensAt;
const defaultClosesAt = defaultSubmissionWindow().closesAt;
const getApplicationWindow = async (intakeYear?: string) => {
  const year = intakeYear ?? "2027";
  return await db.select().from(g1ApplicationSettings).where(eq(g1ApplicationSettings.id, year)).get() ?? null;
};
const getOrCreateApplicationWindow = async (intakeYear?: string) => {
  const year = intakeYear ?? "2027";
  const existing = await db.select().from(g1ApplicationSettings).where(eq(g1ApplicationSettings.id, year)).get();
  if (existing) return existing;
  const now = new Date();
  const defaults = { id: year, opensAt: defaultOpensAt, closesAt: defaultClosesAt, updatedAt: now };
  await db.insert(g1ApplicationSettings).values(defaults).onConflictDoNothing();
  return (await db.select().from(g1ApplicationSettings).where(eq(g1ApplicationSettings.id, year)).get()) ?? defaults;
};
// Shared request action helpers (used by both admin and subAdmin)
const rotateRequestKey = async (requestId: string) => {
  const request = await db.select().from(g1ApplicationAccessRequests).where(eq(g1ApplicationAccessRequests.id, requestId)).get();
  if (!request) throw new ORPCError("NOT_FOUND", { message: "Request not found" });
  if (request.requestType !== "access" && request.requestType !== "forgot") throw new ORPCError("BAD_REQUEST", { message: "Only access and forgot requests can generate a replacement key" });
  const accessKey = createAccessKey();
  await db.update(g1Applications).set({ accessKeyHash: hashKey(accessKey), accessKeyHint: accessKey.slice(-6), updatedAt: new Date() }).where(eq(g1Applications.id, request.applicationId)).run();
  await db.update(g1ApplicationAccessRequests).set({ status: "resolved", resolvedAt: new Date() }).where(eq(g1ApplicationAccessRequests.id, request.id)).run();
  return { accessKey, applicationId: request.applicationId };
};
const deleteAfterRemoval = async (requestId: string) => {
  const request = await db.select().from(g1ApplicationAccessRequests).where(eq(g1ApplicationAccessRequests.id, requestId)).get();
  if (!request) throw new ORPCError("NOT_FOUND", { message: "Removal request not found" });
  if (request.requestType !== "removal") throw new ORPCError("BAD_REQUEST", { message: "Only removal requests can delete an application" });
  await db.delete(g1Applications).where(eq(g1Applications.id, request.applicationId)).run();
  await db.update(g1ApplicationAccessRequests).set({ status: "resolved", resolvedAt: new Date() }).where(eq(g1ApplicationAccessRequests.id, request.id)).run();
  await publishApplicationChange();
  return { deleted: true };
};
const dismissRequest = async (requestId: string) => {
  await db.update(g1ApplicationAccessRequests).set({ status: "dismissed", resolvedAt: new Date() }).where(eq(g1ApplicationAccessRequests.id, requestId)).run();
  return { dismissed: true };
};
const paginationInput = z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(25), query: z.string().trim().default(""), status: z.enum(["open", "resolved", "dismissed", "all"]).default("open"), intakeYear: z.string().default("2027") });
const paginateRequests = async (requestType: string, query: string, page: number, pageSize: number, searchFields?: string[], status?: string, intakeYear?: string) => {
  const conditions = [eq(g1ApplicationAccessRequests.requestType, requestType)];
  if (status && status !== "all") conditions.push(eq(g1ApplicationAccessRequests.status, status));
  if (intakeYear) conditions.push(eq(g1ApplicationAccessRequests.intakeYear, intakeYear));
  const all = await db.select().from(g1ApplicationAccessRequests).where(and(...conditions)).all();
  const filtered = query ? all.filter((r) => {
    const fields = searchFields ?? ["applicantName", "contactEmail"];
    return fields.some((field) => String(r[field as keyof typeof r] ?? "").toLowerCase().includes(query.toLowerCase()));
  }) : all;
  const start = (page - 1) * pageSize;
  return { total: filtered.length, page, pageSize, items: filtered.slice(start, start + pageSize) };
};
const applicationEvents = new EventPublisher<{ "application-count": { count: number } }>();
const applicationCount = async (intakeYear?: string) => {
  if (intakeYear) return (await db.select({ id: g1Applications.id }).from(g1Applications).where(eq(g1Applications.intakeYear, intakeYear)).all()).length;
  return (await db.select({ id: g1Applications.id }).from(g1Applications).all()).length;
};
const publishApplicationChange = async () => applicationEvents.publish("application-count", { count: await applicationCount() });
const applicationRecord = (row: typeof g1Applications.$inferSelect) => {
  const data = row.data as ApplicationData | null | undefined;
  return { id: row.id, sessionCode: row.sessionCode, applicantName: data?.applicant?.fullName || "Unnamed applicant", status: row.submittedAt ? "submitted" : "draft", createdAt: row.createdAt, updatedAt: row.updatedAt, submittedAt: row.submittedAt, accessKeyHint: row.accessKeyHint, validationErrors: applicationValidationErrors(data) };
};
const admissionStatusSchema = z.enum(["pending", "verified", "fake"]);
const applicationIdSchema = z.string().trim().min(1);
const admissionsListInput = paginationInput.extend({
  status: z.enum(["all", "pending", "verified", "fake", "banned"]).default("all"),
});
const admissionSummaryDataSchema = z.object({
  applicant: z.object({ fullName: z.string().optional() }).optional(),
  categories: z.array(z.object({ categoryType: z.string().optional() }).passthrough()).optional(),
}).passthrough();
const flagsSchema = z.array(z.object({ type: z.string(), key: z.string(), label: z.string() }));
const parseFlags = (raw: unknown) => {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      const result = flagsSchema.safeParse(parsed);
      return result.success ? result.data : [];
    } catch {
      return [];
    }
  }
  const result = flagsSchema.safeParse(raw);
  return result.success ? result.data : [];
};
const admissionSummary = (row: typeof g1Applications.$inferSelect) => {
  const parsed = admissionSummaryDataSchema.safeParse(row.data);
  const data = parsed.success ? parsed.data : undefined;
  const categories = data?.categories ?? [];
  return {
    id: row.id,
    applicantName: data?.applicant?.fullName || "Unnamed applicant",
    birthCertificateNumber: row.birthCertificateNumber ?? "Not provided",
    sessionCode: row.sessionCode,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
    categoryCount: categories.length,
    categoryTypes: categories.flatMap((category) => category.categoryType ? [category.categoryType] : []),
    admissionStatus: row.admissionStatus,
    interviewNotes: row.interviewNotes,
    isBanned: row.isBanned,
    banReason: row.banReason,
    admissionUpdatedAt: row.admissionUpdatedAt,
    flags: parseFlags(row.flags),
  };
};
const ensureAdmissionsAccess = async (earlyAccess: boolean, intakeYear?: string) => {
  const window = await getOrCreateApplicationWindow(intakeYear);
  if (!isAdmissionsAvailable(window.closesAt, new Date(), earlyAccess)) {
    throw new ORPCError("FORBIDDEN", { message: `Admissions opens after ${window.closesAt.toISOString()}` });
  }
  return window;
};

export const g1Router = {
  application: {
    create: publicProcedure.input(z.object({ data: draftSchema.default({}), intakeYear: z.string().default("2027") })).handler(async ({ input }) => {
      const accessKey = createAccessKey();
      const sessionCode = await uniqueSessionCode();
      const now = new Date();
      const birthCertificateNumber = extractBirthCertificateNumber(input.data);
      const data = withoutSchoolPreferences(input.data);
      const existing = birthCertificateNumber ? await db.select({ id: g1Applications.id }).from(g1Applications).where(and(eq(g1Applications.birthCertificateNumber, birthCertificateNumber), isNotNull(g1Applications.submittedAt))).get() : null;
      if (existing) throw new ORPCError("CONFLICT", { message: "An application with this birth certificate number has already been submitted. Please check the number and try again." });
      await db.insert(g1Applications).values({ id: randomUUID(), sessionCode, accessKeyHash: hashKey(accessKey), accessKeyHint: accessKey.slice(-6), birthCertificateNumber: birthCertificateNumber || null, data, intakeYear: input.intakeYear, createdAt: now, updatedAt: now });
      await publishApplicationChange();
      return { accessKey, sessionCode, data };
    }),
    lookup: publicProcedure.input(z.object({ sessionCode: z.string().regex(sessionCodePattern) })).handler(async ({ input }) => {
      const row = await db.select({ sessionCode: g1Applications.sessionCode, data: g1Applications.data, submittedAt: g1Applications.submittedAt, updatedAt: g1Applications.updatedAt }).from(g1Applications).where(eq(g1Applications.sessionCode, input.sessionCode.toUpperCase())).get();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Application session not found" });
      const data = row.data as { applicant?: { fullName?: string } };
      return { sessionCode: row.sessionCode, applicantName: data.applicant?.fullName || "Unnamed applicant", status: row.submittedAt ? "submitted" : "draft", updatedAt: row.updatedAt };
    }),
    get: publicProcedure.input(z.object({ accessKey: keySchema })).handler(async ({ input }) => {
      const row = await db.select().from(g1Applications).where(eq(g1Applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Application key not found" });
      return {
        data: withoutSchoolPreferences(row.data as Record<string, unknown>),
        updatedAt: row.updatedAt,
        accessKeyHint: row.accessKeyHint,
        sessionCode: await ensureSessionCode(row),
        submittedAt: row.submittedAt,
        admissionStatus: row.admissionStatus,
        interviewNotes: row.interviewNotes,
        isBanned: row.isBanned,
        banReason: row.banReason,
        flags: parseFlags(row.flags),
      };
    }),
    checkBirthCertificate: publicProcedure.input(z.object({ birthCertificateNumber: z.string().trim().min(1), excludeAccessKey: z.string().trim().optional() })).handler(async ({ input }) => {
      const birthCertificateNumber = input.birthCertificateNumber.trim().toUpperCase();
      const conditions = [eq(g1Applications.birthCertificateNumber, birthCertificateNumber), isNotNull(g1Applications.submittedAt)];
      if (input.excludeAccessKey) {
        const excludeHash = hashKey(input.excludeAccessKey);
        conditions.push(ne(g1Applications.accessKeyHash, excludeHash));
      }
      const row = await db.select({ id: g1Applications.id }).from(g1Applications).where(and(...conditions)).get();
      return { exists: Boolean(row) };
    }),
    requestAccess: publicProcedure.input(z.object({ birthCertificateNumber: z.string().trim().min(1).optional(), sessionCode: z.string().trim().min(1).optional(), guardianNic: z.string().trim().min(1).optional(), applicantName: z.string().trim().optional(), guardianName: z.string().trim().optional(), contactEmail: z.email().optional(), contactPhone: z.string().trim().optional(), accessKey: keySchema.optional(), requestType: z.enum(["access", "removal", "submission", "forgot"]).default("access") }).superRefine((input, context) => {
      for (const issue of accessRequestIssues(input)) {
        context.addIssue(issue.path ? { code: "custom", path: issue.path, message: issue.message } : { code: "custom", message: issue.message });
      }
    })).handler(async ({ input }) => {
      const keyRow = input.accessKey ? await db.select({ id: g1Applications.id, birthCertificateNumber: g1Applications.birthCertificateNumber }).from(g1Applications).where(eq(g1Applications.accessKeyHash, hashKey(input.accessKey))).get() : null;
      const codeRow = input.sessionCode ? await db.select({ id: g1Applications.id, birthCertificateNumber: g1Applications.birthCertificateNumber }).from(g1Applications).where(eq(g1Applications.sessionCode, input.sessionCode.trim().toUpperCase())).get() : null;
      const birthCertificateNumber = input.birthCertificateNumber?.trim().toUpperCase() || keyRow?.birthCertificateNumber || codeRow?.birthCertificateNumber;
      const birthRow = input.birthCertificateNumber ? await db.select({ id: g1Applications.id, birthCertificateNumber: g1Applications.birthCertificateNumber }).from(g1Applications).where(eq(g1Applications.birthCertificateNumber, birthCertificateNumber!)).get() : null;
      if (keyRow && (codeRow && codeRow.id !== keyRow.id || birthRow && birthRow.id !== keyRow.id)) throw new ORPCError("BAD_REQUEST", { message: "The supplied identifier belongs to a different application than this access key" });
      let row = keyRow ?? codeRow ?? birthRow;
      let guardianRow: typeof row = null;
      if (!row && input.guardianNic) {
        const normalizedNic = input.guardianNic.trim().toUpperCase();
        const candidates = await db.select({ id: g1Applications.id, birthCertificateNumber: g1Applications.birthCertificateNumber, data: g1Applications.data }).from(g1Applications).all();
        guardianRow = candidates.find((candidate) => String((candidate.data as { guardian?: { nic?: string } }).guardian?.nic ?? "").trim().toUpperCase() === normalizedNic) ?? null;
        row = guardianRow;
      } else if (keyRow && input.guardianNic) {
        const candidates = await db.select({ id: g1Applications.id, birthCertificateNumber: g1Applications.birthCertificateNumber, data: g1Applications.data }).from(g1Applications).all();
        guardianRow = candidates.find((candidate) => String((candidate.data as { guardian?: { nic?: string } }).guardian?.nic ?? "").trim().toUpperCase() === input.guardianNic?.trim().toUpperCase()) ?? null;
        if (guardianRow && guardianRow.id !== keyRow.id) throw new ORPCError("BAD_REQUEST", { message: "The supplied guardian NIC belongs to a different application than this access key" });
      }
      if (!row) throw new ORPCError("NOT_FOUND", { message: "No application was found for this birth certificate number" });
      if (input.requestType !== "submission") {
        const submittedApplication = await db.select({ submittedAt: g1Applications.submittedAt }).from(g1Applications).where(eq(g1Applications.id, row.id)).get();
        if (!submittedApplication?.submittedAt) throw new ORPCError("BAD_REQUEST", { message: "Access recovery is available only for submitted applications" });
      }
      const resolvedBirthCertificateNumber = row.birthCertificateNumber || "";
      if (!resolvedBirthCertificateNumber) throw new ORPCError("BAD_REQUEST", { message: "This application does not have a birth certificate number yet" });
      const existing = await db.select({ id: g1ApplicationAccessRequests.id }).from(g1ApplicationAccessRequests).where(and(eq(g1ApplicationAccessRequests.applicationId, row.id), eq(g1ApplicationAccessRequests.requestType, input.requestType), eq(g1ApplicationAccessRequests.status, "open"))).get();
      if (!existing) {
        const appIntakeYear = row ? (await db.select({ intakeYear: g1Applications.intakeYear }).from(g1Applications).where(eq(g1Applications.id, row.id)).get())?.intakeYear ?? "2027" : "2027";
        await db.insert(g1ApplicationAccessRequests).values({ id: randomUUID(), applicationId: row.id, birthCertificateNumber: resolvedBirthCertificateNumber, applicantName: input.applicantName?.trim() ?? "", guardianName: input.guardianName?.trim() ?? "", contactEmail: input.contactEmail?.trim().toLowerCase() ?? "", ...(input.contactPhone?.trim() ? { contactPhone: input.contactPhone.trim() } : {}), requestType: input.requestType, status: "open", intakeYear: appIntakeYear, createdAt: new Date(), resolvedAt: null });
      }
      return { submitted: true };
    }),
    liveCount: publicProcedure.output(eventIterator(z.object({ count: z.number() }))).handler(async function* ({ signal }) {
      yield { count: await applicationCount() };
      for await (const payload of applicationEvents.subscribe("application-count", { signal })) yield payload;
    }),
    count: publicProcedure.handler(async () => ({ count: await applicationCount() })),
    update: publicProcedure.input(z.object({ accessKey: keySchema, data: draftSchema })).handler(async ({ input }) => {
      const updatedAt = new Date();
      const birthCertificateNumber = extractBirthCertificateNumber(input.data);
      const current = await db.select({ id: g1Applications.id, submittedAt: g1Applications.submittedAt, intakeYear: g1Applications.intakeYear }).from(g1Applications).where(eq(g1Applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!current) throw new ORPCError("NOT_FOUND", { message: "Application key not found" });
      const window = await getOrCreateApplicationWindow(current.intakeYear);
      if (current.submittedAt && isSubmissionLocked(window)) throw new ORPCError("BAD_REQUEST", { message: "Submitted applications can only be updated during the configured form window" });
      const duplicate = birthCertificateNumber ? await db.select({ id: g1Applications.id }).from(g1Applications).where(and(eq(g1Applications.birthCertificateNumber, birthCertificateNumber), isNotNull(g1Applications.submittedAt))).get() : null;
      if (duplicate && duplicate.id !== current?.id) throw new ORPCError("CONFLICT", { message: "An application with this birth certificate number has already been submitted. Please check the number and try again." });
      await db.update(g1Applications).set({ birthCertificateNumber: birthCertificateNumber || null, data: withoutSchoolPreferences(input.data), updatedAt }).where(eq(g1Applications.accessKeyHash, hashKey(input.accessKey))).run();
      await publishApplicationChange();
      return { updatedAt };
    }),
    status: publicProcedure.input(z.object({ intakeYear: z.string().default("2027") }).optional()).handler(async ({ input }) => { const window = await getOrCreateApplicationWindow(input?.intakeYear); return { submissionLocked: isSubmissionLocked(window), submissionOpensAt: window.opensAt.toISOString(), submissionClosesAt: window.closesAt.toISOString(), environment: env.NODE_ENV }; }),
    submit: publicProcedure.input(z.object({ accessKey: keySchema })).handler(async ({ input }) => {
      const row = await db.select({ id: g1Applications.id, intakeYear: g1Applications.intakeYear }).from(g1Applications).where(eq(g1Applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Application key not found" });
      const window = await getOrCreateApplicationWindow(row.intakeYear);
      if (isSubmissionLocked(window)) throw new ORPCError("BAD_REQUEST", { message: "Submissions are outside the configured form window" });
      await db.update(g1Applications).set({ submittedAt: new Date(), updatedAt: new Date() }).where(eq(g1Applications.id, row.id)).run();
      await publishApplicationChange();
      return { accepted: true };
    }),
    getMarks: publicProcedure.input(z.object({ accessKey: keySchema })).handler(async ({ input }) => {
      const row = await db.select({ id: g1Applications.id }).from(g1Applications).where(eq(g1Applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Application key not found" });
      // Applicants only ever see their own indicative preview, never the admin's
      // authoritative score (that would leak pre-decision outcomes and, combined
      // with the write path below, let an applicant read back a forged value).
      const marks = await db.select().from(g1ApplicationMarks).where(and(eq(g1ApplicationMarks.applicationId, row.id), eq(g1ApplicationMarks.source, "applicant"))).all();
      return marks;
    }),
    saveIndicativeMarks: publicProcedure.input(z.object({ accessKey: keySchema, marks: z.array(z.object({ categoryType: z.string(), total: z.number().min(0).max(100), breakdown: z.array(z.object({ label: z.string(), marks: z.number().min(0).max(100), max: z.number().min(0).max(100) })) })) })).handler(async ({ input }) => {
      const row = await db.select({ id: g1Applications.id }).from(g1Applications).where(eq(g1Applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Application key not found" });
      const now = new Date();
      for (const mark of input.marks) {
        // Always written as source "applicant": this is a client-computed
        // preview only and must never overwrite or be confused with the
        // admin's authoritative "admin"-sourced row for the same category.
        const existing = await db.select({ id: g1ApplicationMarks.id }).from(g1ApplicationMarks)
          .where(and(eq(g1ApplicationMarks.applicationId, row.id), eq(g1ApplicationMarks.categoryType, mark.categoryType), eq(g1ApplicationMarks.source, "applicant")))
          .get();
        if (existing) {
          await db.update(g1ApplicationMarks).set({ breakdown: mark.breakdown, total: mark.total, updatedAt: now }).where(eq(g1ApplicationMarks.id, existing.id)).run();
        } else {
          await db.insert(g1ApplicationMarks).values({ id: randomUUID(), applicationId: row.id, categoryType: mark.categoryType, breakdown: mark.breakdown, total: mark.total, source: "applicant", createdAt: now, updatedAt: now }).run();
        }
      }
      return { saved: true };
    }),
  },
  schools: {
    /** Manually placed school coordinates (admin hub). Public so every client shows the same catalog. */
    overrides: publicProcedure.handler(async () => {
      return db.select().from(g1SchoolCoordinateOverrides).all();
    }),
  },
  admin: {
    accessRequests: {
      query: adminProcedure.handler(async () => db.select().from(g1ApplicationAccessRequests).where(eq(g1ApplicationAccessRequests.status, "open")).all()),
      rotateKey: adminProcedure.input(z.object({ requestId: z.string().uuid() })).handler(async ({ input }) => rotateRequestKey(input.requestId)),
      deleteAfterRemovalRequest: adminProcedure.input(z.object({ requestId: z.string().uuid() })).handler(async ({ input }) => deleteAfterRemoval(input.requestId)),
      dismiss: adminProcedure.input(z.object({ requestId: z.string().uuid() })).handler(async ({ input }) => dismissRequest(input.requestId)),
      submissionRequests: adminProcedure.input(paginationInput).handler(async ({ input }) => paginateRequests("submission", input.query, input.page, input.pageSize, undefined, input.status, input.intakeYear)),
      removalRequests: adminProcedure.input(paginationInput).handler(async ({ input }) => paginateRequests("removal", input.query, input.page, input.pageSize, undefined, input.status, input.intakeYear)),
      forgotRequests: adminProcedure.input(paginationInput).handler(async ({ input }) => paginateRequests("forgot", input.query, input.page, input.pageSize, ["applicantName", "contactEmail", "birthCertificateNumber", "contactPhone"], input.status, input.intakeYear)),
      approveSubmission: adminProcedure.input(z.object({ requestId: z.string().uuid() })).handler(async ({ input }) => {
        const request = await db.select().from(g1ApplicationAccessRequests).where(eq(g1ApplicationAccessRequests.id, input.requestId)).get();
        if (!request) throw new ORPCError("NOT_FOUND", { message: "Submission request not found" });
        if (request.requestType !== "submission") throw new ORPCError("BAD_REQUEST", { message: "Only submission requests can be approved" });
        await db.update(g1Applications).set({ submittedAt: new Date(), updatedAt: new Date() }).where(eq(g1Applications.id, request.applicationId)).run();
        await db.update(g1ApplicationAccessRequests).set({ status: "resolved", resolvedAt: new Date() }).where(eq(g1ApplicationAccessRequests.id, request.id)).run();
        await publishApplicationChange();
        return { approved: true };
      }),
      rejectSubmission: adminProcedure.input(z.object({ requestId: z.string().uuid() })).handler(async ({ input }) => {
        const request = await db.select().from(g1ApplicationAccessRequests).where(eq(g1ApplicationAccessRequests.id, input.requestId)).get();
        if (!request) throw new ORPCError("NOT_FOUND", { message: "Submission request not found" });
        if (request.requestType !== "submission") throw new ORPCError("BAD_REQUEST", { message: "Only submission requests can be rejected" });
        await db.update(g1ApplicationAccessRequests).set({ status: "dismissed", resolvedAt: new Date() }).where(eq(g1ApplicationAccessRequests.id, request.id)).run();
        return { rejected: true };
      }),
    },
    settings: {
      get: adminProcedure.input(z.object({ intakeYear: z.string().default("2027") }).optional()).handler(async ({ input }) => { const window = await getApplicationWindow(input?.intakeYear); if (!window) return null; return { opensAt: window.opensAt, closesAt: window.closesAt, updatedAt: window.updatedAt }; }),
      update: adminProcedure.input(z.object({ opensAt: z.coerce.date(), closesAt: z.coerce.date(), intakeYear: z.string().default("2027") })).handler(async ({ input }) => {
        if (!isValidSubmissionWindow(input.opensAt, input.closesAt)) throw new ORPCError("BAD_REQUEST", { message: "The closing time must be after the opening time" });
        const updatedAt = new Date();
        const year = input.intakeYear;
        const existing = await db.select({ id: g1ApplicationSettings.id }).from(g1ApplicationSettings).where(eq(g1ApplicationSettings.id, year)).get();
        if (existing) {
          await db.update(g1ApplicationSettings).set({ opensAt: input.opensAt, closesAt: input.closesAt, updatedAt }).where(eq(g1ApplicationSettings.id, year)).run();
        } else {
          await db.insert(g1ApplicationSettings).values({ id: year, opensAt: input.opensAt, closesAt: input.closesAt, updatedAt }).run();
        }
        return { opensAt: input.opensAt, closesAt: input.closesAt, updatedAt };
      }),
    },
    schools: {
      /** Same list as schools.overrides, kept for admin-only callers. */
      overrides: adminProcedure.handler(async () => {
        return db.select().from(g1SchoolCoordinateOverrides).all();
      }),
      save: adminProcedure.input(z.object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1).max(300),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        note: z.string().trim().max(500).default(""),
      })).handler(async ({ input, context }) => {
        const now = new Date();
        const existing = await db.select({ id: g1SchoolCoordinateOverrides.id }).from(g1SchoolCoordinateOverrides).where(eq(g1SchoolCoordinateOverrides.id, input.id)).get();
        const values = {
          name: input.name,
          latitude: input.latitude,
          longitude: input.longitude,
          note: input.note,
          updatedBy: context.session.user?.id ?? "",
          updatedAt: now,
        };
        if (existing) {
          await db.update(g1SchoolCoordinateOverrides).set(values).where(eq(g1SchoolCoordinateOverrides.id, input.id)).run();
        } else {
          await db.insert(g1SchoolCoordinateOverrides).values({ id: input.id, ...values }).run();
        }
        return { id: input.id, updatedAt: now };
      }),
      remove: adminProcedure.input(z.object({ id: z.string().trim().min(1) })).handler(async ({ input }) => {
        await db.delete(g1SchoolCoordinateOverrides).where(eq(g1SchoolCoordinateOverrides.id, input.id)).run();
        return { removed: true };
      }),
      clear: adminProcedure.handler(async () => {
        await db.delete(g1SchoolCoordinateOverrides).run();
        return { cleared: true };
      }),
      seedFromScraper: adminProcedure.input(z.object({ mode: z.enum(["add", "upsert"]).default("add") })).handler(async ({ input }) => {
        const scraperPath = "apps/map-scraper/schools_data.json";
        let raw: string;
        try {
          raw = readFileSync(scraperPath, "utf-8");
        } catch {
          throw new ORPCError("NOT_FOUND", { message: "Scraper data file not found at " + scraperPath });
        }
        const schools = JSON.parse(raw) as Array<{ id: string; en: string; lat: number | null; lng: number | null }>;
        const now = new Date();
        let added = 0;
        let skipped = 0;
        let updated = 0;
        for (const school of schools) {
          if (!school.id || !school.en || school.lat == null || school.lng == null) continue;
          const existing = await db.select({ id: g1SchoolCoordinateOverrides.id }).from(g1SchoolCoordinateOverrides).where(eq(g1SchoolCoordinateOverrides.id, school.id)).get();
          if (existing && input.mode === "add") {
            skipped++;
            continue;
          }
          const values = {
            id: school.id,
            name: school.en,
            latitude: school.lat,
            longitude: school.lng,
            note: input.mode === "add" ? "imported from scraper (new)" : "imported from scraper (upsert)",
            updatedBy: "scraper",
            updatedAt: now,
          };
          if (existing) {
            await db.update(g1SchoolCoordinateOverrides).set(values).where(eq(g1SchoolCoordinateOverrides.id, school.id)).run();
            updated++;
          } else {
            await db.insert(g1SchoolCoordinateOverrides).values(values).run();
            added++;
          }
        }
        return { added, skipped, updated };
      }),
    },
    overview: adminProcedure.input(z.object({ intakeYear: z.string().default("2027") }).optional()).handler(async ({ input }) => {
      const intakeYear = input?.intakeYear ?? "2027";
      const rows = await db.select().from(g1Applications).where(eq(g1Applications.intakeYear, intakeYear)).all();
      const records = rows.map(applicationRecord);
      return { total: records.length, drafts: records.filter((record) => record.status === "draft").length, submitted: records.filter((record) => record.status === "submitted").length, invalidEmail: records.filter((record) => record.validationErrors.includes("invalid_email")).length, incomplete: records.filter((record) => record.validationErrors.length > 0).length, recent: records.slice().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 10) };
    }),
    admissions: {
      list: adminProcedure.input(admissionsListInput).handler(async ({ input }) => {
        const query = input.query.toLowerCase();
        const rows = await db.select().from(g1Applications).where(and(isNotNull(g1Applications.submittedAt), eq(g1Applications.intakeYear, input.intakeYear))).all();
        const filtered = rows
          .map(admissionSummary)
          .filter((record) => {
            if (query && ![record.applicantName, record.birthCertificateNumber, record.sessionCode].some((value) => value.toLowerCase().includes(query))) return false;
            if (input.status === "banned" && !record.isBanned) return false;
            if (input.status !== "all" && input.status !== "banned" && record.admissionStatus !== input.status) return false;
            return true;
          })
          .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
        const start = (input.page - 1) * input.pageSize;
        return { total: filtered.length, page: input.page, pageSize: input.pageSize, items: filtered.slice(start, start + input.pageSize) };
    }),
      listWithLocations: adminProcedure.input(z.object({ intakeYear: z.string().default("2027") }).optional()).handler(async ({ input }) => {
        const intakeYear = input?.intakeYear ?? "2027";
        const rows = await db.select().from(g1Applications).where(and(isNotNull(g1Applications.submittedAt), eq(g1Applications.intakeYear, intakeYear))).all();
        return rows.map((row) => {
          const summary = admissionSummary(row);
          const data = (row.data ?? {}) as Record<string, unknown>;
          const locationHistory = (Array.isArray(data.userLocationHistory) ? data.userLocationHistory : []) as Array<Record<string, unknown>>;
          const selectedLocation = data.selectedLocation as Record<string, unknown> | undefined;
          const location = data.location as Record<string, unknown> | undefined;
          const latestPin = locationHistory.find((loc) => typeof loc.latitude === "number" && typeof loc.longitude === "number")
            ?? (selectedLocation && typeof selectedLocation.latitude === "number" ? selectedLocation : null)
            ?? (location && typeof location.latitude === "number" ? location : null);
          return {
            ...summary,
            latitude: latestPin && typeof latestPin.latitude === "number" ? latestPin.latitude : null,
            longitude: latestPin && typeof latestPin.longitude === "number" ? latestPin.longitude : null,
          };
        });
      }),
      get: adminProcedure.input(z.object({ id: applicationIdSchema })).handler(async ({ input }) => {
        const row = await db.select().from(g1Applications).where(eq(g1Applications.id, input.id)).get();
        if (!row || !row.submittedAt) throw new ORPCError("NOT_FOUND", { message: "Submitted application not found" });
        return { ...admissionSummary(row), data: withoutSchoolPreferences(row.data as Record<string, unknown>), createdAt: row.createdAt };
    }),
      updateReview: adminProcedure.input(z.object({
        id: applicationIdSchema,
        admissionStatus: admissionStatusSchema,
        interviewNotes: z.string().trim().max(5000).default(""),
        isBanned: z.boolean().default(false),
        banReason: z.string().trim().max(500).optional(),
        flags: z.array(z.object({ type: z.string(), key: z.string(), label: z.string() })).default([]),
      }).superRefine((input, context) => {
        if (input.isBanned && !input.banReason) context.addIssue({ code: "custom", path: ["banReason"], message: "A reason is required when banning an applicant" });
      })).handler(async ({ input }) => {
        const row = await db.select({ id: g1Applications.id, submittedAt: g1Applications.submittedAt }).from(g1Applications).where(eq(g1Applications.id, input.id)).get();
        if (!row || !row.submittedAt) throw new ORPCError("NOT_FOUND", { message: "Submitted application not found" });
        const admissionUpdatedAt = new Date();
        await db.update(g1Applications).set({ admissionStatus: input.admissionStatus, interviewNotes: input.interviewNotes, isBanned: input.isBanned, banReason: input.isBanned ? input.banReason ?? null : null, admissionUpdatedAt, flags: JSON.stringify(input.flags) }).where(eq(g1Applications.id, input.id)).run();
        return { admissionStatus: input.admissionStatus, interviewNotes: input.interviewNotes, isBanned: input.isBanned, banReason: input.isBanned ? input.banReason ?? null : null, admissionUpdatedAt, flags: input.flags };
    }),
      saveAdminLocation: adminProcedure.input(z.object({
        id: applicationIdSchema,
        lat: z.number(),
        lng: z.number(),
        label: z.string().default("Admin-adjusted location"),
        mapQuery: z.string().optional(),
      })).handler(async ({ input }) => {
        const row = await db.select({ id: g1Applications.id, data: g1Applications.data }).from(g1Applications).where(eq(g1Applications.id, input.id)).get();
        if (!row) throw new ORPCError("NOT_FOUND", { message: "Application not found" });
        const data = (row.data ?? {}) as Record<string, unknown>;
        const userLocationHistory = ((Array.isArray(data.userLocationHistory) ? data.userLocationHistory : []) as Array<Record<string, unknown>>)
          .filter((loc) => loc.source !== "admin");
        const newLocation = {
          id: randomUUID(),
          latitude: input.lat,
          longitude: input.lng,
          label: input.label,
          address: input.label,
          source: "admin" as const,
          createdAt: new Date().toISOString(),
          ...(input.mapQuery ? { mapQuery: input.mapQuery } : {}),
        };
        const updatedData = { ...data, userLocationHistory: [newLocation, ...userLocationHistory] };
        await db.update(g1Applications).set({ data: updatedData, updatedAt: new Date() }).where(eq(g1Applications.id, input.id)).run();
        return { userLocationHistory: updatedData.userLocationHistory };
      }),
      saveInterviewEdits: adminProcedure.input(z.object({
        id: applicationIdSchema,
        interviewEdits: z.array(z.object({ field: z.string(), label: z.string(), previousValue: z.string(), newValue: z.string(), editedAt: z.string() })),
      })).handler(async ({ input }) => {
        const row = await db.select({ id: g1Applications.id, data: g1Applications.data }).from(g1Applications).where(eq(g1Applications.id, input.id)).get();
        if (!row) throw new ORPCError("NOT_FOUND", { message: "Application not found" });
        const data = (row.data ?? {}) as Record<string, unknown>;
        const updatedData = { ...data, interviewEdits: input.interviewEdits };
        await db.update(g1Applications).set({ data: updatedData, updatedAt: new Date() }).where(eq(g1Applications.id, input.id)).run();
        return { interviewEdits: input.interviewEdits };
      }),
      saveScoringInputs: adminProcedure.input(z.object({
        id: applicationIdSchema,
        categoryId: z.string(),
        scoringInputs: z.record(z.unknown()),
      })).handler(async ({ input }) => {
        const row = await db.select({ id: g1Applications.id, data: g1Applications.data }).from(g1Applications).where(eq(g1Applications.id, input.id)).get();
        if (!row) throw new ORPCError("NOT_FOUND", { message: "Application not found" });
        const data = (row.data ?? {}) as Record<string, unknown>;
        const categories = Array.isArray(data.categories) ? data.categories as Array<Record<string, unknown>> : [];
        const updatedCategories = categories.map((cat) =>
          cat.id === input.categoryId ? { ...cat, scoringInputs: input.scoringInputs } : cat
        );
        const updatedData = { ...data, categories: updatedCategories };
        await db.update(g1Applications).set({ data: updatedData, updatedAt: new Date() }).where(eq(g1Applications.id, input.id)).run();
        return { success: true };
      }),
      getMarks: adminProcedure.input(z.object({ applicationId: applicationIdSchema })).handler(async ({ input }) => {
        // Only ever return admin-authored, authoritative marks: an applicant's
        // own indicative-preview rows (source "applicant") must never pre-fill
        // or influence the admin's editable/saved score.
        const marks = await db.select().from(g1ApplicationMarks).where(and(eq(g1ApplicationMarks.applicationId, input.applicationId), eq(g1ApplicationMarks.source, "admin"))).all();
        return marks;
      }),
      saveMarks: adminProcedure.input(z.object({
        applicationId: applicationIdSchema,
        categoryType: z.string().min(1),
        breakdown: z.array(z.object({ label: z.string(), marks: z.number(), max: z.number() })),
        total: z.number(),
      })).handler(async ({ input }) => {
        const existing = await db.select({ id: g1ApplicationMarks.id }).from(g1ApplicationMarks)
          .where(and(eq(g1ApplicationMarks.applicationId, input.applicationId), eq(g1ApplicationMarks.categoryType, input.categoryType), eq(g1ApplicationMarks.source, "admin")))
          .get();
        const now = new Date();
        if (existing) {
          await db.update(g1ApplicationMarks).set({ breakdown: input.breakdown, total: input.total, updatedAt: now })
            .where(eq(g1ApplicationMarks.id, existing.id)).run();
          return { id: existing.id, updatedAt: now };
        }
        const id = randomUUID();
        await db.insert(g1ApplicationMarks).values({ id, applicationId: input.applicationId, categoryType: input.categoryType, breakdown: input.breakdown, total: input.total, source: "admin", createdAt: now, updatedAt: now }).run();
        return { id, updatedAt: now };
      }),
      deleteMarks: adminProcedure.input(z.object({ applicationId: applicationIdSchema, categoryType: z.string().min(1) })).handler(async ({ input }) => {
        await db.delete(g1ApplicationMarks).where(and(eq(g1ApplicationMarks.applicationId, input.applicationId), eq(g1ApplicationMarks.categoryType, input.categoryType), eq(g1ApplicationMarks.source, "admin"))).run();
        return { deleted: true };
      }),
    },
    applications: adminProcedure.input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(25), query: z.string().trim().default(""), sort: z.string().default("updatedAt"), sortDir: z.enum(["asc", "desc"]).default("desc"), status: z.enum(["all", "draft", "submitted", "invalid"]).default("all"), intakeYear: z.string().default("2027") })).handler(async ({ input }) => {
      const all = (await db.select().from(g1Applications).where(eq(g1Applications.intakeYear, input.intakeYear)).all()).map(applicationRecord).filter((record) => { if (input.query && !record.applicantName.toLowerCase().includes(input.query.toLowerCase()) && !record.sessionCode.toLowerCase().includes(input.query.toLowerCase()) && !record.accessKeyHint.toLowerCase().includes(input.query.toLowerCase())) return false; if (input.status !== "all") { if (input.status === "invalid" && record.validationErrors.length === 0) return false; if (input.status !== "invalid" && record.status !== input.status) return false; } return true; }).sort((a, b) => { const av = (a as unknown as Record<string, unknown>)[input.sort]; const bv = (b as unknown as Record<string, unknown>)[input.sort]; const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true }); return input.sortDir === "desc" ? -cmp : cmp; });
      const start = (input.page - 1) * input.pageSize;
      return { total: all.length, page: input.page, pageSize: input.pageSize, items: all.slice(start, start + input.pageSize) };
    }),
    application: {
      get: adminProcedure.input(z.object({ id: applicationIdSchema })).handler(async ({ input }) => {
        const row = await db.select().from(g1Applications).where(eq(g1Applications.id, input.id)).get();
        if (!row) throw new ORPCError("NOT_FOUND", { message: "Application not found" });
        return { id: row.id, sessionCode: await ensureSessionCode(row), data: withoutSchoolPreferences(row.data as Record<string, unknown>), createdAt: row.createdAt, updatedAt: row.updatedAt, submittedAt: row.submittedAt };
      }),
      update: adminProcedure.input(z.object({ id: applicationIdSchema, data: draftSchema })).handler(async ({ input }) => {
        const updatedAt = new Date();
        const birthCertificateNumber = extractBirthCertificateNumber(input.data);
        if (!birthCertificateNumber) throw new ORPCError("BAD_REQUEST", { message: "Birth certificate number is required" });
        const duplicate = await db.select({ id: g1Applications.id }).from(g1Applications).where(and(eq(g1Applications.birthCertificateNumber, birthCertificateNumber), isNotNull(g1Applications.submittedAt))).get();
        if (duplicate && duplicate.id !== input.id) throw new ORPCError("CONFLICT", { message: "An application with this birth certificate number has already been submitted. Please check the number and try again." });
        const existing = await db.select({ id: g1Applications.id }).from(g1Applications).where(eq(g1Applications.id, input.id)).get();
        if (!existing) throw new ORPCError("NOT_FOUND", { message: "Application not found" });
        await db.update(g1Applications).set({ birthCertificateNumber, data: withoutSchoolPreferences(input.data), updatedAt }).where(eq(g1Applications.id, input.id)).run();
        await publishApplicationChange();
        return { updatedAt };
      }),
      remove: adminProcedure.input(z.object({ id: applicationIdSchema })).handler(async ({ input }) => {
        const existing = await db.select({ id: g1Applications.id }).from(g1Applications).where(eq(g1Applications.id, input.id)).get();
        if (!existing) throw new ORPCError("NOT_FOUND", { message: "Application not found" });
        await db.delete(g1Applications).where(eq(g1Applications.id, input.id)).run();
        await publishApplicationChange();
        return { deleted: true };
      }),
    },
  },
  subAdmin: {
    forgotRequests: subAdminProcedure.input(paginationInput).handler(async ({ input }) => {
      const result = await paginateRequests("forgot", input.query, input.page, input.pageSize, ["applicantName", "birthCertificateNumber"], undefined, input.intakeYear);
      return { ...result, items: result.items.map((r) => ({ id: r.id, birthCertificateNumber: r.birthCertificateNumber, applicantName: r.applicantName, status: r.status, createdAt: r.createdAt })) };
    }),
    removalRequests: subAdminProcedure.input(paginationInput).handler(async ({ input }) => {
      const result = await paginateRequests("removal", input.query, input.page, input.pageSize, ["applicantName", "birthCertificateNumber"], undefined, input.intakeYear);
      return { ...result, items: result.items.map((r) => ({ id: r.id, birthCertificateNumber: r.birthCertificateNumber, applicantName: r.applicantName, status: r.status, createdAt: r.createdAt })) };
    }),
    rotateKey: subAdminProcedure.input(z.object({ requestId: z.string().uuid() })).handler(async ({ input }) => rotateRequestKey(input.requestId)),
    deleteAfterRemovalRequest: subAdminProcedure.input(z.object({ requestId: z.string().uuid() })).handler(async ({ input }) => deleteAfterRemoval(input.requestId)),
    dismiss: subAdminProcedure.input(z.object({ requestId: z.string().uuid() })).handler(async ({ input }) => dismissRequest(input.requestId)),
  },
};

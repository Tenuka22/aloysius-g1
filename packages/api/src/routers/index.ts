import { EventPublisher, eventIterator } from "@orpc/server";
import type { RouterClient } from "@orpc/server";

import { protectedProcedure, publicProcedure } from "../index";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { createDb } from "@aloysius-g1/db";
import { applications } from "@aloysius-g1/db";
import { eq } from "drizzle-orm";
import { env } from "@aloysius-g1/env/server";

const db = createDb();
const draftSchema = z.record(z.string(), z.unknown());
const keySchema = z.string().min(32).max(128);
const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
const createAccessKey = () => `ALY-${randomBytes(32).toString("base64url")}`;
const submissionOpensAt = new Date("2026-09-09T00:00:00+05:30");
const updatesCloseAt = new Date("2026-09-12T00:00:00+05:30");
const submissionLocked = () => env.NODE_ENV === "production" && new Date() < submissionOpensAt;
const applicationEvents = new EventPublisher<{ "application-count": { count: number } }>();
const applicationCount = async () => (await db.select({ id: applications.id }).from(applications).all()).length;

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
      await db.insert(applications).values({ id: randomUUID(), accessKeyHash: hashKey(accessKey), accessKeyHint: accessKey.slice(-6), birthCertificateNumber, data: input.data, createdAt: now, updatedAt: now });
      await applicationEvents.publish("application-count", { count: await applicationCount() });
      return { accessKey, data: input.data };
    }),
    get: publicProcedure.input(z.object({ accessKey: keySchema })).handler(async ({ input }) => {
      const row = await db.select().from(applications).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!row) throw new Error("Application key not found");
      return { data: row.data, updatedAt: row.updatedAt, accessKeyHint: row.accessKeyHint };
    }),
    remove: publicProcedure.input(z.object({ accessKey: keySchema })).handler(async ({ input }) => {
      const row = await db.select({ id: applications.id }).from(applications).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!row) throw new Error("Application key not found");
      await db.delete(applications).where(eq(applications.id, row.id)).run();
      await applicationEvents.publish("application-count", { count: await applicationCount() });
      return { deleted: true };
    }),
    liveCount: publicProcedure.output(eventIterator(z.object({ count: z.number() }))).handler(async function* ({ signal }) {
      yield { count: await applicationCount() };
      for await (const payload of applicationEvents.subscribe("application-count", { signal })) yield payload;
    }),
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
      await db.update(applications).set({ birthCertificateNumber, data: input.data, updatedAt }).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).run();
      const exists = await db.select({ id: applications.id }).from(applications).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).get();
      return { updatedAt };
    }),
    status: publicProcedure.handler(() => ({ submissionLocked: submissionLocked(), submissionOpensAt: submissionOpensAt.toISOString(), environment: env.NODE_ENV })),
    submit: publicProcedure.input(z.object({ accessKey: keySchema })).handler(async ({ input }) => {
      if (submissionLocked()) throw new Error("Submissions open on 9 September 2026");
      const row = await db.select({ id: applications.id }).from(applications).where(eq(applications.accessKeyHash, hashKey(input.accessKey))).get();
      if (!row) throw new Error("Application key not found");
      await db.update(applications).set({ submittedAt: new Date(), updatedAt: new Date() }).where(eq(applications.id, row.id)).run();
      return { accepted: true };
    }),
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

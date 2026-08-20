import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const applicationAccessRequests = sqliteTable("application_access_requests", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull(),
  birthCertificateNumber: text("birth_certificate_number").notNull(),
  applicantName: text("applicant_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  requestType: text("request_type").notNull().default("access"),
  status: text("status").notNull().default("open"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
});

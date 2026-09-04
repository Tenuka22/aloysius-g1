import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  sessionCode: text("session_code").notNull().unique(),
  accessKeyHash: text("access_key_hash").notNull().unique(),
  accessKeyHint: text("access_key_hint").notNull(),
  birthCertificateNumber: text("birth_certificate_number"),
  data: text("data", { mode: "json" }).notNull(),
  intakeYear: text("intake_year").notNull().default("2027"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
  admissionStatus: text("admission_status").notNull().default("pending"),
  interviewNotes: text("interview_notes").notNull().default(""),
  isBanned: integer("is_banned", { mode: "boolean" }).notNull().default(false),
  banReason: text("ban_reason"),
  admissionUpdatedAt: integer("admission_updated_at", { mode: "timestamp_ms" }),
  flags: text("flags", { mode: "json" }).notNull().default("[]"),
});

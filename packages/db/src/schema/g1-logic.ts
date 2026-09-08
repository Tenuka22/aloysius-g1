import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * G1 (Grade 1) admissions logic - applications, review workflow, scoring, and
 * the school catalog overrides that back the G1 admissions flow. Kept
 * separate from schema/auth.ts (shared across every admission type) so
 * future admission logics (e.g. a G6/G7 equivalent) get their own
 * `<grade>-logic.ts` file alongside this one instead of growing this file.
 * Every table/export here is g1-prefixed so it never collides with another
 * admission logic's tables in the shared SQLite database.
 */

export const g1Applications = sqliteTable("g1_applications", {
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
 // Tri-state skip tracking for fields the applicant is allowed to defer
 // ("Skip for now"): 0 = never skipped, 1 = currently skipped (still
 // empty), -1 = was skipped earlier but has since been filled in. Computed
 // server-side on every create/update from the draft's skip flags plus
 // whether the field actually has a value \u2014 kept as real columns (not just
 // buried in the `data` JSON blob) so admins can query/report on them.
 locationSkipStatus: integer("location_skip_status").notNull().default(0),
 birthCertificateSkipStatus: integer("birth_certificate_skip_status").notNull().default(0),
});

export const g1ApplicationSettings = sqliteTable("g1_application_settings", {
 id: text("id").primaryKey(),
 opensAt: integer("opens_at", { mode: "timestamp_ms" }).notNull(),
 closesAt: integer("closes_at", { mode: "timestamp_ms" }).notNull(),
 updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const g1ApplicationAccessRequests = sqliteTable("g1_application_access_requests", {
 id: text("id").primaryKey(),
 applicationId: text("application_id").notNull(),
 birthCertificateNumber: text("birth_certificate_number").notNull(),
 applicantName: text("applicant_name").notNull(),
 guardianName: text("guardian_name").notNull().default(""),
 contactEmail: text("contact_email").notNull(),
 contactPhone: text("contact_phone"),
 requestType: text("request_type").notNull().default("access"),
 status: text("status").notNull().default("open"),
 intakeYear: text("intake_year").notNull().default("2027"),
 createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
 resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
});

export const g1ApplicationMarks = sqliteTable("g1_application_marks", {
 id: text("id").primaryKey(),
 applicationId: text("application_id").notNull(),
 categoryType: text("category_type").notNull(),
 breakdown: text("breakdown", { mode: "json" }).notNull().default("[]"),
 total: integer("total").notNull().default(0),
 // "admin" rows are the authoritative, admin-verified score used everywhere
 // admission decisions are made. "applicant" rows are only the client-computed
 // indicative preview an applicant's own form submits for their own reference,
 // and must never be treated as authoritative or used to pre-fill admin's
 // editable score.
 source: text("source", { enum: ["admin", "applicant"] }).notNull().default("admin"),
 createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
 updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

/**
 * Manual lat/lng overrides for the Galle government school catalog.
 *
 * The base catalog (apps/web/src/lib/g1/schools.ts) is generated from the
 * schools.pdf scrape and ships with the web bundle. Schools that Google
 * Maps could not pin down are filled in by an admin through the schools hub;
 * those coordinates live here so every deployment and every client reads the
 * same overrides instead of editing checked-in JSON files.
 */
export const g1SchoolCoordinateOverrides = sqliteTable("g1_school_coordinate_overrides", {
 /** Web catalog id (apps/web SCHOOLS[].id, e.g. "madoowa-k-v-galle"). */
 id: text("id").primaryKey(),
 /** Display name snapshot, kept for readability outside the web app. */
 name: text("name").notNull(),
 latitude: real("latitude").notNull(),
 longitude: real("longitude").notNull(),
 note: text("note").notNull().default(""),
 updatedBy: text("updated_by").notNull().default(""),
 updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type G1SchoolCoordinateOverride = typeof g1SchoolCoordinateOverrides.$inferSelect;
export type G1SchoolCoordinateOverrideInsert = typeof g1SchoolCoordinateOverrides.$inferInsert;

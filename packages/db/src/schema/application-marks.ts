import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const applicationMarks = sqliteTable("application_marks", {
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

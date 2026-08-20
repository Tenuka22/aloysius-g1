import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  sessionCode: text("session_code").notNull().unique(),
  accessKeyHash: text("access_key_hash").notNull().unique(),
  accessKeyHint: text("access_key_hint").notNull(),
  birthCertificateNumber: text("birth_certificate_number").unique(),
  data: text("data", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
});

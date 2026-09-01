import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const applicationMarks = sqliteTable("application_marks", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull(),
  categoryType: text("category_type").notNull(),
  breakdown: text("breakdown", { mode: "json" }).notNull().default("[]"),
  total: integer("total").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

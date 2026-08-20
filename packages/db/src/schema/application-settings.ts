import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const applicationSettings = sqliteTable("application_settings", {
  id: text("id").primaryKey(),
  opensAt: integer("opens_at", { mode: "timestamp_ms" }).notNull(),
  closesAt: integer("closes_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Manual lat/lng overrides for the Galle government school catalog.
 *
 * The base catalog (apps/web/src/lib/schools.ts) is generated from the
 * schools.pdf scrape and ships with the web bundle.  Schools that Google
 * Maps could not pin down are filled in by an admin through the schools hub;
 * those coordinates live here so every deployment and every client reads the
 * same overrides instead of editing checked-in JSON files.
 */
export const schoolCoordinateOverrides = sqliteTable("school_coordinate_overrides", {
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

export type SchoolCoordinateOverride = typeof schoolCoordinateOverrides.$inferSelect;
export type SchoolCoordinateOverrideInsert = typeof schoolCoordinateOverrides.$inferInsert;

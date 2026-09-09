import catalog from "@aloysius-admissions/db/schools-catalog";

/**
 * The Grade 1 school catalog, re-exported so the web app can read it without
 * depending on `@aloysius-admissions/db` directly.
 *
 * This file deliberately imports nothing but the JSON. Reaching the catalog
 * through `../index` would pull in `createDb()` and therefore `bun:sqlite`,
 * which cannot be bundled for the browser — keeping this a leaf module is what
 * makes the same data safe to use on both sides of the wire.
 */
export type SchoolCatalogEntry = {
  id: string;
  en: string;
  si: string;
  lat: number | null;
  lng: number | null;
  genderType: string;
  schoolType: string;
  districtId: string;
  dsId: string;
};

export const SCHOOL_CATALOG = catalog as SchoolCatalogEntry[];

export default SCHOOL_CATALOG;

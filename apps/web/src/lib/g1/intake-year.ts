import { z } from "zod";

/** Fallback intake year used across admin routes and the API when none is specified. */
export const INTAKE_YEAR_DEFAULT = "2027";

/**
 * Shared search-param schema so every admin route parses/serializes `intakeYear`
 * identically.
 *
 * Two quirks are normalised here rather than at the callers:
 * - TanStack Router's default search parser turns numeric-looking query values
 *   (e.g. `?intakeYear=2027`) into JS numbers before validateSearch runs, so
 *   this must coerce back to a string.
 * - URLs written by hand or by an older build can carry the value JSON-quoted
 *   (`?intakeYear=%222027%22`). Coercing that yields `'"2027"'` with literal
 *   quotes, which then silently matches no data anywhere. The quotes are
 *   stripped so the schema always yields a bare year.
 */
export const intakeYearSearchSchema = z.object({
  // The inner schema must stay `z.coerce.string().default(...)` so the inferred
  // search type matches what the routes were written against (`search={true}`
  // links type-check only while the input side stays optional/unknown).
  // Preprocess just normalizes the quirky shapes - numbers, JSON-quoted values
  // like `%222027%22`, and empties - into a bare year or `undefined` before the
  // inner schema runs (a plain `.default()` would not fire for `""`).
  intakeYear: z.preprocess((value) => {
    const coerced = typeof value === "string" ? value : String(value ?? "");
    const unquoted = coerced.replace(/^"(.*)"$/, "$1").trim();
    return unquoted.length > 0 ? unquoted : undefined;
  }, z.coerce.string().default(INTAKE_YEAR_DEFAULT)),
});

export type IntakeYearSearch = z.infer<typeof intakeYearSearchSchema>;

/** Selectable intake years for the admin sidebar (last year through five years out). */
export function intakeYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let year = currentYear - 1; year <= currentYear + 5; year++) years.push(String(year));
  return years;
}

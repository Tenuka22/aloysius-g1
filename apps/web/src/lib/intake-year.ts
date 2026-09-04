import { z } from "zod";

/** Fallback intake year used across admin routes and the API when none is specified. */
export const INTAKE_YEAR_DEFAULT = "2027";

/** Shared search-param schema so every admin route parses/serializes `intakeYear` identically. */
export const intakeYearSearchSchema = z.object({
  // TanStack Router's default search parser turns numeric-looking query values (e.g. `?intakeYear=2027`)
  // into JS numbers, so this must coerce back to a string rather than requiring one.
  intakeYear: z.coerce.string().default(INTAKE_YEAR_DEFAULT),
});

export type IntakeYearSearch = z.infer<typeof intakeYearSearchSchema>;

/** Selectable intake years for the admin sidebar (last year through five years out). */
export function intakeYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let year = currentYear - 1; year <= currentYear + 5; year++) years.push(String(year));
  return years;
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTAKE_YEAR_DEFAULT, intakeYearOptions, intakeYearSearchSchema } from "./intake-year";

describe("intakeYearSearchSchema", () => {
  it("defaults to INTAKE_YEAR_DEFAULT when intakeYear is missing", () => {
    expect(intakeYearSearchSchema.parse({})).toEqual({ intakeYear: INTAKE_YEAR_DEFAULT });
  });

  it("passes through a string value unchanged", () => {
    expect(intakeYearSearchSchema.parse({ intakeYear: "2030" })).toEqual({ intakeYear: "2030" });
  });

  it("coerces a numeric value to a string", () => {
    // TanStack Router's default search codec parses numeric-looking query values
    // (e.g. `?intakeYear=2027`) into JS numbers before validateSearch runs, so this
    // schema must accept a number and normalize it to a string - regression guard
    // for the bug where `z.string()` alone rejected `2027` as `expected string, got number`.
    const result = intakeYearSearchSchema.parse({ intakeYear: 2027 });
    expect(result).toEqual({ intakeYear: "2027" });
    expect(typeof result.intakeYear).toBe("string");
  });

  it("still resolves to the default when intakeYear is explicitly undefined", () => {
    expect(intakeYearSearchSchema.parse({ intakeYear: undefined })).toEqual({ intakeYear: INTAKE_YEAR_DEFAULT });
  });

  it("strips JSON quotes from a hand-written URL value", () => {
    // A URL like `?intakeYear=%222027%22` (JSON-quoted by an older serializer or
    // pasted by hand) used to coerce to `"2027"` WITH literal quotes, which then
    // matched no data on any admin query.
    expect(intakeYearSearchSchema.parse({ intakeYear: '"2027"' })).toEqual({ intakeYear: "2027" });
  });

  it("falls back to the default for empty or quote-only values", () => {
    expect(intakeYearSearchSchema.parse({ intakeYear: "" })).toEqual({ intakeYear: INTAKE_YEAR_DEFAULT });
    expect(intakeYearSearchSchema.parse({ intakeYear: '""' })).toEqual({ intakeYear: INTAKE_YEAR_DEFAULT });
  });

  it("strips unknown keys rather than passing them through", () => {
    const result = intakeYearSearchSchema.parse({ intakeYear: "2027", mode: "edit" });
    expect(result).toEqual({ intakeYear: "2027" });
    expect((result as Record<string, unknown>).mode).toBeUndefined();
  });
});

describe("intakeYearOptions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns one year before the current year through five years after it", () => {
    expect(intakeYearOptions()).toEqual(["2025", "2026", "2027", "2028", "2029", "2030", "2031"]);
  });

  it("returns years as strings, in ascending order", () => {
    const options = intakeYearOptions();
    expect(options.every((year) => typeof year === "string")).toBe(true);
    expect(options).toEqual([...options].sort());
  });

  it("always includes the shared default intake year", () => {
    expect(intakeYearOptions()).toContain(INTAKE_YEAR_DEFAULT);
  });
});

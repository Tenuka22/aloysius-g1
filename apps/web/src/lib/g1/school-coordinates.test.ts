// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applySchoolCoordinateOverrides,
  findSchoolById,
  getSchools,
  hasHydratedSchoolCoordinates,
  refreshSchoolCoordinateOverrides,
  schoolCoordinateOverride,
  schoolsWithCoordinates,
} from "./school-coordinates";
import { SCHOOLS } from "./schools";

vi.mock("@/utils/orpc", () => ({
  client: {
    schools: {
      overrides: vi.fn(),
    },
  },
}));

import { client } from "@/utils/orpc";

function baseRow(overrides: Partial<{ id: string; name: string; latitude: number; longitude: number; note: string | null; updatedBy: string; updatedAt: Date }> = {}) {
  return {
    id: "rewatha-national-college-galle",
    name: "Rewatha National College",
    latitude: 6.3,
    longitude: 80.1,
    note: null,
    updatedBy: "admin-1",
    updatedAt: new Date("2026-01-15T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(client.schools.overrides).mockReset();
  // Reset the module's private override map / hydration flag.
  applySchoolCoordinateOverrides([]);
  hasHydratedSchoolCoordinates();
});

describe("applySchoolCoordinateOverrides", () => {
  it("marks the module hydrated after applying overrides", () => {
    expect(hasHydratedSchoolCoordinates()).toBe(true);
  });

  it("stores a normalized override per school id", () => {
    applySchoolCoordinateOverrides([
      baseRow({ id: "school-a", latitude: 7.5, longitude: 81.2, note: "moved by admin" }),
    ]);
    const override = schoolCoordinateOverride("school-a");
    expect(override).toBeDefined();
    expect(override!.lat).toBe(7.5);
    expect(override!.lng).toBe(81.2);
    expect(override!.note).toBe("moved by admin");
    expect(override!.updatedAt).toBeInstanceOf(Date);
  });

  it("coerces updatedAt strings into Date objects", () => {
    applySchoolCoordinateOverrides([baseRow({ updatedAt: "2026-02-01T00:00:00.000Z" as unknown as Date })]);
    expect(schoolCoordinateOverride("rewatha-national-college-galle")!.updatedAt).toBeInstanceOf(Date);
  });

  it("maps a null note to undefined", () => {
    applySchoolCoordinateOverrides([baseRow({ note: null })]);
    expect(schoolCoordinateOverride("rewatha-national-college-galle")!.note).toBeUndefined();
  });

  it("replaces the previous override set entirely", () => {
    applySchoolCoordinateOverrides([baseRow({ id: "school-a" })]);
    applySchoolCoordinateOverrides([baseRow({ id: "school-b" })]);
    expect(schoolCoordinateOverride("school-a")).toBeUndefined();
    expect(schoolCoordinateOverride("school-b")).toBeDefined();
  });
});

describe("getSchools", () => {
  it("returns the baked-in catalog when no overrides are applied", () => {
    applySchoolCoordinateOverrides([]);
    expect(getSchools()).toEqual(SCHOOLS);
  });

  it("applies manual coordinates over the catalog", () => {
    applySchoolCoordinateOverrides([baseRow({ id: "rewatha-national-college-galle", latitude: 1.23, longitude: 4.56 })]);
    const school = getSchools().find((s) => s.id === "rewatha-national-college-galle");
    expect(school!.lat).toBe(1.23);
    expect(school!.lng).toBe(4.56);
    // Untouched schools keep their catalog values.
    const untouched = getSchools().find((s) => s.id !== "rewatha-national-college-galle");
    expect(untouched).toEqual(SCHOOLS.find((s) => s.id === untouched!.id));
  });

  it("returns the same array identity when hydrated but empty", () => {
    applySchoolCoordinateOverrides([]);
    expect(getSchools()).toBe(SCHOOLS);
  });
});

describe("schoolsWithCoordinates", () => {
  it("excludes schools without coordinates", () => {
    const located = schoolsWithCoordinates();
    expect(located.length).toBeLessThan(SCHOOLS.length);
    expect(located.every((s) => s.lat !== null && s.lng !== null)).toBe(true);
    // The catalog contains at least one school without coordinates.
    expect(SCHOOLS.some((s) => s.lat === null || s.lng === null)).toBe(true);
  });

  it("honors overrides when filtering", () => {
    applySchoolCoordinateOverrides([baseRow({ id: "rewatha-national-college-galle", latitude: 9.99, longitude: 9.99 })]);
    const school = schoolsWithCoordinates().find((s) => s.id === "rewatha-national-college-galle");
    expect(school!.lat).toBe(9.99);
  });
});

describe("findSchoolById", () => {
  it("finds a school by id", () => {
    expect(findSchoolById("rewatha-national-college-galle")!.en).toBe("Rewatha National College");
  });

  it("returns undefined for an unknown id", () => {
    expect(findSchoolById("nope")).toBeUndefined();
  });
});

describe("refreshSchoolCoordinateOverrides", () => {
  it("applies rows from the API", async () => {
    vi.mocked(client.schools.overrides).mockResolvedValue([
      baseRow({ id: "school-x", latitude: 5.5, longitude: 5.5 }),
    ]);
    await refreshSchoolCoordinateOverrides();
    expect(schoolCoordinateOverride("school-x")).toBeDefined();
    expect(hasHydratedSchoolCoordinates()).toBe(true);
  });

  it("keeps the previous overrides when the API fails", async () => {
    applySchoolCoordinateOverrides([baseRow({ id: "school-keep" })]);
    vi.mocked(client.schools.overrides).mockRejectedValue(new Error("offline"));
    await refreshSchoolCoordinateOverrides();
    expect(schoolCoordinateOverride("school-keep")).toBeDefined();
  });

  it("passes an abort signal with a timeout to the API call", async () => {
    vi.mocked(client.schools.overrides).mockResolvedValue([]);
    await refreshSchoolCoordinateOverrides();
    const call = vi.mocked(client.schools.overrides).mock.calls[0];
    const options = call?.[1] as { signal?: AbortSignal } | undefined;
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });
});

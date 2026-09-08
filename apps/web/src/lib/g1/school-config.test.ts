import { describe, expect, it } from "vitest";
import {
  ADMISSION_RESTRICTIONS,
  G1_AGE_ELIGIBILITY,
  HOME_SCHOOL_ID,
  MAP_MARKER_COLORS,
  getHomeSchoolDisplayName,
} from "./school-config";

describe("HOME_SCHOOL_ID", () => {
  it("is a non-empty string", () => {
    expect(typeof HOME_SCHOOL_ID).toBe("string");
    expect(HOME_SCHOOL_ID.length).toBeGreaterThan(0);
  });
});

describe("getHomeSchoolDisplayName", () => {
  it("returns the English name of the home school", () => {
    expect(getHomeSchoolDisplayName()).toBe("St. Aloysius' College");
  });

  it("returns a non-empty string", () => {
    const name = getHomeSchoolDisplayName();
    expect(name.length).toBeGreaterThan(0);
  });
});

describe("MAP_MARKER_COLORS", () => {
  it("has all required color keys", () => {
    const requiredKeys = [
      "home",
      "applied",
      "selectedIn",
      "selectedOut",
      "unselectedIn",
      "unselectedOut",
      "ineligible",
      "radius",
      "line",
    ];
    for (const key of requiredKeys) {
      expect(MAP_MARKER_COLORS).toHaveProperty(key);
    }
  });

  it("has valid hex colors for bg/border keys", () => {
    const hexColorKeys = ["home", "applied", "selectedIn", "selectedOut", "unselectedIn", "unselectedOut", "ineligible"] as const;
    const hexRegex = /^#[0-9a-f]{6}$/i;
    for (const key of hexColorKeys) {
      expect(MAP_MARKER_COLORS[key].bg).toMatch(hexRegex);
      expect(MAP_MARKER_COLORS[key].border).toMatch(hexRegex);
    }
  });

  it("has valid hex colors for radius key", () => {
    const hexRegex = /^#[0-9a-f]{6}$/i;
    expect(MAP_MARKER_COLORS.radius.stroke).toMatch(hexRegex);
    expect(MAP_MARKER_COLORS.radius.fill).toMatch(hexRegex);
  });

  it("has valid hex colors for line key", () => {
    const hexRegex = /^#[0-9a-f]{6}$/i;
    expect(MAP_MARKER_COLORS.line.in).toMatch(hexRegex);
    expect(MAP_MARKER_COLORS.line.out).toMatch(hexRegex);
  });
});

describe("ADMISSION_RESTRICTIONS", () => {
  it("has disallowedGenders as a non-empty array", () => {
    expect(Array.isArray(ADMISSION_RESTRICTIONS.disallowedGenders)).toBe(true);
    expect(ADMISSION_RESTRICTIONS.disallowedGenders.length).toBeGreaterThan(0);
  });

  it("has disallowedReligions as a non-empty array", () => {
    expect(Array.isArray(ADMISSION_RESTRICTIONS.disallowedReligions)).toBe(true);
    expect(ADMISSION_RESTRICTIONS.disallowedReligions.length).toBeGreaterThan(0);
  });

  it("has allowedEducationMediums as a non-empty array", () => {
    expect(Array.isArray(ADMISSION_RESTRICTIONS.allowedEducationMediums)).toBe(true);
    expect(ADMISSION_RESTRICTIONS.allowedEducationMediums.length).toBeGreaterThan(0);
  });

  it("has a restrictGenderMessage string", () => {
    expect(typeof ADMISSION_RESTRICTIONS.restrictGenderMessage).toBe("string");
    expect(ADMISSION_RESTRICTIONS.restrictGenderMessage!.length).toBeGreaterThan(0);
  });

  it("has a restrictReligionMessage string", () => {
    expect(typeof ADMISSION_RESTRICTIONS.restrictReligionMessage).toBe("string");
    expect(ADMISSION_RESTRICTIONS.restrictReligionMessage!.length).toBeGreaterThan(0);
  });
});

describe("G1_AGE_ELIGIBILITY", () => {
  it("has minYears as a positive number", () => {
    expect(typeof G1_AGE_ELIGIBILITY.minYears).toBe("number");
    expect(G1_AGE_ELIGIBILITY.minYears).toBeGreaterThan(0);
  });

  it("has maxYears >= minYears", () => {
    expect(G1_AGE_ELIGIBILITY.maxYears).toBeGreaterThanOrEqual(G1_AGE_ELIGIBILITY.minYears);
  });
});

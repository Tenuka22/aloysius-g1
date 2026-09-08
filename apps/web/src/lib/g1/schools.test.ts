import { describe, expect, it } from "vitest";
import { SCHOOLS } from "./schools";

describe("SCHOOLS data integrity", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(SCHOOLS)).toBe(true);
    expect(SCHOOLS.length).toBeGreaterThan(0);
  });

  it("has unique IDs across all schools", () => {
    const ids = SCHOOLS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("every school has a non-empty id", () => {
    for (const school of SCHOOLS) {
      expect(typeof school.id).toBe("string");
      expect(school.id.length).toBeGreaterThan(0);
    }
  });

  it("every school has a non-empty English name", () => {
    for (const school of SCHOOLS) {
      expect(typeof school.en).toBe("string");
      expect(school.en.length).toBeGreaterThan(0);
    }
  });

  it("every school has a genderType that is one of the valid values", () => {
    const validGenderTypes = ["boys", "girls", "mixed"];
    for (const school of SCHOOLS) {
      expect(validGenderTypes).toContain(school.genderType);
    }
  });

  it("every school has a schoolType that is one of the valid values", () => {
    const validSchoolTypes = ["national", "provincial"];
    for (const school of SCHOOLS) {
      expect(validSchoolTypes).toContain(school.schoolType);
    }
  });

  it("every school has a non-empty districtId", () => {
    for (const school of SCHOOLS) {
      expect(typeof school.districtId).toBe("string");
      expect(school.districtId.length).toBeGreaterThan(0);
    }
  });

  it("every school has a non-empty dsId", () => {
    for (const school of SCHOOLS) {
      expect(typeof school.dsId).toBe("string");
      expect(school.dsId.length).toBeGreaterThan(0);
    }
  });

  it("latitude values are within Sri Lanka bounds when present", () => {
    for (const school of SCHOOLS) {
      if (school.lat !== null) {
        expect(school.lat).toBeGreaterThanOrEqual(5.9);
        expect(school.lat).toBeLessThanOrEqual(9.9);
      }
    }
  });

  it("longitude values are within Sri Lanka bounds when present", () => {
    for (const school of SCHOOLS) {
      if (school.lng !== null) {
        expect(school.lng).toBeGreaterThanOrEqual(79.5);
        expect(school.lng).toBeLessThanOrEqual(82.0);
      }
    }
  });

  it("has at least one national school", () => {
    expect(SCHOOLS.some((s) => s.schoolType === "national")).toBe(true);
  });

  it("has at least one provincial school", () => {
    expect(SCHOOLS.some((s) => s.schoolType === "provincial")).toBe(true);
  });

  it("has at least one boys school", () => {
    expect(SCHOOLS.some((s) => s.genderType === "boys")).toBe(true);
  });

  it("has at least one girls school", () => {
    expect(SCHOOLS.some((s) => s.genderType === "girls")).toBe(true);
  });

  it("has at least one mixed school", () => {
    expect(SCHOOLS.some((s) => s.genderType === "mixed")).toBe(true);
  });

  it("coordinates are consistently null or present (both lat and lng)", () => {
    for (const school of SCHOOLS) {
      if (school.lat === null) {
        expect(school.lng).toBeNull();
      }
      if (school.lng === null) {
        expect(school.lat).toBeNull();
      }
    }
  });
});

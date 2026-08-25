import { describe, expect, it } from "vitest";
import { findSchoolById, getSchoolsWithinRadius, haversineDistanceKm } from "./school-utils";

describe("haversineDistanceKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistanceKm(6.0343, 80.2170, 6.0343, 80.2170)).toBe(0);
  });

  it("returns the known Galle to Matara distance within tolerance", () => {
    const km = haversineDistanceKm(6.0343, 80.2170, 5.9549, 80.5549);
    expect(km).toBeGreaterThan(35);
    expect(km).toBeLessThan(42);
  });
});

describe("findSchoolById", () => {
  it("finds a school by id", () => {
    expect(findSchoolById("st-aloysius-galle")?.en).toBe("St. Aloysius' College");
  });

  it("returns undefined for unknown ids", () => {
    expect(findSchoolById("not-a-school")).toBeUndefined();
  });
});

describe("getSchoolsWithinRadius", () => {
  const centerLat = 6.0343;
  const centerLng = 80.2170;

  it("includes nearby Galle schools within 5 km and excludes Matara schools", () => {
    const results = getSchoolsWithinRadius(centerLat, centerLng, 5);
    const ids = results.map((school) => school.id);
    expect(ids).toContain("richmond-galle");
    expect(ids).toContain("mahinda-galle");
    expect(ids).toContain("southlands-galle");
    expect(ids).not.toContain("rahula-matara");
    expect(results.every((school) => school.dsId !== "matara-ds")).toBe(true);
  });

  it("sorts results ascending by distance", () => {
    const results = getSchoolsWithinRadius(centerLat, centerLng, 5);
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i].distanceKm).toBeGreaterThanOrEqual(results[i - 1].distanceKm);
    }
  });

  it("attaches distanceKm matching haversineDistanceKm", () => {
    const results = getSchoolsWithinRadius(centerLat, centerLng, 5);
    const richmond = results.find((school) => school.id === "richmond-galle");
    expect(richmond?.distanceKm).toBeCloseTo(haversineDistanceKm(centerLat, centerLng, 6.0562, 80.2205), 9);
  });

  it("returns nothing for radius 0", () => {
    expect(getSchoolsWithinRadius(centerLat, centerLng, 0)).toHaveLength(0);
  });
});

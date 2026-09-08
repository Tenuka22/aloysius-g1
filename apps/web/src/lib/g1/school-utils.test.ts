import { describe, expect, it } from "vitest";
import { compatibleSchoolsWithinRadius, findSchoolById, getAllSchoolsWithDistance, getSchoolsWithinRadius, haversineDistanceKm, isGenderCompatible } from "./school-utils";
import { HOME_SCHOOL_ID } from "./school-config";

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
    expect(findSchoolById(HOME_SCHOOL_ID)?.en).toBe("St. Aloysius' College");
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
    expect(richmond?.distanceKm).toBeCloseTo(haversineDistanceKm(centerLat, centerLng, 6.052348, 80.204162), 9);
  });

  it("returns nothing for radius 0", () => {
    expect(getSchoolsWithinRadius(centerLat, centerLng, 0)).toHaveLength(0);
  });
});

describe("isGenderCompatible", () => {
  it("treats a mixed applied school as compatible with any nearby school", () => {
    expect(isGenderCompatible("boys", "mixed")).toBe(true);
    expect(isGenderCompatible("girls", "mixed")).toBe(true);
  });

  it("treats a mixed nearby school as compatible with any applied school", () => {
    expect(isGenderCompatible("mixed", "boys")).toBe(true);
    expect(isGenderCompatible("mixed", "girls")).toBe(true);
  });

  it("rejects an opposite-gender nearby school", () => {
    expect(isGenderCompatible("girls", "boys")).toBe(false);
    expect(isGenderCompatible("boys", "girls")).toBe(false);
  });

  it("accepts a same-gender nearby school", () => {
    expect(isGenderCompatible("boys", "boys")).toBe(true);
  });
});

describe("compatibleSchoolsWithinRadius", () => {
  // The home school (St. Aloysius' College, Galle) is a boys' school; used throughout the
  // scoring UI as the fixed "applied school" for the proximity criterion.
  const targetId = HOME_SCHOOL_ID;
  const centerLat = 6.0343;
  const centerLng = 80.217;

  it("computes the radius as the home-to-applied-school distance", () => {
    const target = findSchoolById(targetId)!;
    const { radiusKm } = compatibleSchoolsWithinRadius(centerLat, centerLng, targetId);
    expect(radiusKm).toBeCloseTo(haversineDistanceKm(centerLat, centerLng, target.lat!, target.lng!), 9);
  });

  it("never includes the applied-to school itself", () => {
    const { schoolIds } = compatibleSchoolsWithinRadius(centerLat, centerLng, targetId);
    expect(schoolIds).not.toContain(targetId);
  });

  it("excludes every girls' school regardless of distance, since the applied school is boys'", () => {
    const { schoolIds } = compatibleSchoolsWithinRadius(centerLat, centerLng, targetId);
    const included = getAllSchoolsWithDistance(centerLat, centerLng).filter((school) => schoolIds.includes(school.id));
    expect(included.some((school) => school.genderType === "girls")).toBe(false);
  });

  it("only includes schools strictly within the computed radius", () => {
    const { radiusKm, schoolIds } = compatibleSchoolsWithinRadius(centerLat, centerLng, targetId);
    const included = getAllSchoolsWithDistance(centerLat, centerLng).filter((school) => schoolIds.includes(school.id));
    expect(included.every((school) => school.distanceKm <= radiusKm)).toBe(true);
  });

  it("matches manually filtering getAllSchoolsWithDistance by radius and gender compatibility", () => {
    const target = findSchoolById(targetId)!;
    const { radiusKm, schoolIds } = compatibleSchoolsWithinRadius(centerLat, centerLng, targetId);
    const expected = getAllSchoolsWithDistance(centerLat, centerLng)
      .filter((school) => school.id !== targetId)
      .filter((school) => school.distanceKm <= radiusKm)
      .filter((school) => isGenderCompatible(school.genderType, target.genderType))
      .map((school) => school.id)
      .sort();
    expect([...schoolIds].sort()).toEqual(expected);
  });

  it("returns an empty result for an unknown target school id", () => {
    expect(compatibleSchoolsWithinRadius(centerLat, centerLng, "not-a-school")).toEqual({ radiusKm: 10, schoolIds: [] });
  });
});

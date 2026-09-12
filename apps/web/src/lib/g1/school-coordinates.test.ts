import { describe, expect, it } from "vitest";
import { findSchoolById, getSchools, schoolsWithCoordinates } from "./school-coordinates";
import { SCHOOLS } from "./schools";

describe("getSchools", () => {
  it("returns the baked-in catalog", () => {
    expect(getSchools()).toEqual(SCHOOLS);
  });
});

describe("schoolsWithCoordinates", () => {
  it("returns only schools with both a latitude and a longitude", () => {
    const located = schoolsWithCoordinates();
    expect(located.length).toBeGreaterThan(0);
    expect(located.every((school) => school.lat !== null && school.lng !== null)).toBe(true);
    expect(located.length).toBeLessThan(SCHOOLS.length);
  });
});

describe("findSchoolById", () => {
  it("finds a known school by id", () => {
    const [first] = SCHOOLS;
    expect(findSchoolById(first!.id)).toEqual(first);
  });

  it("returns undefined for an unknown id", () => {
    expect(findSchoolById("does-not-exist")).toBeUndefined();
  });
});

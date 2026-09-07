import { type GenderType, type School } from "./schools";
import { findSchoolById, getSchools } from "./school-coordinates";

export { findSchoolById };

type LocatedSchool = School & { lat: number; lng: number };

export type SchoolWithDistance = LocatedSchool & { distanceKm: number };

function hasCoordinates(school: School): school is LocatedSchool {
  return school.lat !== null && school.lng !== null;
}

export const DEFAULT_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 25;
export const EXTRA_OUTSIDE_SCHOOLS = 5;

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getSchoolsWithinRadius(centerLat: number, centerLng: number, radiusKm: number): Array<LocatedSchool & { distanceKm: number }> {
  return getSchools()
    .filter(hasCoordinates)
    .map((school) => ({ ...school, distanceKm: haversineDistanceKm(centerLat, centerLng, school.lat, school.lng) }))
    .filter((school) => school.distanceKm < radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function getAllSchoolsWithDistance(centerLat: number, centerLng: number): Array<LocatedSchool & { distanceKm: number }> {
  return getSchools()
    .filter(hasCoordinates)
    .map((school) => ({ ...school, distanceKm: haversineDistanceKm(centerLat, centerLng, school.lat, school.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function getSchoolsWithClassification(centerLat: number, centerLng: number, radiusKm: number = DEFAULT_RADIUS_KM): { within: Array<LocatedSchool & { distanceKm: number }>; outside: Array<LocatedSchool & { distanceKm: number }> } {
  const all = getAllSchoolsWithDistance(centerLat, centerLng);
  const within = all.filter((s) => s.distanceKm <= radiusKm);
  const outside = all.filter((s) => s.distanceKm > radiusKm).slice(0, EXTRA_OUTSIDE_SCHOOLS);
  return { within, outside };
}

export function isGenderCompatible(schoolGenderType: GenderType, appliedSchoolGenderType: GenderType): boolean {
  if (appliedSchoolGenderType === "mixed") return true;
  return schoolGenderType === appliedSchoolGenderType || schoolGenderType === "mixed";
}

/**
 * Objective "nearby schools" proximity criterion: draws a radius from the
 * applicant's home to the applied-to school, then returns every OTHER school
 * within that radius whose gender intake is compatible with the applied-to
 * school (e.g. a boys' school never counts a girls'-only school as a
 * competing alternative). This is a pure geometry + eligibility computation
 * with no manual input required, so an applicant is never able to decide
 * which nearby schools count toward their own proximity deduction.
 */
export function compatibleSchoolsWithinRadius(centerLat: number, centerLng: number, targetSchoolId: string): { radiusKm: number; schoolIds: string[] } {
  const target = findSchoolById(targetSchoolId);
  if (!target || target.lat == null || target.lng == null) return { radiusKm: DEFAULT_RADIUS_KM, schoolIds: [] };
  const radiusKm = haversineDistanceKm(centerLat, centerLng, target.lat, target.lng);
  const schoolIds = getAllSchoolsWithDistance(centerLat, centerLng)
    .filter((school) => school.id !== targetSchoolId)
    .filter((school) => school.distanceKm <= radiusKm)
    .filter((school) => isGenderCompatible(school.genderType, target.genderType))
    .map((school) => school.id);
  return { radiusKm, schoolIds };
}

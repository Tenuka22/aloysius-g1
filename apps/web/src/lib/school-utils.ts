import { type School, SCHOOLS } from "./schools";

export const DEFAULT_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 25;

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getSchoolsWithinRadius(centerLat: number, centerLng: number, radiusKm: number): Array<School & { distanceKm: number }> {
  return SCHOOLS.map((school) => ({ ...school, distanceKm: haversineDistanceKm(centerLat, centerLng, school.lat, school.lng) }))
    .filter((school) => school.distanceKm < radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function findSchoolById(id: string): School | undefined {
  return SCHOOLS.find((school) => school.id === id);
}

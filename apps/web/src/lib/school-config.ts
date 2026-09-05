/**
 * Centralised school-specific configuration.
 *
 * Change these values when deploying the app for a different school.
 * All components and pages should import from here rather than
 * hardcoding school IDs, brand colours, or map marker colours.
 */

import { findSchoolById } from "./school-utils";

export const HOME_SCHOOL_ID = "st-aloysius-galle";

export function getHomeSchoolDisplayName(): string {
  return findSchoolById(HOME_SCHOOL_ID)?.en ?? "this school";
}

export const MAP_MARKER_COLORS = {
  home:      { bg: "#dc2626", border: "#991b1b" },
  applied:   { bg: "#f59e0b", border: "#b45309" },
  selectedIn:  { bg: "#087f5b", border: "#065f46" },
  selectedOut: { bg: "#f97316", border: "#c2410c" },
  unselectedIn:  { bg: "#64748b", border: "#475569" },
  unselectedOut: { bg: "#94a3b8", border: "#64748b" },
  ineligible: { bg: "#c4b5fd", border: "#8b5cf6" },
  radius:    { stroke: "#087f5b", fill: "#13b77e" },
  line:      { in: "#087f5b", out: "#f97316" },
} as const;

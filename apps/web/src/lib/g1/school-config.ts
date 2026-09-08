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

export type AdmissionRestrictions = {
  disallowedGenders: readonly string[];
  disallowedReligions: readonly string[];
  allowedEducationMediums: readonly string[];
  restrictGenderMessage?: string;
  restrictReligionMessage?: string;
  restrictMediumMessage?: string;
};

export const ADMISSION_RESTRICTIONS: AdmissionRestrictions = {
  disallowedGenders: ["Female"],
  disallowedReligions: ["Christian"],
  allowedEducationMediums: ["Sinhala"],
  restrictGenderMessage: "This is a boys\u2019 school, so female applicants cannot continue with this application.",
  restrictReligionMessage: "This intake is not available to Christian applicants.",
  restrictMediumMessage: "",
};

export type G1AgeEligibility = {
  /**
   * The applicant must be at least this many years old on the admission
   * cutoff date (31 January of the intake year).
   */
  minYears: number;
  /**
   * The applicant must not yet have turned `maxYears + 1` by the admission
   * cutoff date - e.g. with `maxYears: 5`, a child who has already turned 6
   * (or older) by the cutoff is not eligible.
   */
  maxYears: number;
};

export const G1_AGE_ELIGIBILITY: G1AgeEligibility = {
  minYears: 5,
  maxYears: 5,
};

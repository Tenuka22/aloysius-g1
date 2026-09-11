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

/**
 * Admissions office support contact, shown wherever an applicant is blocked
 * from making a change themselves (e.g. the submission window has closed) so
 * they have a way to reach the school directly instead of being stuck.
 */
export const SUPPORT_CONTACT = {
  /** Local dialling format, as printed to the applicant. */
  phoneDisplay: "077 936 8304",
  /** E.164 form (country code 94, no leading 0) required by the wa.me deep link. */
  whatsappNumber: "94779368304",
};

/**
 * A wa.me deep link pre-filled with a support message that already carries
 * the applicant's session/submission code, so the office does not have to
 * ask which application a chat is about. `[describe your issue]` is a
 * placeholder the applicant is expected to replace before sending, not
 * something this app can fill in on their behalf.
 */
export function buildSupportWhatsAppLink(sessionCode: string): string {
  const code = sessionCode.trim() || "-";
  const message =
    `I've an issue [describe your issue here] for the submission ${code} and I would like to be able ` +
    "to fix it before the submission - could you allocate some time for me or something?";
  return `https://wa.me/${SUPPORT_CONTACT.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

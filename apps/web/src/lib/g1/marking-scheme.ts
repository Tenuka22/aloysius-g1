/**
 * G1 2026 Marking Scheme - single source of truth for all scoring constants.
 *
 * Every numeric value used in scoring, hint text, and mark badges should
 * reference this file so the app stays in sync with the official scheme.
 */

import { INTAKE_YEAR_DEFAULT } from "@/lib/g1/intake-year";

// ── Global ───────────────────────────────────────────────────────────────────

export const CATEGORY_MAX_MARKS = 100;

// ── Electoral Register (shared) ──────────────────────────────────────────────

/** Number of electoral-register years scored (2.5 marks/2 marks per year,
 * see ELECTORAL_MARKS_PER_PERSON_YEAR_61/63). */
export const ELECTORAL_REGISTER_YEAR_COUNT = 5;

/**
 * The scored window is always the 5 register years ending two years before
 * the intake year - e.g. the 2027 intake circular scores 2021-2025, the
 * 2026 intake circular scored 2020-2024. Deriving it from the intake year
 * (instead of hardcoding a fixed start/end) means the window advances on
 * its own every admission cycle instead of silently going stale until
 * someone notices and hand-edits two constants.
 */
export function electoralRegisterYears(intakeYear: string | number = INTAKE_YEAR_DEFAULT): number[] {
  const year = typeof intakeYear === "string" ? Number.parseInt(intakeYear, 10) : intakeYear;
  const endYear = Number.isFinite(year) ? year - 2 : Number.parseInt(INTAKE_YEAR_DEFAULT, 10) - 2;
  return Array.from(
    { length: ELECTORAL_REGISTER_YEAR_COUNT },
    (_, i) => endYear - ELECTORAL_REGISTER_YEAR_COUNT + 1 + i,
  );
}

// ── 6.1 - Residence Verification & Proximity ─────────────────────────────────

/** Maximum marks for the main residence document section. */
export const MAIN_DOCUMENT_MAX_61 = 20;

/** Marks per additional supporting document (1 mark each, max 5). */
export const ADDITIONAL_DOC_MARKS_PER = 1;
export const ADDITIONAL_DOC_MAX_61 = 5;

/** Electoral register: 2.5 marks per person-year, max 25. */
export const ELECTORAL_MARKS_PER_PERSON_YEAR_61 = 2.5;
export const ELECTORAL_MAX_61 = 25;

/** Proximity: 5 marks per school within radius, max 50. */
export const PROXIMITY_PER_SCHOOL_61 = 5;
export const PROXIMITY_MAX_61 = 50;

/** Deed age thresholds and corresponding weights. */
export const DEED_AGE_WEIGHTS: Array<{ minYears: number; weight: number }> = [
  { minYears: 5, weight: 1 },
  { minYears: 4, weight: 0.8 },
  { minYears: 3, weight: 0.6 },
  { minYears: 2, weight: 0.4 },
  { minYears: 1, weight: 0.2 },
  { minYears: 0.5, weight: 0.1 },
];
/** Weight when deed is less than 6 months old. */
export const DEED_AGE_MIN_WEIGHT = 0.05;

// ── 6.2 - Alumni ─────────────────────────────────────────────────────────────

/** Years educated: 2 marks per year, max 13 years → 26 marks. */
export const YEARS_EDUCATED_MARKS_PER_YEAR = 2;
export const YEARS_EDUCATED_MAX_YEARS = 13;
export const YEARS_EDUCATED_MAX = 26;

/** Grade 5 Scholarship marks when passed. */
export const GRADE5_SCHOLARSHIP_MARKS = 3;

/** G.C.E. O/L maximum marks. */
export const OL_MAX_MARKS = 10;

/** G.C.E. A/L maximum marks. */
export const AL_MAX_MARKS = 12;

/** Educational achievements sub-total cap (scholarship + OL + AL). */
export const EDUCATIONAL_TOTAL_MAX = 25;

/** Sports / co-curricular maximum marks. */
export const SPORTS_MAX = 10;

/** Leadership role maximum marks. */
export const LEADERSHIP_MAX = 5;

/** Student societies maximum marks. */
export const STUDENT_SOCIETIES_MAX = 5;

/** Other activities maximum marks. */
export const OTHER_ACTIVITIES_MAX = 5;

/** Past Pupils' Association - life membership marks. */
export const PAST_PUPILS_LIFE_MEMBER_MARKS = 10;

/** Past Pupils' Association - marks per year of membership. */
export const PAST_PUPILS_YEARLY_MARKS = 0.5;

/** Past Pupils' Association - membership years cap. */
export const PAST_PUPILS_MEMBERSHIP_MAX = 10;

/** Past Pupils' Association - committee membership marks per year. */
export const PAST_PUPILS_COMMITTEE_MARKS_PER_YEAR = 0.25;

/** Past Pupils' Association - committee max years counted. */
export const PAST_PUPILS_COMMITTEE_MAX_YEARS = 4;

/** Past Pupils' Association - committee total cap. */
export const PAST_PUPILS_COMMITTEE_MAX = 3;

/** Past Pupils' Association - executive office marks. */
export const PAST_PUPILS_EXECUTIVE_MARKS = 1.5;

/** Past Pupils' Association - executive office count. */
export const PAST_PUPILS_EXECUTIVE_COUNT = 2;

/** Past Pupils' Association - executive office total cap. */
export const PAST_PUPILS_EXECUTIVE_MAX = 3;

/** Past Pupils' Association - total cap. */
export const PAST_PUPILS_TOTAL_MAX = 10;

/** University degree maximum marks. */
export const DEGREE_MAX = 5;

/** Diploma / Higher Diploma marks. */
export const DIPLOMA_MARKS = 2;

/** Sports Meet contribution marks. */
export const SPORTS_MEET_CONTRIBUTION = 0.5;

/** Shramadana (Community Service) contribution marks. */
export const SHRAMADANA_CONTRIBUTION = 0.5;

/** Contribution to school activities cap. */
export const CONTRIBUTION_MAX = 2;

/** Contribution to school projects marks. */
export const SCHOOL_PROJECTS_MARKS = 5;

// ── 6.3 - Siblings ───────────────────────────────────────────────────────────

/** Siblings currently studying: 2 marks per sibling, max 10 siblings → 20. */
export const SIBLING_MARKS_PER_SIBLING = 2;
export const SIBLING_MAX_SIBLINGS = 10;
export const SIBLING_STUDYING_MAX = 20;

/** Sibling studied at applied school marks. */
export const SIBLING_STUDIED_HERE_MARKS = 5;

/** Two or more siblings applying marks. */
export const SIBLING_MULTIPLE_APPLYING_MARKS = 5;

/** Sibling co-curricular - prefect marks cap. */
export const SIBLING_PREFECT_MAX = 2;

/** Sibling co-curricular - exam marks cap. */
export const SIBLING_EXAM_MAX = 2;

/** Sibling co-curricular - praiseworthy achievement marks. */
export const SIBLING_PRAISEWORTHY_MARKS = 2;

/** Sibling co-curricular - support rendered marks. */
export const SIBLING_SUPPORT_MARKS = 4;

/** Sibling co-curricular total cap. */
export const SIBLING_COCURRICULAR_TOTAL_MAX = 10;

/** 6.3 residence document maximum marks. */
export const MAIN_DOCUMENT_MAX_63 = 10;

/** 6.3 electoral register: 2 marks per person-year, max 20. */
export const ELECTORAL_MARKS_PER_PERSON_YEAR_63 = 2;
export const ELECTORAL_MAX_63 = 20;

/** 6.3 proximity: 3 marks per school, max 30. */
export const PROXIMITY_PER_SCHOOL_63 = 3;
export const PROXIMITY_MAX_63 = 30;

// ── 6.4 - Period of Service & Distance ───────────────────────────────────────

/** Period of service maximum marks. */
export const SERVICE_PERIOD_MAX = 20;

/** Difficult service - currently working marks. */
export const DIFFICULT_SERVICE_CURRENT_MARKS = 25;

/** Difficult service - previously worked base marks. */
export const DIFFICULT_SERVICE_PREVIOUS_BASE = 15;

/** Difficult service maximum marks. */
export const DIFFICULT_SERVICE_MAX = 25;

/** Difficult service distance tiers: [minKm, marks]. */
export const DIFFICULT_DISTANCE_TIERS: Array<[number, number]> = [
  [150, 15],
  [100, 10],
  [75, 5],
];

/** Difficult service extra period (6 months) marks. */
export const DIFFICULT_EXTRA_PERIOD_MARKS = 0.5;

/** Unutilized leave: 2 marks per year, max 5 years → 10. */
export const UNUTILIZED_LEAVE_MARKS_PER_YEAR = 2;
export const UNUTILIZED_LEAVE_MAX_YEARS = 5;
export const UNUTILIZED_LEAVE_MAX = 10;

/** Service location marks. */
export const SERVICE_LOCATION_MARKS: Record<string, number> = {
  "same-school": 10,
  zone: 7.5,
  province: 5,
  "education-institution": 2.5,
};

/** Service location maximum marks. */
export const SERVICE_LOCATION_MAX = 10;

/** 6.4 residence distance tiers: [maxKm, marks]. */
export const RESIDENCE_DISTANCE_TIERS_64: Array<[number, number]> = [
  [1, 10],
  [3, 8],
  [5, 6],
];

/** 6.4 residence distance fallback (more than 5 km). */
export const RESIDENCE_DISTANCE_FALLBACK_64 = 4;

/** 6.4 residence distance maximum marks. */
export const RESIDENCE_DISTANCE_MAX_64 = 10;

/** Workplace distance tiers: [minKm, marks]. */
export const WORKPLACE_DISTANCE_TIERS: Array<[number, number]> = [
  [100, 25],
  [70, 20],
  [40, 15],
  [20, 10],
];

/** Workplace distance fallback (less than 20 km). */
export const WORKPLACE_DISTANCE_FALLBACK = 5;

/** Workplace distance maximum marks. */
export const WORKPLACE_DISTANCE_MAX = 25;

// ── 6.5 - Transfer Applications ──────────────────────────────────────────────

/** Transfer distance tiers: [minKm, marks]. */
export const TRANSFER_DISTANCE_TIERS: Array<[number, number]> = [
  [150, 35],
  [100, 28],
  [50, 21],
];

/** Minimum transfer distance to qualify (km). */
export const TRANSFER_DISTANCE_MIN_KM = 50;

/** Transfer - period of service maximum marks. */
export const TRANSFER_SERVICE_PERIOD_MAX = 10;

/** Transfer - previous workplace period tiers: [minYears, marks]. */
export const TRANSFER_PREVIOUS_PERIOD_TIERS: Array<[number, number]> = [
  [3, 10],
  [2, 8],
  [1, 5],
];

/** Transfer - time since transfer tiers: [maxYears, marks]. */
export const TRANSFER_ELAPSED_TIERS: Array<[number, number]> = [
  [1, 5],
  [2, 4],
  [3, 3],
  [4, 2],
  [5, 1],
];

/** 6.5 proximity: 3 marks per school, max 30. */
export const PROXIMITY_PER_SCHOOL_65 = 3;
export const PROXIMITY_MAX_65 = 30;

/** Transfer - previous-to-new workplace distance maximum marks. */
export const TRANSFER_DISTANCE_MAX = 35;

/** Transfer - previous workplace period maximum marks. */
export const TRANSFER_PREVIOUS_PERIOD_MAX = 10;

/** Transfer - time since transfer maximum marks. */
export const TRANSFER_ELAPSED_MAX = 5;

// ── 6.6 - Foreign Employment ─────────────────────────────────────────────────

/** Abroad period tiers: [minYears, marks]. */
export const ABROAD_PERIOD_TIERS: Array<[number, number]> = [
  [3, 25],
  [2, 15],
  [1, 10],
];

/** Abroad period maximum marks. */
export const ABROAD_PERIOD_MAX = 25;

/** Employment purpose marks. */
export const EMPLOYMENT_PURPOSE_MARKS: Record<string, number> = {
  board: 40,
  personal: 30,
  government: 25,
  education: 20,
};

/** Employment purpose maximum marks. */
export const EMPLOYMENT_PURPOSE_MAX = 40;

/** 6.6 proximity: 3.5 marks per school, max 35. */
export const PROXIMITY_PER_SCHOOL_66 = 3.5;
export const PROXIMITY_MAX_66 = 35;

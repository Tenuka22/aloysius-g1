import type { CategoryApplication, CategoryType, ScoringInputs } from "@/lib/g1/application-store";
import {
  CATEGORY_MAX_MARKS,
  electoralRegisterYears,
  MAIN_DOCUMENT_MAX_61,
  ADDITIONAL_DOC_MARKS_PER,
  ADDITIONAL_DOC_MAX_61,
  ELECTORAL_MARKS_PER_PERSON_YEAR_61,
  ELECTORAL_MAX_61,
  PROXIMITY_PER_SCHOOL_61,
  PROXIMITY_MAX_61,
  DEED_AGE_WEIGHTS,
  DEED_AGE_MIN_WEIGHT,
  YEARS_EDUCATED_MARKS_PER_YEAR,
  YEARS_EDUCATED_MAX,
  GRADE5_SCHOLARSHIP_MARKS,
  OL_MAX_MARKS,
  AL_MAX_MARKS,
  EDUCATIONAL_TOTAL_MAX,
  SPORTS_MAX,
  LEADERSHIP_MAX,
  STUDENT_SOCIETIES_MAX,
  OTHER_ACTIVITIES_MAX,
  PAST_PUPILS_LIFE_MEMBER_MARKS_PER_YEAR,
  PAST_PUPILS_LIFE_MEMBER_MAX,
  PAST_PUPILS_YEARLY_MARKS,
  PAST_PUPILS_MEMBERSHIP_MAX,
  PAST_PUPILS_COMMITTEE_MARKS_PER_YEAR,
  PAST_PUPILS_EXECUTIVE_MARKS,
  PAST_PUPILS_EXECUTIVE_COUNT,
  PAST_PUPILS_COMMITTEE_EXECUTIVE_MAX,
  PAST_PUPILS_TOTAL_MAX,
  DEGREE_MAX,
  DIPLOMA_MARKS,
  SPORTS_MEET_CONTRIBUTION,
  SHRAMADANA_CONTRIBUTION,
  CONTRIBUTION_MAX,
  SCHOOL_PROJECTS_MARKS,
  SIBLING_MARKS_PER_GRADE,
  SIBLING_GRADES_MAX,
  SIBLING_STUDIED_HERE_MARKS,
  SIBLING_MULTIPLE_STUDYING_MARKS,
  SIBLING_SPORTS_MAX,
  SIBLING_EXAM_MAX,
  SIBLING_LEADERSHIP_MARKS,
  SIBLING_SUPPORT_MARKS,
  SIBLING_COCURRICULAR_TOTAL_MAX,
  MAIN_DOCUMENT_MAX_63,
  ELECTORAL_MARKS_PER_PERSON_YEAR_63,
  ELECTORAL_MAX_63,
  PROXIMITY_PER_SCHOOL_63,
  PROXIMITY_MAX_63,
  SERVICE_PERIOD_MAX,
  DIFFICULT_SERVICE_CURRENT_RATE,
  DIFFICULT_SERVICE_PREVIOUS_RATE,
  DIFFICULT_SERVICE_YEARS_CAP,
  DIFFICULT_SERVICE_BONUS_MIN_MONTHS,
  DIFFICULT_SERVICE_MAX,
  DIFFICULT_DISTANCE_RATE_TIERS,
  UNUTILIZED_LEAVE_MARKS_PER_YEAR,
  UNUTILIZED_LEAVE_MAX,
  CONTRIBUTION_PATH1_SAME_SCHOOL_RATE,
  CONTRIBUTION_PATH1_ELSEWHERE_RATE,
  CONTRIBUTION_PATH1_YEARS_CAP,
  CONTRIBUTION_PATH1_SAME_SCHOOL_MAX,
  CONTRIBUTION_PATH1_ELSEWHERE_MAX,
  CONTRIBUTION_PATH2_RATE_PER_ITEM,
  CONTRIBUTION_PATH2_ITEM_MAX,
  SCHOOL_EDUCATION_CONTRIBUTION_MAX,
  RESIDENCE_DISTANCE_TIERS_64,
  RESIDENCE_DISTANCE_FALLBACK_64,
  RESIDENCE_DISTANCE_MAX_64,
  WORKPLACE_DISTANCE_TIERS,
  WORKPLACE_DISTANCE_FALLBACK,
  WORKPLACE_DISTANCE_MAX,
  TRANSFER_DISTANCE_TIERS,
  TRANSFER_DISTANCE_MAX,
  TRANSFER_SERVICE_PERIOD_MAX,
  TRANSFER_PREVIOUS_PERIOD_TIERS,
  TRANSFER_PREVIOUS_PERIOD_MAX,
  TRANSFER_ELAPSED_TIERS,
  TRANSFER_ELAPSED_MAX,
  PROXIMITY_PER_SCHOOL_65,
  PROXIMITY_MAX_65,
  ABROAD_PERIOD_TIERS,
  ABROAD_PERIOD_MAX,
  EMPLOYMENT_PURPOSE_MARKS,
  EMPLOYMENT_PURPOSE_MAX,
  PROXIMITY_PER_SCHOOL_66,
  PROXIMITY_MAX_66,
} from "@/lib/g1/marking-scheme";

export { CATEGORY_MAX_MARKS } from "@/lib/g1/marking-scheme";

export type ScoreRow = { label: string; marks: number; max: number };
export type CategoryScore = { categoryType: string; total: number; breakdown: ScoreRow[] };

const round2 = (value: number) => Math.round(value * 100) / 100;
const cap = (value: number, max: number) => round2(Math.max(0, Math.min(value, max)));

export function yearsFromDate(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  // Rounded to avoid sub-day floating-point drift (leap-year alignment,
  // exact instant of "now") tipping a value that should land exactly on a
  // year boundary (e.g. tier lookups keyed on whole years) to the wrong side.
  return round2(Math.max(0, (now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
}

/** Whole completed years elapsed since `dateStr` - deliberately computed
 * from calendar anniversary arithmetic (year difference, minus one if this
 * year's month/day anniversary hasn't occurred yet), not a fixed
 * 365.25-day divisor. A fixed divisor gets both edge cases wrong: an exact
 * non-leap 1-year span is 365 days - slightly *under* 365.25, so dividing
 * and flooring wrongly yields 0; a date one day short of a boundary can
 * average up to the boundary via intermediate rounding and wrongly yield
 * one year too many. Used for "1 mark per completed year" scoring (period
 * of service in 6.4 and 6.5), where the circular never awards a fractional
 * part-year of credit. */
export function wholeYearsFromDate(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  if (start.getTime() > now.getTime()) return 0;
  let years = now.getUTCFullYear() - start.getUTCFullYear();
  const startMonthDay = start.getUTCMonth() * 100 + start.getUTCDate();
  const nowMonthDay = now.getUTCMonth() * 100 + now.getUTCDate();
  if (nowMonthDay < startMonthDay) years -= 1;
  return Math.max(0, years);
}

export function yearsBetween(d1: string | undefined, d2: string | undefined): number {
  if (!d1 || !d2) return 0;
  const a = new Date(d1);
  const b = new Date(d2);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.abs(b.getTime() - a.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

/** Whole years and the remaining months of the period from `startDate` to
 * `endDate` (defaults to now) - calendar-based month arithmetic (not a
 * fixed-day divisor), consistent with `wholeYearsFromDate` above. Used for
 * difficult-service scoring (circular 7.5.3), which pays a per-year rate
 * plus a one-off bonus once a completed year has a 6-month-or-more
 * remainder. */
export function yearsAndMonthsBetween(
  startDate: string | undefined,
  endDate?: string,
): { years: number; remainderMonths: number } {
  if (!startDate) return { years: 0, remainderMonths: 0 };
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() > end.getTime()) {
    return { years: 0, remainderMonths: 0 };
  }
  let totalMonths =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) totalMonths -= 1;
  totalMonths = Math.max(0, totalMonths);
  return { years: Math.floor(totalMonths / 12), remainderMonths: totalMonths % 12 };
}

/** Counts checked years that actually fall within the current scored window
 * (see `electoralRegisterYears`); a year checked outside that window (e.g.
 * a stale value from a previous intake cycle's window) never scores. */
export function electoralYearsRegistered(checkedYears: number[] | undefined): number {
  if (!checkedYears || checkedYears.length === 0) return 0;
  const validYears = electoralRegisterYears();
  return checkedYears.filter((year) => validYears.includes(year)).length;
}

export function deedAgeWeight(years: number | undefined): number {
  if (years == null) return 1;
  for (const { minYears, weight } of DEED_AGE_WEIGHTS) {
    if (years >= minYears) return weight;
  }
  return DEED_AGE_MIN_WEIGHT;
}

export const MAIN_DOCUMENT_MARKS_61: Record<string, number> = {
  "title-deed-applicant": 20,
  "title-deed-parents": 16,
  "feeder-electoral-5yrs": 15,
  "lease-deed": 10,
  "municipal-ds-certificate": 5,
  "other-documents": 4,
};

export const MAIN_DOCUMENT_MARKS_63: Record<string, number> = {
  "title-deed-applicant-spouse": 10,
  "title-deed-parents": 6,
  "feeder-electoral-5yrs": 6,
  "lease-deed": 4,
  "municipal-ds-rentact-cert": 4,
  "other-documents": 2,
};

export const OL_CEILINGS: Record<number, Record<string, number>> = {
  6: { S: 4, C: 8, B: 10, A: 0 },
  8: { S: 4, C: 8, B: 10, A: 0 },
  9: { S: 4, C: 6, B: 8, A: 10 },
  10: { S: 4, C: 8, B: 0, A: 10 },
};

export const AL_CEILINGS: Record<number, Record<string, number>> = {
  3: { S: 6, C: 8, B: 10, A: 12 },
  4: { S: 6, C: 8, B: 10, A: 12 },
};

export function gradeRate(table: Record<string, number>, subjectCount: number, grade: string): number {
  return (table[grade] ?? 0) / subjectCount;
}

export const SPORTS_LEVEL_MARKS: Record<string, number> = {
  "inter-house": 0.5,
  zonal: 1,
  district: 2,
  provincial: 3,
  national: 4.75,
  international: 5,
};

export const LEADERSHIP_ROLE_MARKS: Record<string, number> = {
  "prefect-primary": 1,
  "prefect-junior": 1.5,
  "prefect-senior": 3,
  "deputy-head-prefect": 4,
  "head-prefect": 5,
  "first-team-vice-captain": 1.5,
  "first-team-captain": 2,
};

export const SIBLING_SPORTS_LEVEL_MARKS: Record<string, number> = {
  "inter-house": 0.25,
  zonal: 0.5,
  district: 1,
  provincial: 1.5,
  national: 1.75,
  international: 2,
};

export const SIBLING_EXAM_MARKS: Record<string, number> = {
  scholarship: 0.5,
  ol: 1,
  al: 1.5,
};

function electoralRegisterMarks61(inputs: ScoringInputs): number {
  const mother = electoralYearsRegistered(inputs.electoralMotherYears);
  const father = electoralYearsRegistered(inputs.electoralFatherYears);
  return cap((mother + father) * ELECTORAL_MARKS_PER_PERSON_YEAR_61, ELECTORAL_MAX_61);
}

// Proximity is a scarcity/priority criterion: an applicant with FEWER competing
// schools within radius has fewer alternatives and starts at the maximum;
// each additional nearby school deducts `perSchool` marks, floored at 0.
export function proximityMarks(inputs: ScoringInputs, perSchool: number, max: number): number {
  const count = inputs.schoolsWithinRadius?.length ?? 0;
  return cap(max - count * perSchool, max);
}

export function documentMarks61(inputs: ScoringInputs): number {
  const documentMax = MAIN_DOCUMENT_MARKS_61[inputs.mainDocumentType ?? ""];
  const deedYears = yearsFromDate(inputs.deedTransferDate);
  return documentMax != null ? cap(documentMax * deedAgeWeight(deedYears), MAIN_DOCUMENT_MAX_61) : 0;
}

export function additionalDocsMarks61(inputs: ScoringInputs): number {
  return cap((inputs.additionalDocs?.length ?? 0) * ADDITIONAL_DOC_MARKS_PER, ADDITIONAL_DOC_MAX_61);
}

export function electoralMarks61(inputs: ScoringInputs): number {
  return electoralRegisterMarks61(inputs);
}

export function proximityMarks61(inputs: ScoringInputs): number {
  return proximityMarks(inputs, PROXIMITY_PER_SCHOOL_61, PROXIMITY_MAX_61);
}

export function scoreCategory61(inputs: ScoringInputs): CategoryScore {
  const documentMax = MAIN_DOCUMENT_MARKS_61[inputs.mainDocumentType ?? ""];
  const deedYears = yearsFromDate(inputs.deedTransferDate);
  const documentMarks =
    documentMax != null ? cap(documentMax * deedAgeWeight(deedYears), MAIN_DOCUMENT_MAX_61) : 0;
  const additionalMarks = cap((inputs.additionalDocs?.length ?? 0) * ADDITIONAL_DOC_MARKS_PER, ADDITIONAL_DOC_MAX_61);
  const electoralMarks = electoralRegisterMarks61(inputs);
  const proximity = proximityMarks(inputs, PROXIMITY_PER_SCHOOL_61, PROXIMITY_MAX_61);
  const rows: ScoreRow[] = [
    { label: "Main residence document", marks: documentMarks, max: MAIN_DOCUMENT_MAX_61 },
    { label: "Additional documents", marks: additionalMarks, max: ADDITIONAL_DOC_MAX_61 },
    { label: "Electoral register", marks: electoralMarks, max: ELECTORAL_MAX_61 },
    { label: "Nearby schools", marks: proximity, max: PROXIMITY_MAX_61 },
  ];
  const total = cap(rows.reduce((sum, row) => sum + row.marks, 0), CATEGORY_MAX_MARKS);
  return { categoryType: "6.1", total, breakdown: rows };
}

export const STUDENT_SOCIETIES_ROLE_MARKS: Record<string, number> = {
  "committee-member": 0.5,
  "vice-president": 0.75,
  president: 1,
};

export const OTHER_ACTIVITY_MARKS: Record<string, number> = {
  "junior-band-leader": 2,
  "junior-band-member": 1,
  "senior-band-leader": 2,
  "senior-band-member": 1,
  "scout-leader": 2,
  "scout-member": 1,
  "cub-scout": 1,
  "cadet-team-leader": 2,
  "cadet-team-member": 1,
  "debating-team-leader": 2,
  "debating-team-member": 1,
  "st-john-ambulance-leader": 2,
  "st-john-ambulance-member": 1,
  other: 1,
};

export const DEGREE_MARKS: Record<string, number> = {
  "first-degree": 3,
  postgraduate: 4,
  doctorate: 5,
  "chartered-professional": 3,
};

export function scoreCategory62(inputs: ScoringInputs): CategoryScore {
  const yearsMarks = cap(yearsBetween(inputs.alumniStartDate, inputs.alumniEndDate) * YEARS_EDUCATED_MARKS_PER_YEAR, YEARS_EDUCATED_MAX);
  const scholarshipMarks = inputs.grade5ScholarshipPassed ? GRADE5_SCHOLARSHIP_MARKS : 0;

  let olMarks = 0;
  const olCount = inputs.olSubjectCount;
  const olTable = olCount != null ? OL_CEILINGS[olCount] : undefined;
  if (olTable && olCount != null) {
    for (const grade of ["S", "C", "B", "A"]) {
      olMarks += (inputs[`olGrade${grade}` as "olGradeS"] ?? 0) * gradeRate(olTable, olCount, grade);
    }
  }
  olMarks = cap(olMarks, OL_MAX_MARKS);

  let alMarks = 0;
  const alCount = inputs.alSubjectCount;
  const alTable = alCount != null ? AL_CEILINGS[alCount] : undefined;
  if (alTable && alCount != null) {
    for (const grade of ["S", "C", "B", "A"]) {
      alMarks += (inputs[`alGrade${grade}` as "alGradeS"] ?? 0) * gradeRate(alTable, alCount, grade);
    }
  }
  alMarks = cap(alMarks, AL_MAX_MARKS);

  const educationalMarks = cap(scholarshipMarks + olMarks + alMarks, EDUCATIONAL_TOTAL_MAX);

  const sportsMarks = cap(
    (inputs.sportsEntries ?? []).reduce(
      (sum, entry) => sum + (entry.levels ?? []).reduce((s, level) => s + (SPORTS_LEVEL_MARKS[level] ?? 0), 0),
      0,
    ),
    SPORTS_MAX,
  );
  const leadershipMarks = cap(
    (inputs.leadershipRoles ?? []).reduce((sum, role) => sum + (LEADERSHIP_ROLE_MARKS[role] ?? 0), 0),
    LEADERSHIP_MAX,
  );
  const studentSocietiesMarks = cap(
    (inputs.studentSocietiesEntries ?? []).reduce(
      (sum, entry) => sum + (entry.roles ?? []).reduce((s, role) => s + (STUDENT_SOCIETIES_ROLE_MARKS[role] ?? 0), 0),
      0,
    ),
    STUDENT_SOCIETIES_MAX,
  );
  const otherActivityMarks = cap(
    (inputs.otherActivities ?? []).reduce((sum, activity) => sum + (OTHER_ACTIVITY_MARKS[activity] ?? 0), 0),
    OTHER_ACTIVITIES_MAX,
  );

  let pastPupilsMarks = 0;
  if (inputs.pastPupilsLifeMember) {
    const years = yearsFromDate(inputs.pastPupilsLifeMemberStart);
    pastPupilsMarks += cap(years * PAST_PUPILS_LIFE_MEMBER_MARKS_PER_YEAR, PAST_PUPILS_LIFE_MEMBER_MAX);
  } else if (inputs.pastPupilsMembershipStart && inputs.pastPupilsMembershipEnd) {
    const years = yearsBetween(inputs.pastPupilsMembershipStart, inputs.pastPupilsMembershipEnd);
    pastPupilsMarks += cap(years * PAST_PUPILS_YEARLY_MARKS, PAST_PUPILS_MEMBERSHIP_MAX);
  }
  const committeeExecutiveMarks =
    (inputs.pastPupilsCommitteeYears ?? 0) * PAST_PUPILS_COMMITTEE_MARKS_PER_YEAR +
    Math.min(inputs.pastPupilsExecutiveCount ?? 0, PAST_PUPILS_EXECUTIVE_COUNT) * PAST_PUPILS_EXECUTIVE_MARKS;
  pastPupilsMarks += cap(committeeExecutiveMarks, PAST_PUPILS_COMMITTEE_EXECUTIVE_MAX);
  pastPupilsMarks = cap(pastPupilsMarks, PAST_PUPILS_TOTAL_MAX);

  const degreeMarks = cap(DEGREE_MARKS[inputs.highestDegree ?? ""] ?? 0, DEGREE_MAX);
  const diplomaMarks = inputs.hasDiploma ? DIPLOMA_MARKS : 0;

  let contributionMarks = 0;
  contributionMarks += (inputs.sportsMeetContribution ?? 0) * SPORTS_MEET_CONTRIBUTION;
  contributionMarks += (inputs.shramadanaContribution ?? 0) * SHRAMADANA_CONTRIBUTION;
  contributionMarks = cap(contributionMarks, CONTRIBUTION_MAX);

  const projectMarks = inputs.schoolProjectsContribution ? SCHOOL_PROJECTS_MARKS : 0;

  const rows: ScoreRow[] = [
    { label: "Years educated at school", marks: yearsMarks, max: YEARS_EDUCATED_MAX },
    { label: "Grade 5 Scholarship", marks: scholarshipMarks, max: GRADE5_SCHOLARSHIP_MARKS },
    { label: "G.C.E. (O/L)", marks: olMarks, max: OL_MAX_MARKS },
    { label: "G.C.E. (A/L)", marks: alMarks, max: AL_MAX_MARKS },
    { label: "Sports / co-curricular", marks: sportsMarks, max: SPORTS_MAX },
    { label: "Leadership role", marks: leadershipMarks, max: LEADERSHIP_MAX },
    { label: "Student societies", marks: studentSocietiesMarks, max: STUDENT_SOCIETIES_MAX },
    { label: "Other activities", marks: otherActivityMarks, max: OTHER_ACTIVITIES_MAX },
    { label: "Past Pupils' Association", marks: pastPupilsMarks, max: PAST_PUPILS_TOTAL_MAX },
    { label: "University degrees", marks: degreeMarks, max: DEGREE_MAX },
    { label: "Diploma / Higher Diploma", marks: diplomaMarks, max: DIPLOMA_MARKS },
    { label: "Contribution to school activities", marks: contributionMarks, max: CONTRIBUTION_MAX },
    { label: "Contribution to school projects", marks: projectMarks, max: SCHOOL_PROJECTS_MARKS },
  ];
  const total = cap(rows.reduce((sum, row) => sum + row.marks, 0), CATEGORY_MAX_MARKS);
  return { categoryType: "6.2", total, breakdown: rows };
}

export function scoreCategory63(inputs: ScoringInputs): CategoryScore {
  const gradesCompletedMarks = cap((inputs.siblingGradesCompletedCount ?? 0) * SIBLING_MARKS_PER_GRADE, SIBLING_GRADES_MAX);
  const studiedHereMarks = inputs.siblingStudiedAtAppliedSchool ? SIBLING_STUDIED_HERE_MARKS : 0;
  const studyingOtherGradesMarks = inputs.twoOrMoreSiblingsStudyingOtherGrades ? SIBLING_MULTIPLE_STUDYING_MARKS : 0;
  const sportsMarks = cap(
    (inputs.siblingSportsEntries ?? []).reduce(
      (sum, entry) => sum + (entry.levels ?? []).reduce((s, level) => s + (SIBLING_SPORTS_LEVEL_MARKS[level] ?? 0), 0),
      0,
    ),
    SIBLING_SPORTS_MAX,
  );
  const examMarks = cap(
    (inputs.siblingExamAchievements ?? []).reduce((sum, achievement) => sum + (SIBLING_EXAM_MARKS[achievement] ?? 0), 0),
    SIBLING_EXAM_MAX,
  );
  const leadershipMarks = inputs.siblingLeadershipAchievement ? SIBLING_LEADERSHIP_MARKS : 0;
  const supportMarks = inputs.parentsSupportRendered ? SIBLING_SUPPORT_MARKS : 0;
  const cocurricularTotal = cap(
    sportsMarks + examMarks + leadershipMarks + supportMarks,
    SIBLING_COCURRICULAR_TOTAL_MAX,
  );
  const documentMarks = cap(MAIN_DOCUMENT_MARKS_63[inputs.mainDocumentType ?? ""] ?? 0, MAIN_DOCUMENT_MAX_63);
  const mother = electoralYearsRegistered(inputs.electoralMotherYears);
  const father = electoralYearsRegistered(inputs.electoralFatherYears);
  const electoralMarks = cap((mother + father) * ELECTORAL_MARKS_PER_PERSON_YEAR_63, ELECTORAL_MAX_63);
  const proximity = proximityMarks(inputs, PROXIMITY_PER_SCHOOL_63, PROXIMITY_MAX_63);

  const rows: ScoreRow[] = [
    { label: "Grades completed by sibling", marks: gradesCompletedMarks, max: SIBLING_GRADES_MAX },
    { label: "Sibling studied at applied school", marks: studiedHereMarks, max: SIBLING_STUDIED_HERE_MARKS },
    { label: "Two or more siblings studying other grades", marks: studyingOtherGradesMarks, max: SIBLING_MULTIPLE_STUDYING_MARKS },
    { label: "Sibling co-curricular & prefect", marks: cocurricularTotal, max: SIBLING_COCURRICULAR_TOTAL_MAX },
    { label: "Residence document", marks: documentMarks, max: MAIN_DOCUMENT_MAX_63 },
    { label: "Electoral register", marks: electoralMarks, max: ELECTORAL_MAX_63 },
    { label: "Nearby schools", marks: proximity, max: PROXIMITY_MAX_63 },
  ];
  const total = cap(rows.reduce((sum, row) => sum + row.marks, 0), CATEGORY_MAX_MARKS);
  return { categoryType: "6.3", total, breakdown: rows };
}

export function tieredDistanceMarks(km: number | undefined, tiers: Array<[number, number]>, fallback: number): number {
  if (km == null) return 0;
  for (const [limit, marks] of tiers) {
    if (km <= limit) return marks;
  }
  return fallback;
}

/** 7.5.3.1/7.5.3.2 shared shape: `rate` marks per full year up to
 * `DIFFICULT_SERVICE_YEARS_CAP` years, plus a one-off half-rate bonus once
 * a completed year carries a 6-month-or-more remainder (7.5.3.3) - never
 * awarded for less than one full year of service. */
function rateTimesYearsWithBonus(
  years: number,
  remainderMonths: number,
  rate: number,
  branchMax: number,
): number {
  let marks = Math.min(years, DIFFICULT_SERVICE_YEARS_CAP) * rate;
  if (years >= 1 && remainderMonths >= DIFFICULT_SERVICE_BONUS_MIN_MONTHS) marks += rate / 2;
  return cap(marks, branchMax);
}

/** 7.5.3.1: currently serving in a difficult station - 5 marks per full
 * year of continuous current-station difficult service, capped at 25. */
export function difficultServiceCurrentMarks(startDate: string | undefined): number {
  const { years, remainderMonths } = yearsAndMonthsBetween(startDate);
  return rateTimesYearsWithBonus(years, remainderMonths, DIFFICULT_SERVICE_CURRENT_RATE, DIFFICULT_SERVICE_MAX);
}

/** 7.5.3.2.i: previously served in a difficult station - 3 marks per full
 * year of that past period, capped at 15. */
export function difficultServicePreviousMarks(startDate: string | undefined, endDate: string | undefined): number {
  const { years, remainderMonths } = yearsAndMonthsBetween(startDate, endDate);
  return rateTimesYearsWithBonus(years, remainderMonths, DIFFICULT_SERVICE_PREVIOUS_RATE, 15);
}

/** 7.5.3.2.ii: alternative to the previous-service rate above - when the
 * permanent residence is 75km+ from the officer's original (first
 * appointment) station, marks accrue per full year served at that station
 * at a rate set by the qualifying distance tier. The higher of this and
 * `difficultServicePreviousMarks` applies (see `scoreCategory64`). */
export function difficultServiceDistanceMarks(
  startDate: string | undefined,
  endDate: string | undefined,
  km: number | undefined,
): number {
  if (km == null) return 0;
  const tier = DIFFICULT_DISTANCE_RATE_TIERS.find(([minKm]) => km >= minKm);
  if (!tier) return 0;
  const [, ratePerYear, tierCap] = tier;
  const { years, remainderMonths } = yearsAndMonthsBetween(startDate, endDate);
  return rateTimesYearsWithBonus(years, remainderMonths, ratePerYear, tierCap);
}

/** 7.5.1 - an eligibility gate for the rest of category 6.4 (see
 * `scoreCategory64`), not just a standalone line item. Path I pays a
 * per-year rate for CURRENT-station service (higher rate if that station
 * is the very school being applied to), with a half-rate award for under
 * a year of current-station service. Path II sums three UGC-university
 * sub-items, each its own per-year rate capped independently. */
export function contributionMarks64(inputs: ScoringInputs): number {
  if (inputs.contributionPath === "institution") {
    const sameSchool = inputs.contributionSameSchool === true;
    const rate = sameSchool ? CONTRIBUTION_PATH1_SAME_SCHOOL_RATE : CONTRIBUTION_PATH1_ELSEWHERE_RATE;
    const branchMax = sameSchool ? CONTRIBUTION_PATH1_SAME_SCHOOL_MAX : CONTRIBUTION_PATH1_ELSEWHERE_MAX;
    const totalYears = yearsFromDate(inputs.contributionServiceStartDate);
    if (totalYears <= 0) return 0;
    const wholeYears = wholeYearsFromDate(inputs.contributionServiceStartDate);
    if (wholeYears < 1) return cap(rate / 2, branchMax);
    return cap(Math.min(wholeYears, CONTRIBUTION_PATH1_YEARS_CAP) * rate, branchMax);
  }
  if (inputs.contributionPath === "university") {
    const examMarks = cap((inputs.contributionExamYears ?? 0) * CONTRIBUTION_PATH2_RATE_PER_ITEM, CONTRIBUTION_PATH2_ITEM_MAX);
    const curriculumMarks = cap((inputs.contributionCurriculumYears ?? 0) * CONTRIBUTION_PATH2_RATE_PER_ITEM, CONTRIBUTION_PATH2_ITEM_MAX);
    const trainingMarks = cap((inputs.contributionTrainingYears ?? 0) * CONTRIBUTION_PATH2_RATE_PER_ITEM, CONTRIBUTION_PATH2_ITEM_MAX);
    return cap(examMarks + curriculumMarks + trainingMarks, SCHOOL_EDUCATION_CONTRIBUTION_MAX);
  }
  return 0;
}

export function workplaceDistanceMarks(km: number | undefined): number {
  if (km == null) return 0;
  for (const [minKm, marks] of WORKPLACE_DISTANCE_TIERS) {
    if (km >= minKm) return marks;
  }
  return WORKPLACE_DISTANCE_FALLBACK;
}

export function transferDistanceMarks(km: number | undefined): number {
  if (km == null) return 0;
  for (const [minKm, marks] of TRANSFER_DISTANCE_TIERS) {
    if (km >= minKm) return marks;
  }
  return 0;
}

export function previousPeriodMarks(years: number): number {
  for (const [minYears, marks] of TRANSFER_PREVIOUS_PERIOD_TIERS) {
    if (years >= minYears) return marks;
  }
  return 0;
}

export function transferElapsedMarks(elapsed: number): number {
  for (const [maxYears, marks] of TRANSFER_ELAPSED_TIERS) {
    if (elapsed <= maxYears) return marks;
  }
  return 0;
}

export function scoreCategory64(inputs: ScoringInputs): CategoryScore {
  // 7.5.1 is an eligibility gate, not just another line item: the circular
  // states marks for every section that follows are given "only to
  // applicants who have earned marks" here - scoring zero on contribution
  // must zero the rest of the category, not merely this row.
  const contributionMarks = contributionMarks64(inputs);
  const gateOpen = contributionMarks > 0;

  // Whole completed years, matching every other "(rate x count)" formula in
  // the circular - a continuous fractional year (e.g. 1.03) never appears
  // in the official scheme.
  const serviceMarks = gateOpen ? cap(wholeYearsFromDate(inputs.serviceStartDate), SERVICE_PERIOD_MAX) : 0;

  let difficultMarks = 0;
  if (gateOpen && inputs.difficultServiceType === "current") {
    difficultMarks = difficultServiceCurrentMarks(inputs.difficultServiceStartDate);
  } else if (gateOpen && inputs.difficultServiceType === "previous") {
    const previousBranch = difficultServicePreviousMarks(
      inputs.difficultServicePreviousStartDate,
      inputs.difficultServicePreviousEndDate,
    );
    const distanceBranch = difficultServiceDistanceMarks(
      inputs.difficultServiceDistanceStartDate,
      inputs.difficultServiceDistanceEndDate,
      inputs.difficultServiceDistanceKm,
    );
    difficultMarks = Math.max(previousBranch, distanceBranch);
  }
  difficultMarks = cap(difficultMarks, DIFFICULT_SERVICE_MAX);

  // 7.5.4 restricts unutilized-leave marks to officers qualifying under
  // 7.5.1 Path I (institution service) - UGC university staff (Path II)
  // never earn this row even when the overall gate is open.
  const leaveMarks =
    gateOpen && inputs.contributionPath !== "university"
      ? cap((inputs.unutilizedLeaveYears ?? 0) * UNUTILIZED_LEAVE_MARKS_PER_YEAR, UNUTILIZED_LEAVE_MAX)
      : 0;
  const residenceDistance = gateOpen
    ? tieredDistanceMarks(inputs.residenceToSchoolKm, RESIDENCE_DISTANCE_TIERS_64, RESIDENCE_DISTANCE_FALLBACK_64)
    : 0;
  const workplaceDistance = gateOpen ? workplaceDistanceMarks(inputs.workplaceToSchoolKm) : 0;

  const rows: ScoreRow[] = [
    { label: "Contribution to school education", marks: contributionMarks, max: SCHOOL_EDUCATION_CONTRIBUTION_MAX },
    { label: "Period of service", marks: serviceMarks, max: SERVICE_PERIOD_MAX },
    { label: "Difficult service", marks: difficultMarks, max: DIFFICULT_SERVICE_MAX },
    { label: "Unutilized leave", marks: leaveMarks, max: UNUTILIZED_LEAVE_MAX },
    { label: "Residence to school", marks: residenceDistance, max: RESIDENCE_DISTANCE_MAX_64 },
    { label: "Workplace to school", marks: workplaceDistance, max: WORKPLACE_DISTANCE_MAX },
  ];
  const total = cap(rows.reduce((sum, row) => sum + row.marks, 0), CATEGORY_MAX_MARKS);
  return { categoryType: "6.4", total, breakdown: rows };
}

export function scoreCategory65(inputs: ScoringInputs): CategoryScore {
  const distanceMarks = transferDistanceMarks(inputs.previousWorkplaceDistanceKm);

  const periodMarks = cap(wholeYearsFromDate(inputs.serviceStartDate), TRANSFER_SERVICE_PERIOD_MAX);

  const prevYears = yearsFromDate(inputs.previousWorkplaceStartDate);
  const prevPeriodMarks = previousPeriodMarks(prevYears);

  let elapsedMarks = 0;
  if (inputs.transferDate) {
    elapsedMarks = transferElapsedMarks(yearsFromDate(inputs.transferDate));
  }

  const leaveMarks = cap((inputs.unutilizedLeaveYears ?? 0) * UNUTILIZED_LEAVE_MARKS_PER_YEAR, UNUTILIZED_LEAVE_MAX);
  const proximity = proximityMarks(inputs, PROXIMITY_PER_SCHOOL_65, PROXIMITY_MAX_65);

  const rows: ScoreRow[] = [
    { label: "Previous-to-new workplace distance", marks: distanceMarks, max: TRANSFER_DISTANCE_MAX },
    { label: "Nearby schools", marks: proximity, max: PROXIMITY_MAX_65 },
    { label: "Period of service", marks: periodMarks, max: TRANSFER_SERVICE_PERIOD_MAX },
    { label: "Period at previous workplace", marks: prevPeriodMarks, max: TRANSFER_PREVIOUS_PERIOD_MAX },
    { label: "Time since transfer", marks: elapsedMarks, max: TRANSFER_ELAPSED_MAX },
    { label: "Unutilized leave", marks: leaveMarks, max: UNUTILIZED_LEAVE_MAX },
  ];
  const total = cap(rows.reduce((sum, row) => sum + row.marks, 0), CATEGORY_MAX_MARKS);
  return { categoryType: "6.5", total, breakdown: rows };
}

export function abroadPeriodMarks(years: number): number {
  for (const [minYears, marks] of ABROAD_PERIOD_TIERS) {
    if (years >= minYears) return marks;
  }
  return 0;
}

export function scoreCategory66(inputs: ScoringInputs): CategoryScore {
  const abroad = yearsBetween(inputs.abroadStartDate, inputs.abroadEndDate);
  const abroadMarks = abroadPeriodMarks(abroad);

  const purposeMarks = cap(EMPLOYMENT_PURPOSE_MARKS[inputs.employmentPurpose ?? ""] ?? 0, EMPLOYMENT_PURPOSE_MAX);
  const proximity = proximityMarks(inputs, PROXIMITY_PER_SCHOOL_66, PROXIMITY_MAX_66);

  const rows: ScoreRow[] = [
    { label: "Continuous period abroad with child", marks: abroadMarks, max: ABROAD_PERIOD_MAX },
    { label: "Employment purpose", marks: purposeMarks, max: EMPLOYMENT_PURPOSE_MAX },
    { label: "Nearby schools", marks: proximity, max: PROXIMITY_MAX_66 },
  ];
  const total = cap(rows.reduce((sum, row) => sum + row.marks, 0), CATEGORY_MAX_MARKS);
  return { categoryType: "6.6", total, breakdown: rows };
}

export function scoreCategory(category: CategoryApplication): CategoryScore {
  switch (category.categoryType) {
    case "6.1":
      return scoreCategory61(category.scoringInputs);
    case "6.2":
      return scoreCategory62(category.scoringInputs);
    case "6.3":
      return scoreCategory63(category.scoringInputs);
    case "6.4":
      return scoreCategory64(category.scoringInputs);
    case "6.5":
      return scoreCategory65(category.scoringInputs);
    case "6.6":
      return scoreCategory66(category.scoringInputs);
    default:
      return { categoryType: category.categoryType, total: 0, breakdown: [] };
  }
}

export function scoreBreakdown(inputs: ScoringInputs, categoryType: string): ScoreRow[] {
  return scoreCategory({ id: "", categoryType: categoryType as CategoryType, scoringInputs: inputs, locked: false } as CategoryApplication).breakdown;
}

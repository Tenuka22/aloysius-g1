import type { CategoryApplication, CategoryType, ScoringInputs } from "@/lib/application-store";
import {
  CATEGORY_MAX_MARKS,
  ELECTORAL_REGISTER_START_YEAR,
  ELECTORAL_REGISTER_END_YEAR,
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
  PAST_PUPILS_LIFE_MEMBER_MARKS,
  PAST_PUPILS_YEARLY_MARKS,
  PAST_PUPILS_MEMBERSHIP_MAX,
  PAST_PUPILS_COMMITTEE_MARKS_PER_YEAR,
  PAST_PUPILS_COMMITTEE_MAX_YEARS,
  PAST_PUPILS_COMMITTEE_MAX,
  PAST_PUPILS_EXECUTIVE_MARKS,
  PAST_PUPILS_EXECUTIVE_COUNT,
  PAST_PUPILS_EXECUTIVE_MAX,
  PAST_PUPILS_TOTAL_MAX,
  DEGREE_MAX,
  DIPLOMA_MARKS,
  SPORTS_MEET_CONTRIBUTION,
  SHRAMADANA_CONTRIBUTION,
  CONTRIBUTION_MAX,
  SCHOOL_PROJECTS_MARKS,
  SIBLING_MARKS_PER_SIBLING,
  SIBLING_STUDYING_MAX,
  SIBLING_STUDIED_HERE_MARKS,
  SIBLING_MULTIPLE_APPLYING_MARKS,
  SIBLING_PREFECT_MAX,
  SIBLING_EXAM_MAX,
  SIBLING_PRAISEWORTHY_MARKS,
  SIBLING_SUPPORT_MARKS,
  SIBLING_COCURRICULAR_TOTAL_MAX,
  MAIN_DOCUMENT_MAX_63,
  ELECTORAL_MARKS_PER_PERSON_YEAR_63,
  ELECTORAL_MAX_63,
  PROXIMITY_PER_SCHOOL_63,
  PROXIMITY_MAX_63,
  SERVICE_PERIOD_MAX,
  DIFFICULT_SERVICE_CURRENT_MARKS,
  DIFFICULT_SERVICE_PREVIOUS_BASE,
  DIFFICULT_SERVICE_MAX,
  DIFFICULT_DISTANCE_TIERS,
  DIFFICULT_EXTRA_PERIOD_MARKS,
  UNUTILIZED_LEAVE_MARKS_PER_YEAR,
  UNUTILIZED_LEAVE_MAX,
  SERVICE_LOCATION_MARKS,
  SERVICE_LOCATION_MAX,
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
} from "@/lib/marking-scheme";

export { CATEGORY_MAX_MARKS } from "@/lib/marking-scheme";

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

export function yearsBetween(d1: string | undefined, d2: string | undefined): number {
  if (!d1 || !d2) return 0;
  const a = new Date(d1);
  const b = new Date(d2);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.abs(b.getTime() - a.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export function electoralYearsRegistered(regYear: number | undefined): number {
  if (regYear == null || regYear < ELECTORAL_REGISTER_START_YEAR || regYear > ELECTORAL_REGISTER_END_YEAR) return 0;
  return ELECTORAL_REGISTER_END_YEAR + 1 - regYear;
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

export const SIBLING_PREFECT_LEVEL_MARKS: Record<string, number> = {
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
  const mother = electoralYearsRegistered(inputs.electoralMotherSince);
  const father = electoralYearsRegistered(inputs.electoralFatherSince);
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

  const sportsBase = SPORTS_LEVEL_MARKS[inputs.sportsLevel ?? ""] ?? 0;
  const sportsMarks = cap(sportsBase * (inputs.sportsCount ?? (sportsBase > 0 ? 1 : 0)), SPORTS_MAX);
  const leadershipMarks = cap(LEADERSHIP_ROLE_MARKS[inputs.leadershipRole ?? ""] ?? 0, LEADERSHIP_MAX);
  const studentSocietiesMarks = cap(STUDENT_SOCIETIES_ROLE_MARKS[inputs.studentSocietiesRole ?? ""] ?? 0, STUDENT_SOCIETIES_MAX);
  const otherActivityMarks = cap(OTHER_ACTIVITY_MARKS[inputs.otherActivity ?? ""] ?? 0, OTHER_ACTIVITIES_MAX);

  let pastPupilsMarks = 0;
  if (inputs.pastPupilsLifeMember) pastPupilsMarks += PAST_PUPILS_LIFE_MEMBER_MARKS;
  else if (inputs.pastPupilsMembershipStart && inputs.pastPupilsMembershipEnd) {
    const years = yearsBetween(inputs.pastPupilsMembershipStart, inputs.pastPupilsMembershipEnd);
    pastPupilsMarks += cap(years * PAST_PUPILS_YEARLY_MARKS, PAST_PUPILS_MEMBERSHIP_MAX);
  }
  if (inputs.pastPupilsCommitteeMember) pastPupilsMarks += cap(PAST_PUPILS_COMMITTEE_MARKS_PER_YEAR * PAST_PUPILS_COMMITTEE_MAX_YEARS, PAST_PUPILS_COMMITTEE_MAX);
  if (inputs.pastPupilsExecutiveOffice) pastPupilsMarks += cap(PAST_PUPILS_EXECUTIVE_MARKS * PAST_PUPILS_EXECUTIVE_COUNT, PAST_PUPILS_EXECUTIVE_MAX);
  pastPupilsMarks = cap(pastPupilsMarks, PAST_PUPILS_TOTAL_MAX);

  const degreeMarks = cap(DEGREE_MARKS[inputs.highestDegree ?? ""] ?? 0, DEGREE_MAX);
  const diplomaMarks = inputs.hasDiploma ? DIPLOMA_MARKS : 0;

  let contributionMarks = 0;
  if (inputs.sportsMeetContribution) contributionMarks += SPORTS_MEET_CONTRIBUTION;
  if (inputs.shramadanaContribution) contributionMarks += SHRAMADANA_CONTRIBUTION;
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
  const siblingsMarks = cap((inputs.siblingsCurrentlyStudyingCount ?? 0) * SIBLING_MARKS_PER_SIBLING, SIBLING_STUDYING_MAX);
  const studiedHereMarks = inputs.siblingStudiedAtAppliedSchool ? SIBLING_STUDIED_HERE_MARKS : 0;
  const multipleApplyingMarks = inputs.twoOrMoreSiblingsApplying ? SIBLING_MULTIPLE_APPLYING_MARKS : 0;
  const prefectMarks = cap(
    (SIBLING_PREFECT_LEVEL_MARKS[inputs.siblingPrefectLevel ?? ""] ?? 0) *
      (inputs.siblingPrefectCount ?? 0),
    SIBLING_PREFECT_MAX,
  );
  const examMarks = cap(SIBLING_EXAM_MARKS[inputs.siblingExamAchievement ?? ""] ?? 0, SIBLING_EXAM_MAX);
  const praiseworthyMarks = inputs.siblingPraiseworthyAchievement ? SIBLING_PRAISEWORTHY_MARKS : 0;
  const supportMarks = inputs.parentsSupportRendered ? SIBLING_SUPPORT_MARKS : 0;
  const cocurricularTotal = cap(
    prefectMarks + examMarks + praiseworthyMarks + supportMarks,
    SIBLING_COCURRICULAR_TOTAL_MAX,
  );
  const documentMarks = cap(MAIN_DOCUMENT_MARKS_63[inputs.mainDocumentType ?? ""] ?? 0, MAIN_DOCUMENT_MAX_63);
  const mother = electoralYearsRegistered(inputs.electoralMotherSince);
  const father = electoralYearsRegistered(inputs.electoralFatherSince);
  const electoralMarks = cap((mother + father) * ELECTORAL_MARKS_PER_PERSON_YEAR_63, ELECTORAL_MAX_63);
  const proximity = proximityMarks(inputs, PROXIMITY_PER_SCHOOL_63, PROXIMITY_MAX_63);

  const rows: ScoreRow[] = [
    { label: "Siblings currently studying", marks: siblingsMarks, max: SIBLING_STUDYING_MAX },
    { label: "Sibling studied at applied school", marks: studiedHereMarks, max: SIBLING_STUDIED_HERE_MARKS },
    { label: "Two or more siblings applying", marks: multipleApplyingMarks, max: SIBLING_MULTIPLE_APPLYING_MARKS },
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

export function difficultDistanceMarks(km: number | undefined): number {
  if (km == null) return 0;
  for (const [minKm, marks] of DIFFICULT_DISTANCE_TIERS) {
    if (km >= minKm) return marks;
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
  const serviceMarks = cap(yearsFromDate(inputs.serviceStartDate), SERVICE_PERIOD_MAX);

  let difficultMarks = 0;
  if (inputs.difficultServiceType === "current") {
    difficultMarks = DIFFICULT_SERVICE_CURRENT_MARKS;
  } else if (inputs.difficultServiceType === "previous") {
    const distance = difficultDistanceMarks(inputs.difficultServiceDistanceKm);
    const higherBranch = Math.max(DIFFICULT_SERVICE_PREVIOUS_BASE, distance);
    difficultMarks = higherBranch + (inputs.difficultServiceExtraPeriods ?? 0) * DIFFICULT_EXTRA_PERIOD_MARKS;
  }
  difficultMarks = cap(difficultMarks, DIFFICULT_SERVICE_MAX);

  const leaveMarks = cap((inputs.unutilizedLeaveYears ?? 0) * UNUTILIZED_LEAVE_MARKS_PER_YEAR, UNUTILIZED_LEAVE_MAX);
  const locationMarks = cap(SERVICE_LOCATION_MARKS[inputs.serviceLocationLevel ?? ""] ?? 0, SERVICE_LOCATION_MAX);
  const residenceDistance = tieredDistanceMarks(inputs.residenceToSchoolKm, RESIDENCE_DISTANCE_TIERS_64, RESIDENCE_DISTANCE_FALLBACK_64);
  const workplaceDistance = workplaceDistanceMarks(inputs.workplaceToSchoolKm);

  const rows: ScoreRow[] = [
    { label: "Period of service", marks: serviceMarks, max: SERVICE_PERIOD_MAX },
    { label: "Difficult service", marks: difficultMarks, max: DIFFICULT_SERVICE_MAX },
    { label: "Unutilized leave", marks: leaveMarks, max: UNUTILIZED_LEAVE_MAX },
    { label: "Service location", marks: locationMarks, max: SERVICE_LOCATION_MAX },
    { label: "Residence to school", marks: residenceDistance, max: RESIDENCE_DISTANCE_MAX_64 },
    { label: "Workplace to school", marks: workplaceDistance, max: WORKPLACE_DISTANCE_MAX },
  ];
  const total = cap(rows.reduce((sum, row) => sum + row.marks, 0), CATEGORY_MAX_MARKS);
  return { categoryType: "6.4", total, breakdown: rows };
}

export function scoreCategory65(inputs: ScoringInputs): CategoryScore {
  const distanceMarks = transferDistanceMarks(inputs.previousWorkplaceDistanceKm);

  const periodMarks = cap(yearsFromDate(inputs.serviceStartDate), TRANSFER_SERVICE_PERIOD_MAX);

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

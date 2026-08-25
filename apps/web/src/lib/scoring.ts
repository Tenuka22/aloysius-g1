import type { CategoryApplication, ScoringInputs } from "@/lib/application-store";

export const CATEGORY_MAX_MARKS = 100;

export type ScoreRow = { label: string; marks: number; max: number };
export type CategoryScore = { categoryType: string; total: number; breakdown: ScoreRow[] };

const round2 = (value: number) => Math.round(value * 100) / 100;
const cap = (value: number, max: number) => round2(Math.max(0, Math.min(value, max)));

function deedAgeWeight(years: number | undefined): number {
  if (years == null) return 1;
  if (years >= 5) return 1;
  if (years >= 4) return 0.8;
  if (years >= 3) return 0.6;
  if (years >= 2) return 0.4;
  if (years >= 1) return 0.2;
  if (years >= 0.5) return 0.1;
  return 0.05;
}

const MAIN_DOCUMENT_MARKS_61: Record<string, number> = {
  "title-deed-applicant": 20,
  "title-deed-parents": 16,
  "feeder-electoral-5yrs": 15,
  "lease-deed": 10,
  "municipal-ds-certificate": 5,
  "other-documents": 4,
};

const MAIN_DOCUMENT_MARKS_63: Record<string, number> = {
  "title-deed-applicant-spouse": 10,
  "title-deed-parents": 6,
  "feeder-electoral-5yrs": 6,
  "lease-deed": 4,
  "municipal-ds-rentact-cert": 4,
  "other-documents": 2,
};

const OL_CEILINGS: Record<number, Record<string, number>> = {
  6: { S: 4, C: 8, B: 10, A: 10 },
  8: { S: 4, C: 8, B: 10, A: 10 },
  9: { S: 4, C: 6, B: 8, A: 10 },
};

const AL_CEILINGS: Record<number, Record<string, number>> = {
  3: { S: 6, C: 8, B: 10, A: 12 },
  4: { S: 6, C: 8, B: 10, A: 12 },
};

function gradeRate(table: Record<string, number>, subjectCount: number, grade: string): number {
  return (table[grade] ?? 0) / subjectCount;
}

const SPORTS_LEVEL_MARKS: Record<string, number> = {
  "inter-house": 0.5,
  zonal: 1,
  district: 2,
  provincial: 3,
  national: 4.75,
  international: 5,
};

const LEADERSHIP_ROLE_MARKS: Record<string, number> = {
  "prefect-primary": 1,
  "prefect-junior": 1.5,
  "prefect-senior": 3,
  "deputy-head-prefect": 4,
  "head-prefect": 5,
  "first-team-vice-captain": 1.5,
  "first-team-captain": 2,
};

const SIBLING_PREFECT_LEVEL_MARKS: Record<string, number> = {
  "inter-house": 0.25,
  zonal: 0.5,
  district: 1,
  provincial: 1.5,
  national: 1.75,
  international: 2,
};

const SIBLING_EXAM_MARKS: Record<string, number> = {
  scholarship: 0.5,
  ol: 1,
  al: 1.5,
};

function electoralRegisterMarks61(inputs: ScoringInputs): number {
  const mother = inputs.electoralMotherYears ?? 0;
  const father = inputs.electoralFatherYears ?? 0;
  return cap((mother + father) * 2.5, 25);
}

function proximityMarks(inputs: ScoringInputs, perSchool: number, max: number): number {
  return cap((inputs.schoolsWithinRadius?.length ?? 0) * perSchool, max);
}

export function scoreCategory61(inputs: ScoringInputs): CategoryScore {
  const documentMax = MAIN_DOCUMENT_MARKS_61[inputs.mainDocumentType ?? ""];
  const documentMarks =
    documentMax != null ? cap(documentMax * deedAgeWeight(inputs.yearsRegistered), 20) : 0;
  const additionalMarks = cap((inputs.additionalDocs?.length ?? 0) * 1, 5);
  const electoralMarks = electoralRegisterMarks61(inputs);
  const proximity = proximityMarks(inputs, 5, 50);
  const rows: ScoreRow[] = [
    { label: "Main residence document", marks: documentMarks, max: 20 },
    { label: "Additional documents", marks: additionalMarks, max: 5 },
    { label: "Electoral register", marks: electoralMarks, max: 25 },
    { label: "Nearby schools", marks: proximity, max: 50 },
  ];
  const total = cap(rows.reduce((sum, row) => sum + row.marks, 0), CATEGORY_MAX_MARKS);
  return { categoryType: "6.1", total, breakdown: rows };
}

export function scoreCategory62(inputs: ScoringInputs): CategoryScore {
  const yearsMarks = cap((inputs.alumniYearsAtSchool ?? 0) * 2, 26);
  const scholarshipMarks = inputs.grade5ScholarshipPassed ? 3 : 0;

  let olMarks = 0;
  const olCount = inputs.olSubjectCount;
  const olTable = olCount != null ? OL_CEILINGS[olCount] : undefined;
  if (olTable && olCount != null) {
    for (const grade of ["S", "C", "B", "A"]) {
      olMarks += (inputs[`olGrade${grade}` as "olGradeS"] ?? 0) * gradeRate(olTable, olCount, grade);
    }
  }
  olMarks = cap(olMarks, 10);

  let alMarks = 0;
  const alCount = inputs.alSubjectCount;
  const alTable = alCount != null ? AL_CEILINGS[alCount] : undefined;
  if (alTable && alCount != null) {
    for (const grade of ["S", "C", "B", "A"]) {
      alMarks += (inputs[`alGrade${grade}` as "alGradeS"] ?? 0) * gradeRate(alTable, alCount, grade);
    }
  }
  alMarks = cap(alMarks, 12);

  const educationalMarks = cap(scholarshipMarks + olMarks + alMarks, 25);

  const sportsBase = SPORTS_LEVEL_MARKS[inputs.sportsLevel ?? ""] ?? 0;
  const sportsMarks = cap(sportsBase * (inputs.sportsCount ?? (sportsBase > 0 ? 1 : 0)), 10);
  const leadershipMarks = cap(LEADERSHIP_ROLE_MARKS[inputs.leadershipRole ?? ""] ?? 0, 5);

  const rows: ScoreRow[] = [
    { label: "Years educated at school", marks: yearsMarks, max: 26 },
    { label: "Grade 5 Scholarship", marks: scholarshipMarks, max: 3 },
    { label: "G.C.E. (O/L)", marks: olMarks, max: 10 },
    { label: "G.C.E. (A/L)", marks: alMarks, max: 12 },
    { label: "Sports / co-curricular", marks: sportsMarks, max: 10 },
    { label: "Leadership role", marks: leadershipMarks, max: 5 },
  ];
  const total = cap(rows.reduce((sum, row) => sum + row.marks, 0), CATEGORY_MAX_MARKS);
  return { categoryType: "6.2", total, breakdown: rows };
}

export function scoreCategory63(inputs: ScoringInputs): CategoryScore {
  const siblingsMarks = cap((inputs.siblingsCurrentlyStudyingCount ?? 0) * 2, 20);
  const studiedHereMarks = inputs.siblingStudiedAtAppliedSchool ? 5 : 0;
  const multipleApplyingMarks = inputs.twoOrMoreSiblingsApplying ? 5 : 0;
  const prefectMarks = cap(
    (SIBLING_PREFECT_LEVEL_MARKS[inputs.siblingPrefectLevel ?? ""] ?? 0) *
      (inputs.siblingPrefectCount ?? 0),
    2,
  );
  const examMarks = cap(SIBLING_EXAM_MARKS[inputs.siblingExamAchievement ?? ""] ?? 0, 2);
  const praiseworthyMarks = inputs.siblingPraiseworthyAchievement ? 2 : 0;
  const supportMarks = inputs.parentsSupportRendered ? 4 : 0;
  const cocurricularTotal = cap(
    prefectMarks + examMarks + praiseworthyMarks + supportMarks,
    10,
  );
  const documentMarks = cap(MAIN_DOCUMENT_MARKS_63[inputs.mainDocumentType ?? ""] ?? 0, 10);
  const mother = inputs.electoralMotherYears ?? 0;
  const father = inputs.electoralFatherYears ?? 0;
  const electoralMarks = cap((mother + father) * 2, 20);
  const proximity = proximityMarks(inputs, 3, 30);

  const rows: ScoreRow[] = [
    { label: "Siblings currently studying", marks: siblingsMarks, max: 20 },
    { label: "Sibling studied at applied school", marks: studiedHereMarks, max: 5 },
    { label: "Two or more siblings applying", marks: multipleApplyingMarks, max: 5 },
    { label: "Sibling co-curricular & prefect", marks: cocurricularTotal, max: 10 },
    { label: "Residence document", marks: documentMarks, max: 10 },
    { label: "Electoral register", marks: electoralMarks, max: 20 },
    { label: "Nearby schools", marks: proximity, max: 30 },
  ];
  const total = cap(rows.reduce((sum, row) => sum + row.marks, 0), CATEGORY_MAX_MARKS);
  return { categoryType: "6.3", total, breakdown: rows };
}

export function scoreCategory64(inputs: ScoringInputs): CategoryScore {
  const serviceMarks = cap(inputs.periodOfServiceYears ?? 0, 20);

  let difficultMarks = 0;
  if (inputs.difficultServiceType === "current") {
    difficultMarks = 25;
  } else if (inputs.difficultServiceType === "previous") {
    const previousBase = 15;
    const distance = difficultDistanceMarks(inputs.difficultServiceDistanceKm);
    const higherBranch = Math.max(previousBase, distance);
    difficultMarks = higherBranch + (inputs.difficultServiceExtraPeriods ?? 0) * 0.5;
  }
  difficultMarks = cap(difficultMarks, 25);

  const leaveMarks = cap((inputs.unutilizedLeaveYears ?? 0) * 2, 10);
  const locationMarksMap: Record<string, number> = {
    "same-school": 10,
    zone: 7.5,
    province: 5,
    "education-institution": 2.5,
  };
  const locationMarks = cap(locationMarksMap[inputs.serviceLocationLevel ?? ""] ?? 0, 10);
  const residenceDistance = tieredDistanceMarks(inputs.residenceToSchoolKm, [
    [1, 10],
    [3, 8],
    [5, 6],
  ], 4);
  const workplaceDistance = workplaceDistanceMarks(inputs.workplaceToSchoolKm);

  const rows: ScoreRow[] = [
    { label: "Period of service", marks: serviceMarks, max: 20 },
    { label: "Difficult service", marks: difficultMarks, max: 25 },
    { label: "Unutilized leave", marks: leaveMarks, max: 10 },
    { label: "Service location", marks: locationMarks, max: 10 },
    { label: "Residence to school", marks: residenceDistance, max: 10 },
    { label: "Workplace to school", marks: workplaceDistance, max: 25 },
  ];
  const total = cap(rows.reduce((sum, row) => sum + row.marks, 0), CATEGORY_MAX_MARKS);
  return { categoryType: "6.4", total, breakdown: rows };
}

function difficultDistanceMarks(km: number | undefined): number {
  if (km == null) return 0;
  if (km >= 150) return 15;
  if (km > 100) return 10;
  if (km > 75) return 5;
  return 0;
}

function tieredDistanceMarks(km: number | undefined, tiers: Array<[number, number]>, fallback: number): number {
  if (km == null) return 0;
  for (const [limit, marks] of tiers) {
    if (km <= limit) return marks;
  }
  return fallback;
}

function workplaceDistanceMarks(km: number | undefined): number {
  if (km == null) return 0;
  if (km >= 100) return 25;
  if (km >= 70) return 20;
  if (km >= 40) return 15;
  if (km >= 20) return 10;
  return 5;
}

export function scoreCategory65(inputs: ScoringInputs): CategoryScore {
  const km = inputs.previousWorkplaceDistanceKm;
  let distanceMarks = 0;
  if (km != null && km > 150) distanceMarks = 35;
  else if (km != null && km > 100) distanceMarks = 28;
  else if (km != null && km >= 50) distanceMarks = 21;

  const periodMarks = cap(inputs.periodOfServiceYears ?? 0, 10);

  let previousPeriodMarks = 0;
  const years = inputs.previousWorkplacePeriodYears;
  if (years != null) {
    if (years >= 3) previousPeriodMarks = 10;
    else if (years >= 2) previousPeriodMarks = 8;
    else if (years >= 1) previousPeriodMarks = 5;
  }

  let elapsedMarks = 0;
  const elapsed = inputs.transferElapsedYears;
  if (elapsed != null) {
    if (elapsed <= 1) elapsedMarks = 5;
    else if (elapsed <= 2) elapsedMarks = 4;
    else if (elapsed <= 3) elapsedMarks = 3;
    else if (elapsed <= 4) elapsedMarks = 2;
    else if (elapsed <= 5) elapsedMarks = 1;
  }

  const leaveMarks = cap((inputs.unutilizedLeaveYears ?? 0) * 2, 10);
  const proximity = proximityMarks(inputs, 3, 30);

  const rows: ScoreRow[] = [
    { label: "Previous-to-new workplace distance", marks: distanceMarks, max: 35 },
    { label: "Nearby schools", marks: proximity, max: 30 },
    { label: "Period of service", marks: periodMarks, max: 10 },
    { label: "Period at previous workplace", marks: previousPeriodMarks, max: 10 },
    { label: "Time since transfer", marks: elapsedMarks, max: 5 },
    { label: "Unutilized leave", marks: leaveMarks, max: 10 },
  ];
  const total = cap(rows.reduce((sum, row) => sum + row.marks, 0), CATEGORY_MAX_MARKS);
  return { categoryType: "6.5", total, breakdown: rows };
}

export function scoreCategory66(inputs: ScoringInputs): CategoryScore {
  const abroad = inputs.periodAbroadYears;
  let abroadMarks = 0;
  if (abroad != null) {
    if (abroad >= 3) abroadMarks = 25;
    else if (abroad >= 2) abroadMarks = 15;
    else if (abroad >= 1) abroadMarks = 10;
  }

  const purposeMap: Record<string, number> = {
    board: 40,
    personal: 30,
    government: 25,
    education: 20,
  };
  const purposeMarks = cap(purposeMap[inputs.employmentPurpose ?? ""] ?? 0, 40);
  const proximity = proximityMarks(inputs, 3.5, 35);

  const rows: ScoreRow[] = [
    { label: "Continuous period abroad with child", marks: abroadMarks, max: 25 },
    { label: "Employment purpose", marks: purposeMarks, max: 40 },
    { label: "Nearby schools", marks: proximity, max: 35 },
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

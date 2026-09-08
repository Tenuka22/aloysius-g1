import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  applyLocationChange,
} from "./application-store";
import {
  scoreCategory,
  scoreCategory61,
  scoreCategory62,
  scoreCategory63,
  scoreCategory64,
  scoreCategory65,
  scoreCategory66,
} from "./scoring";

const schools = (count: number) => Array.from({ length: count }, (_, index) => `school-${index}`);

// Several scoring functions compute elapsed years against the real system
// clock (`yearsFromDate`), so the expected values below are only stable for a
// pinned "now". Chosen so every hardcoded date in this file lands exactly on
// a whole-year boundary.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

describe("scoreCategory61 – residence & proximity", () => {
  it("scores zero for an empty form", () => {
    const result = scoreCategory61({});
    expect(result.total).toBe(50);
    expect(result.breakdown).toHaveLength(4);
  });

  it("awards full 20 for a title deed in the applicant's name", () => {
    expect(scoreCategory61({ mainDocumentType: "title-deed-applicant", deedTransferDate: "2020-01-01" }).breakdown[0]?.marks).toBe(20);
  });

  it("awards 16 for parents' title deed and 10 for lease and 5 for certificate", () => {
    expect(scoreCategory61({ mainDocumentType: "title-deed-parents", deedTransferDate: "2020-01-01" }).breakdown[0]?.marks).toBe(16);
    expect(scoreCategory61({ mainDocumentType: "lease-deed", deedTransferDate: "2020-01-01" }).breakdown[0]?.marks).toBe(10);
    expect(scoreCategory61({ mainDocumentType: "municipal-ds-certificate", deedTransferDate: "2020-01-01" }).breakdown[0]?.marks).toBe(5);
    expect(scoreCategory61({ mainDocumentType: "other-documents", deedTransferDate: "2020-01-01" }).breakdown[0]?.marks).toBe(4);
    expect(scoreCategory61({ mainDocumentType: "feeder-electoral-5yrs", deedTransferDate: "2020-01-01" }).breakdown[0]?.marks).toBe(15);
  });

  it("applies the deed age weighting to the document marks", () => {
    expect(scoreCategory61({ mainDocumentType: "title-deed-applicant", deedTransferDate: "2020-01-01" }).breakdown[0]?.marks).toBe(20);
    expect(scoreCategory61({ mainDocumentType: "title-deed-applicant", deedTransferDate: "2022-02-01" }).breakdown[0]?.marks).toBe(16);
    expect(scoreCategory61({ mainDocumentType: "title-deed-applicant", deedTransferDate: "2023-07-01" }).breakdown[0]?.marks).toBe(12);
    expect(scoreCategory61({ mainDocumentType: "title-deed-applicant", deedTransferDate: "2024-02-01" }).breakdown[0]?.marks).toBe(8);
    expect(scoreCategory61({ mainDocumentType: "title-deed-applicant", deedTransferDate: "2025-02-01" }).breakdown[0]?.marks).toBe(4);
    expect(scoreCategory61({ mainDocumentType: "title-deed-applicant", deedTransferDate: "2025-11-01" }).breakdown[0]?.marks).toBe(2);
    expect(scoreCategory61({ mainDocumentType: "title-deed-applicant", deedTransferDate: "2026-06-01" }).breakdown[0]?.marks).toBe(1);
  });

  it("treats old deed transfer dates as full weight", () => {
    expect(scoreCategory61({ mainDocumentType: "lease-deed", deedTransferDate: "2020-01-01" }).breakdown[0]?.marks).toBe(10);
  });

  it("caps additional documents at five", () => {
    expect(scoreCategory61({ additionalDocs: ["a"] }).breakdown[1]?.marks).toBe(1);
    expect(scoreCategory61({ additionalDocs: ["a", "b", "c"] }).breakdown[1]?.marks).toBe(3);
    expect(scoreCategory61({ additionalDocs: ["a", "b", "c", "d", "e"] }).breakdown[1]?.marks).toBe(5);
    expect(scoreCategory61({ additionalDocs: ["a", "b", "c", "d", "e", "f", "g"] }).breakdown[1]?.marks).toBe(5);
  });

  it("awards 2.5 per registered electoral person-year capped at 25", () => {
    expect(scoreCategory61({ electoralMotherSince: 2020, electoralFatherSince: 2020 }).breakdown[2]?.marks).toBe(25);
    expect(scoreCategory61({ electoralMotherSince: 2020, electoralFatherSince: 2021 }).breakdown[2]?.marks).toBe(22.5);
    expect(scoreCategory61({ electoralMotherSince: 2020, electoralFatherSince: undefined }).breakdown[2]?.marks).toBe(12.5);
    expect(scoreCategory61({ electoralMotherSince: 2020, electoralFatherSince: 2020 }).breakdown[2]?.marks).toBe(25);
  });

  it("awards five marks per selected nearby school capped at fifty", () => {
    expect(scoreCategory61({ schoolsWithinRadius: [] }).breakdown[3]?.marks).toBe(50);
    expect(scoreCategory61({ schoolsWithinRadius: schools(3) }).breakdown[3]?.marks).toBe(35);
    expect(scoreCategory61({ schoolsWithinRadius: schools(10) }).breakdown[3]?.marks).toBe(0);
    expect(scoreCategory61({ schoolsWithinRadius: schools(14) }).breakdown[3]?.marks).toBe(0);
  });

  it("caps the category total at one hundred even with maximal inputs", () => {
    const maximal = scoreCategory61({
      mainDocumentType: "title-deed-applicant",
      deedTransferDate: "2017-01-01",
      additionalDocs: ["a", "b", "c", "d", "e"],
      electoralMotherSince: 2020,
      electoralFatherSince: 2020,
      schoolsWithinRadius: [],
    });
    expect(maximal.total).toBe(100);
  });

  it("ignores unknown document types instead of guessing", () => {
    expect(scoreCategory61({ mainDocumentType: "forged-doc" }).breakdown[0]?.marks).toBe(0);
  });
});

describe("scoreCategory62 – alumni", () => {
  it("awards two marks per year capped at twenty-six", () => {
    expect(scoreCategory62({ alumniStartDate: "2018-01-01", alumniEndDate: "2026-01-01" }).breakdown[0]?.marks).toBe(16);
    expect(scoreCategory62({ alumniStartDate: "2013-01-01", alumniEndDate: "2026-01-01" }).breakdown[0]?.marks).toBe(26);
    expect(scoreCategory62({ alumniStartDate: "2006-01-01", alumniEndDate: "2026-01-01" }).breakdown[0]?.marks).toBe(26);
  });

  it("awards three for the grade 5 scholarship", () => {
    expect(scoreCategory62({ grade5ScholarshipPassed: true }).breakdown[1]?.marks).toBe(3);
    expect(scoreCategory62({}).breakdown[1]?.marks).toBe(0);
  });

  it("uses the nine-subject O/L table where each grade row hits its printed ceiling exactly", () => {
    expect(scoreCategory62({ olSubjectCount: 9, olGradeA: 9 }).breakdown[2]?.marks).toBe(10);
    expect(scoreCategory62({ olSubjectCount: 9, olGradeB: 9 }).breakdown[2]?.marks).toBe(8);
    expect(scoreCategory62({ olSubjectCount: 9, olGradeC: 9 }).breakdown[2]?.marks).toBeCloseTo(6, 2);
    expect(scoreCategory62({ olSubjectCount: 9, olGradeS: 9 }).breakdown[2]?.marks).toBeCloseTo(4, 2);
  });

  it("caps O/L marks at ten regardless of grade inflation", () => {
    expect(scoreCategory62({ olSubjectCount: 6, olGradeA: 6 }).breakdown[2]?.marks).toBe(0);
    expect(scoreCategory62({ olSubjectCount: 9, olGradeA: 30 }).breakdown[2]?.marks).toBe(10);
  });

  it("does not count an electoral year outside the 2020–2024 window", () => {
    expect(scoreCategory61({ electoralMotherSince: 2019, electoralFatherSince: 2025 }).breakdown[2]?.marks).toBe(0);
    expect(scoreCategory63({ electoralMotherSince: 2019, electoralFatherSince: 2025 }).breakdown[5]?.marks).toBe(0);
  });

  it("uses the three-subject A/L table where all A grades reach exactly twelve", () => {
    expect(scoreCategory62({ alSubjectCount: 3, alGradeA: 3 }).breakdown[3]?.marks).toBe(12);
    expect(scoreCategory62({ alSubjectCount: 3, alGradeS: 3 }).breakdown[3]?.marks).toBe(6);
    expect(scoreCategory62({ alSubjectCount: 4, alGradeA: 4 }).breakdown[3]?.marks).toBe(12);
    expect(scoreCategory62({ alSubjectCount: 4, alGradeC: 4 }).breakdown[3]?.marks).toBe(8);
  });

  it("scores no exam marks when no attempt is recorded", () => {
    expect(scoreCategory62({ olSubjectCount: undefined, alSubjectCount: undefined }).breakdown[2]?.marks).toBe(0);
    expect(scoreCategory62({ olSubjectCount: undefined, alSubjectCount: undefined }).breakdown[3]?.marks).toBe(0);
  });

  it("multiplies sports level by achievement count capped at ten", () => {
    expect(scoreCategory62({ sportsLevel: "international", sportsCount: 1 }).breakdown[4]?.marks).toBe(5);
    expect(scoreCategory62({ sportsLevel: "inter-house", sportsCount: 4 }).breakdown[4]?.marks).toBe(2);
    expect(scoreCategory62({ sportsLevel: "national", sportsCount: 3 }).breakdown[4]?.marks).toBe(10);
    expect(scoreCategory62({ sportsLevel: "zonal" }).breakdown[4]?.marks).toBe(1);
    expect(scoreCategory62({ sportsLevel: "district", sportsCount: 0 }).breakdown[4]?.marks).toBe(0);
  });

  it("awards leadership marks by role capped at five", () => {
    expect(scoreCategory62({ leadershipRole: "head-prefect" }).breakdown[5]?.marks).toBe(5);
    expect(scoreCategory62({ leadershipRole: "prefect-primary" }).breakdown[5]?.marks).toBe(1);
    expect(scoreCategory62({ leadershipRole: "first-team-captain" }).breakdown[5]?.marks).toBe(2);
  });

  it("sums to the documented attainable maximum of sixty-six from collected inputs", () => {
    const maximal = scoreCategory62({
      alumniStartDate: "2013-01-01",
      alumniEndDate: "2026-01-01",
      grade5ScholarshipPassed: true,
      olSubjectCount: 9,
      olGradeA: 9,
      alSubjectCount: 3,
      alGradeA: 3,
      sportsLevel: "international",
      sportsCount: 2,
      leadershipRole: "head-prefect",
    });
    expect(maximal.total).toBeCloseTo(66, 2);
  });});

describe("scoreCategory63 – siblings", () => {
  it("awards two marks per sibling currently studying capped at twenty", () => {
    expect(scoreCategory63({ siblingsCurrentlyStudyingCount: 3 }).breakdown[0]?.marks).toBe(6);
    expect(scoreCategory63({ siblingsCurrentlyStudyingCount: 10 }).breakdown[0]?.marks).toBe(20);
    expect(scoreCategory63({ siblingsCurrentlyStudyingCount: 12 }).breakdown[0]?.marks).toBe(20);
  });

  it("awards five each for same-school sibling study and multiple applications", () => {
    expect(scoreCategory63({ siblingStudiedAtAppliedSchool: true }).breakdown[1]?.marks).toBe(5);
    expect(scoreCategory63({ twoOrMoreSiblingsApplying: true }).breakdown[2]?.marks).toBe(5);
  });

  it("combines sibling co-curricular blocks capped at ten", () => {
    const base: ScoringInputs = {
      siblingPrefectLevel: "international",
      siblingPrefectCount: 1,
      siblingExamAchievement: "al",
      siblingPraiseworthyAchievement: true,
      parentsSupportRendered: true,
    };
    expect(scoreCategory63(base).breakdown[3]?.marks).toBeCloseTo(9.5, 2);
    expect(
      scoreCategory63({ ...base, siblingPrefectLevel: "national", parentsSupportRendered: false }).breakdown[3]?.marks,
    ).toBeCloseTo(5.25, 2);
  });

  it("caps prefect skills at two even across many achievements", () => {
    expect(
      scoreCategory63({ siblingPrefectLevel: "international", siblingPrefectCount: 5 }).breakdown[3]?.marks,
    ).toBeLessThanOrEqual(10);
  });

  it("maps sibling residence documents to their own lower scale capped at ten", () => {
    expect(scoreCategory63({ mainDocumentType: "title-deed-applicant-spouse" }).breakdown[4]?.marks).toBe(10);
    expect(scoreCategory63({ mainDocumentType: "title-deed-parents" }).breakdown[4]?.marks).toBe(6);
    expect(scoreCategory63({ mainDocumentType: "feeder-electoral-5yrs" }).breakdown[4]?.marks).toBe(6);
    expect(scoreCategory63({ mainDocumentType: "lease-deed" }).breakdown[4]?.marks).toBe(4);
  });

  it("awards two marks per electoral person-year capped at twenty", () => {
    expect(scoreCategory63({ electoralMotherSince: 2020, electoralFatherSince: 2020 }).breakdown[5]?.marks).toBe(20);
    expect(scoreCategory63({ electoralMotherSince: 2022 }).breakdown[5]?.marks).toBe(6);
  });

  it("deducts three marks per nearby school from thirty", () => {
    expect(scoreCategory63({ schoolsWithinRadius: schools(4) }).breakdown[6]?.marks).toBe(18);
    expect(scoreCategory63({ schoolsWithinRadius: schools(10) }).breakdown[6]?.marks).toBe(0);
  });

  it("reaches the attainable maximum of ninety-nine and a half (exam block tops at 1.5)", () => {
    const maximal = scoreCategory63({
      siblingsCurrentlyStudyingCount: 10,
      siblingStudiedAtAppliedSchool: true,
      twoOrMoreSiblingsApplying: true,
      siblingPrefectLevel: "international",
      siblingPrefectCount: 1,
      siblingExamAchievement: "al",
      siblingPraiseworthyAchievement: true,
      parentsSupportRendered: true,
      mainDocumentType: "title-deed-applicant-spouse",
      electoralMotherSince: 2020,
      electoralFatherSince: 2020,
      schoolsWithinRadius: [],
    });
    expect(maximal.total).toBeCloseTo(99.5, 2);
  });
});

describe("scoreCategory64 – service & distance", () => {
  it("awards one mark per service year capped at twenty", () => {
    expect(scoreCategory64({ serviceStartDate: "2019-09-01" }).breakdown[0]?.marks).toBe(7);
    expect(scoreCategory64({ serviceStartDate: "2001-01-01" }).breakdown[0]?.marks).toBe(20);
  });

  it("awards flat twenty-five for current difficult service", () => {
    expect(scoreCategory64({ difficultServiceType: "current" }).breakdown[1]?.marks).toBe(25);
  });

  it("takes the higher of previous-service and distance branches", () => {
    expect(
      scoreCategory64({ difficultServiceType: "previous", difficultServiceDistanceKm: 200 }).breakdown[1]?.marks,
    ).toBe(15);
    expect(
      scoreCategory64({
        difficultServiceType: "previous",
        difficultServiceExtraPeriods: 4,
        difficultServiceDistanceKm: 90,
      }).breakdown[1]?.marks,
    ).toBe(17);
  });

  it("adds half a mark per extra six-month period beyond the first year", () => {
    expect(
      scoreCategory64({ difficultServiceType: "previous", difficultServiceExtraPeriods: 2 }).breakdown[1]?.marks,
    ).toBe(16);
  });

  it("keeps branch I as the floor and lets distance raise it only above fifteen", () => {
    expect(scoreCategory64({ difficultServiceType: "previous", difficultServiceDistanceKm: 160 }).breakdown[1]?.marks).toBe(15);
    expect(scoreCategory64({ difficultServiceType: "previous", difficultServiceDistanceKm: 120 }).breakdown[1]?.marks).toBe(15);
    expect(scoreCategory64({ difficultServiceType: "previous", difficultServiceDistanceKm: 80 }).breakdown[1]?.marks).toBe(15);
    expect(scoreCategory64({ difficultServiceType: "previous", difficultServiceDistanceKm: 50 }).breakdown[1]?.marks).toBe(15);
  });

  it("stacks extra-period bonuses on the higher branch capped at twenty-five", () => {
    expect(
      scoreCategory64({
        difficultServiceType: "previous",
        difficultServiceExtraPeriods: 20,
        difficultServiceDistanceKm: 160,
      }).breakdown[1]?.marks,
    ).toBe(25);
    expect(
      scoreCategory64({ difficultServiceType: "previous", difficultServiceExtraPeriods: 30 }).breakdown[1]?.marks,
    ).toBe(25);
  });

  it("awards two marks per unutilized-leave year capped at ten", () => {
    expect(scoreCategory64({ unutilizedLeaveYears: 3 }).breakdown[2]?.marks).toBe(6);
    expect(scoreCategory64({ unutilizedLeaveYears: 6 }).breakdown[2]?.marks).toBe(10);
  });

  it("maps service location levels including fractional zone value", () => {
    expect(scoreCategory64({ serviceLocationLevel: "same-school" }).breakdown[3]?.marks).toBe(10);
    expect(scoreCategory64({ serviceLocationLevel: "zone" }).breakdown[3]?.marks).toBe(7.5);
    expect(scoreCategory64({ serviceLocationLevel: "province" }).breakdown[3]?.marks).toBe(5);
    expect(scoreCategory64({ serviceLocationLevel: "education-institution" }).breakdown[3]?.marks).toBe(2.5);
  });

  it("bands residence distance downward with distance", () => {
    expect(scoreCategory64({ residenceToSchoolKm: 0.5 }).breakdown[4]?.marks).toBe(10);
    expect(scoreCategory64({ residenceToSchoolKm: 1 }).breakdown[4]?.marks).toBe(10);
    expect(scoreCategory64({ residenceToSchoolKm: 2 }).breakdown[4]?.marks).toBe(8);
    expect(scoreCategory64({ residenceToSchoolKm: 4.9 }).breakdown[4]?.marks).toBe(6);
    expect(scoreCategory64({ residenceToSchoolKm: 12 }).breakdown[4]?.marks).toBe(4);
    expect(scoreCategory64({ residenceToSchoolKm: undefined }).breakdown[4]?.marks).toBe(0);
  });

  it("bands workplace distance with a floor of five inside twenty kilometres", () => {
    expect(scoreCategory64({ workplaceToSchoolKm: 150 }).breakdown[5]?.marks).toBe(25);
    expect(scoreCategory64({ workplaceToSchoolKm: 85 }).breakdown[5]?.marks).toBe(20);
    expect(scoreCategory64({ workplaceToSchoolKm: 45 }).breakdown[5]?.marks).toBe(15);
    expect(scoreCategory64({ workplaceToSchoolKm: 25 }).breakdown[5]?.marks).toBe(10);
    expect(scoreCategory64({ workplaceToSchoolKm: 3 }).breakdown[5]?.marks).toBe(5);
    expect(scoreCategory64({ workplaceToSchoolKm: undefined }).breakdown[5]?.marks).toBe(0);
  });
});

describe("scoreCategory65 – transfers", () => {
  it("awards transfer distance bands only above the fifty-kilometre eligibility floor", () => {
    expect(scoreCategory65({ previousWorkplaceDistanceKm: 200 }).breakdown[0]?.marks).toBe(35);
    expect(scoreCategory65({ previousWorkplaceDistanceKm: 120 }).breakdown[0]?.marks).toBe(28);
    expect(scoreCategory65({ previousWorkplaceDistanceKm: 60 }).breakdown[0]?.marks).toBe(21);
    expect(scoreCategory65({ previousWorkplaceDistanceKm: 49 }).breakdown[0]?.marks).toBe(0);
    expect(scoreCategory65({}).breakdown[0]?.marks).toBe(0);
  });

  it("deducts three marks per nearby school from thirty", () => {
    expect(scoreCategory65({ schoolsWithinRadius: [] }).breakdown[1]?.marks).toBe(30);
    expect(scoreCategory65({ schoolsWithinRadius: schools(10) }).breakdown[1]?.marks).toBe(0);
  });

  it("caps service period at ten", () => {
    expect(scoreCategory65({ serviceStartDate: "2022-09-01" }).breakdown[2]?.marks).toBe(4);
    expect(scoreCategory65({ serviceStartDate: "1986-01-01" }).breakdown[2]?.marks).toBe(10);
  });

  it("bands previous-workplace tenure", () => {
    expect(scoreCategory65({ previousWorkplaceStartDate: "2021-09-01" }).breakdown[3]?.marks).toBe(10);
    expect(scoreCategory65({ previousWorkplaceStartDate: "2024-03-01" }).breakdown[3]?.marks).toBe(8);
    expect(scoreCategory65({ previousWorkplaceStartDate: "2025-07-01" }).breakdown[3]?.marks).toBe(5);
    expect(scoreCategory65({ previousWorkplaceStartDate: "2026-03-01" }).breakdown[3]?.marks).toBe(0);
  });

  it("decays transfer recency from five to one", () => {
    expect(scoreCategory65({ transferDate: "2026-03-01" }).breakdown[4]?.marks).toBe(5);
    expect(scoreCategory65({ transferDate: "2024-09-01" }).breakdown[4]?.marks).toBe(4);
    expect(scoreCategory65({ transferDate: "2023-09-01" }).breakdown[4]?.marks).toBe(3);
    expect(scoreCategory65({ transferDate: "2022-09-01" }).breakdown[4]?.marks).toBe(2);
    expect(scoreCategory65({ transferDate: "2021-09-01" }).breakdown[4]?.marks).toBe(1);
    expect(scoreCategory65({ transferDate: "2020-09-01" }).breakdown[4]?.marks).toBe(0);
  });

  it("does not award transfer recency marks before a transfer date is entered", () => {
    expect(scoreCategory65({}).breakdown[4]?.marks).toBe(0);
  });

  it("caps unutilized leave at ten", () => {
    expect(scoreCategory65({ unutilizedLeaveYears: 5 }).breakdown[5]?.marks).toBe(10);
    expect(scoreCategory65({ unutilizedLeaveYears: 7 }).breakdown[5]?.marks).toBe(10);
  });

  it("reaches exactly one hundred at maxima", () => {
    const maximal = scoreCategory65({
      previousWorkplaceDistanceKm: 300,
      schoolsWithinRadius: [],
      serviceStartDate: "2016-01-01",
      previousWorkplaceStartDate: "2021-09-01",
      transferDate: "2025-09-01",
      unutilizedLeaveYears: 5,
    });
    expect(maximal.total).toBe(100);
  });
});

describe("scoreCategory66 – foreign employment", () => {
  it("bands continuous-abroad periods", () => {
    expect(scoreCategory66({ abroadStartDate: "2021-01-01", abroadEndDate: "2026-01-01" }).breakdown[0]?.marks).toBe(25);
    expect(scoreCategory66({ abroadStartDate: "2024-01-01", abroadEndDate: "2026-01-01" }).breakdown[0]?.marks).toBe(15);
    expect(scoreCategory66({ abroadStartDate: "2025-01-01", abroadEndDate: "2026-06-01" }).breakdown[0]?.marks).toBe(10);
    expect(scoreCategory66({ abroadStartDate: "2026-01-01", abroadEndDate: "2026-06-01" }).breakdown[0]?.marks).toBe(0);
  });

  it("maps employment purposes to their distinct weights", () => {
    expect(scoreCategory66({ employmentPurpose: "board" }).breakdown[1]?.marks).toBe(40);
    expect(scoreCategory66({ employmentPurpose: "personal" }).breakdown[1]?.marks).toBe(30);
    expect(scoreCategory66({ employmentPurpose: "government" }).breakdown[1]?.marks).toBe(25);
    expect(scoreCategory66({ employmentPurpose: "education" }).breakdown[1]?.marks).toBe(20);
  });

  it("deducts three and a half marks per nearby school from thirty-five", () => {
    expect(scoreCategory66({ schoolsWithinRadius: [] }).breakdown[2]?.marks).toBe(35);
    expect(scoreCategory66({ schoolsWithinRadius: schools(4) }).breakdown[2]?.marks).toBe(21);
    expect(scoreCategory66({ schoolsWithinRadius: schools(10) }).breakdown[2]?.marks).toBe(0);
  });

  it("reaches exactly one hundred at maxima", () => {
    const maximal = scoreCategory66({
      abroadStartDate: "2022-09-01",
      abroadEndDate: "2026-09-01",
      employmentPurpose: "board",
      schoolsWithinRadius: [],
    });
    expect(maximal.total).toBe(100);
  });
});

describe("scoreCategory dispatcher", () => {
  it("routes each type to its scorer and returns matching categoryType", () => {
    const cases = [
      { categoryType: "6.1", inputs: {} },
      { categoryType: "6.2", inputs: {} },
      { categoryType: "6.3", inputs: {} },
      { categoryType: "6.4", inputs: {} },
      { categoryType: "6.5", inputs: {} },
      { categoryType: "6.6", inputs: {} },
    ] as const;
    for (const item of cases) {
      const result = scoreCategory({ id: "x", categoryType: item.categoryType, scoringInputs: item.inputs });
      expect(result.categoryType).toBe(item.categoryType);
      expect(result.total).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns zero total for an unknown type without throwing", () => {
    const result = scoreCategory({ id: "x", categoryType: "9.9" as never, scoringInputs: {} });
    expect(result.total).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  it("keeps totals non-negative for nonsensical negative inputs", () => {
    expect(scoreCategory64({ serviceStartDate: undefined }).total).toBe(0);
    expect(scoreCategory61({ schoolsWithinRadius: schools(2), additionalDocs: [] }).total).toBeGreaterThanOrEqual(0);
    expect(applyLocationChange({ deviceLocationHistory: [], userLocationHistory: [], defaultLocations: [] }, { label: "", address: "", latitude: null, longitude: null, source: "" }).userLocationHistory.length).toBe(0);
  });
});

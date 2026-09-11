import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  applyLocationChange,
  type ScoringInputs,
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
    expect(scoreCategory61({ electoralMotherYears: [2021,2022,2023,2024,2025], electoralFatherYears: [2021,2022,2023,2024,2025] }).breakdown[2]?.marks).toBe(25);
    expect(scoreCategory61({ electoralMotherYears: [2021,2022,2023,2024,2025], electoralFatherYears: [2022,2023,2024,2025] }).breakdown[2]?.marks).toBe(22.5);
    expect(scoreCategory61({ electoralMotherYears: [2021,2022,2023,2024,2025], electoralFatherYears: undefined }).breakdown[2]?.marks).toBe(12.5);
    expect(scoreCategory61({ electoralMotherYears: [2021,2022,2023,2024,2025], electoralFatherYears: [2021,2022,2023,2024,2025] }).breakdown[2]?.marks).toBe(25);
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
      electoralMotherYears: [2021,2022,2023,2024,2025],
      electoralFatherYears: [2021,2022,2023,2024,2025],
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

  it("uses the ten-subject O/L table (B excluded, S/C/A only) where each grade row hits its printed ceiling exactly", () => {
    expect(scoreCategory62({ olSubjectCount: 10, olGradeA: 10 }).breakdown[2]?.marks).toBe(10);
    expect(scoreCategory62({ olSubjectCount: 10, olGradeC: 10 }).breakdown[2]?.marks).toBe(8);
    expect(scoreCategory62({ olSubjectCount: 10, olGradeS: 10 }).breakdown[2]?.marks).toBeCloseTo(4, 2);
    expect(scoreCategory62({ olSubjectCount: 10, olGradeB: 10 }).breakdown[2]?.marks).toBe(0);
  });

  it("caps O/L marks at ten regardless of grade inflation", () => {
    expect(scoreCategory62({ olSubjectCount: 6, olGradeA: 6 }).breakdown[2]?.marks).toBe(0);
    expect(scoreCategory62({ olSubjectCount: 9, olGradeA: 30 }).breakdown[2]?.marks).toBe(10);
  });

  it("does not count an electoral year outside the scored window", () => {
    expect(scoreCategory61({ electoralMotherYears: [2019, 2020], electoralFatherYears: [2026] }).breakdown[2]?.marks).toBe(0);
    expect(scoreCategory63({ electoralMotherYears: [2019, 2020], electoralFatherYears: [2026] }).breakdown[5]?.marks).toBe(0);
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

  it("sums marks across every checked level in every sports entry, capped at ten", () => {
    expect(scoreCategory62({ sportsEntries: [{ name: "Athletics", levels: ["international"] }] }).breakdown[4]?.marks).toBe(5);
    expect(
      scoreCategory62({
        sportsEntries: [
          { name: "Athletics", levels: ["national", "zonal"] },
          { name: "Swimming", levels: ["district"] },
        ],
      }).breakdown[4]?.marks,
    ).toBeCloseTo(4.75 + 1 + 2, 2);
    expect(
      scoreCategory62({
        sportsEntries: [{ levels: ["national"] }, { levels: ["national"] }, { levels: ["national"] }],
      }).breakdown[4]?.marks,
    ).toBe(10);
    expect(scoreCategory62({ sportsEntries: [{ name: "Chess" }] }).breakdown[4]?.marks).toBe(0);
    expect(scoreCategory62({}).breakdown[4]?.marks).toBe(0);
  });

  it("sums leadership marks across every checked role capped at five", () => {
    expect(scoreCategory62({ leadershipRoles: ["head-prefect"] }).breakdown[5]?.marks).toBe(5);
    expect(scoreCategory62({ leadershipRoles: ["prefect-primary"] }).breakdown[5]?.marks).toBe(1);
    expect(scoreCategory62({ leadershipRoles: ["prefect-primary", "first-team-captain"] }).breakdown[5]?.marks).toBe(3);
    expect(scoreCategory62({ leadershipRoles: ["head-prefect", "deputy-head-prefect"] }).breakdown[5]?.marks).toBe(5);
  });

  it("sums student societies marks across every checked role in every entry, capped at five", () => {
    expect(
      scoreCategory62({ studentSocietiesEntries: [{ name: "Debate Club", roles: ["president"] }] }).breakdown[6]
        ?.marks,
    ).toBe(1);
    expect(
      scoreCategory62({
        studentSocietiesEntries: [
          { name: "Debate Club", roles: ["president"] },
          { name: "Chess Club", roles: ["vice-president"] },
          { name: "Art Club", roles: ["committee-member"] },
        ],
      }).breakdown[6]?.marks,
    ).toBeCloseTo(1 + 0.75 + 0.5, 2);
    expect(
      scoreCategory62({
        studentSocietiesEntries: Array.from({ length: 5 }, () => ({ roles: ["president" as const] })),
      }).breakdown[6]?.marks,
    ).toBe(5);
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
      sportsEntries: [{ levels: ["international"] }, { levels: ["international"] }],
      leadershipRoles: ["head-prefect"],
    });
    expect(maximal.total).toBeCloseTo(66, 2);
  });});

describe("scoreCategory63 \u2013 siblings", () => {
  it("awards two marks per grade completed by the sibling capped at twenty", () => {
    expect(scoreCategory63({ siblingGradesCompletedCount: 3 }).breakdown[0]?.marks).toBe(6);
    expect(scoreCategory63({ siblingGradesCompletedCount: 10 }).breakdown[0]?.marks).toBe(20);
    expect(scoreCategory63({ siblingGradesCompletedCount: 12 }).breakdown[0]?.marks).toBe(20);
  });

  it("awards five each for same-school sibling study and multiple applications", () => {
    expect(scoreCategory63({ siblingStudiedAtAppliedSchool: true }).breakdown[1]?.marks).toBe(5);
    expect(scoreCategory63({ twoOrMoreSiblingsStudyingOtherGrades: true }).breakdown[2]?.marks).toBe(5);
  });

  it("combines sibling co-curricular blocks capped at ten", () => {
    const base: ScoringInputs = {
      siblingSportsEntries: [{ levels: ["international"] }],
      siblingExamAchievements: ["al"],
      siblingLeadershipAchievement: true,
      parentsSupportRendered: true,
    };
    expect(scoreCategory63(base).breakdown[3]?.marks).toBeCloseTo(9.5, 2);
    expect(
      scoreCategory63({ ...base, siblingSportsEntries: [{ levels: ["national"] }], parentsSupportRendered: false }).breakdown[3]?.marks,
    ).toBeCloseTo(5.25, 2);
  });

  it("caps prefect skills at two even across many achievements", () => {
    expect(
      scoreCategory63({
        siblingSportsEntries: [
          { levels: ["international"] },
          { levels: ["international"] },
          { levels: ["international"] },
        ],
      }).breakdown[3]?.marks,
    ).toBeLessThanOrEqual(10);
  });

  it("maps sibling residence documents to their own lower scale capped at ten", () => {
    expect(scoreCategory63({ mainDocumentType: "title-deed-applicant-spouse" }).breakdown[4]?.marks).toBe(10);
    expect(scoreCategory63({ mainDocumentType: "title-deed-parents" }).breakdown[4]?.marks).toBe(6);
    expect(scoreCategory63({ mainDocumentType: "feeder-electoral-5yrs" }).breakdown[4]?.marks).toBe(6);
    expect(scoreCategory63({ mainDocumentType: "lease-deed" }).breakdown[4]?.marks).toBe(4);
  });

  it("awards two marks per electoral person-year capped at twenty", () => {
    expect(scoreCategory63({ electoralMotherYears: [2021,2022,2023,2024,2025], electoralFatherYears: [2021,2022,2023,2024,2025] }).breakdown[5]?.marks).toBe(20);
    expect(scoreCategory63({ electoralMotherYears: [2022,2023,2024] }).breakdown[5]?.marks).toBe(6);
  });

  it("deducts three marks per nearby school from thirty", () => {
    expect(scoreCategory63({ schoolsWithinRadius: schools(4) }).breakdown[6]?.marks).toBe(18);
    expect(scoreCategory63({ schoolsWithinRadius: schools(10) }).breakdown[6]?.marks).toBe(0);
  });

  it("reaches the attainable maximum of ninety-nine and a half (exam block tops at 1.5)", () => {
    const maximal = scoreCategory63({
      siblingGradesCompletedCount: 10,
      siblingStudiedAtAppliedSchool: true,
      twoOrMoreSiblingsStudyingOtherGrades: true,
      siblingSportsEntries: [{ levels: ["international"] }],
      siblingExamAchievements: ["al"],
      siblingLeadershipAchievement: true,
      parentsSupportRendered: true,
      mainDocumentType: "title-deed-applicant-spouse",
      electoralMotherYears: [2021,2022,2023,2024,2025],
      electoralFatherYears: [2021,2022,2023,2024,2025],
      schoolsWithinRadius: [],
    });
    expect(maximal.total).toBeCloseTo(99.5, 2);
  });
});

describe("scoreCategory64 – education sector", () => {
  // 7.5.1 gates the rest of the category: a valid, non-zero contribution
  // must be present for any other row to award marks. These bases give a
  // deliberately small, easy-to-subtract contribution score.
  const institutionBase: ScoringInputs = {
    contributionPath: "institution",
    contributionSameSchool: true,
    contributionServiceStartDate: "2023-09-01", // 3 whole years before "now"
  };
  const universityBase: ScoringInputs = {
    contributionPath: "university",
    contributionExamYears: 1,
  };

  describe("7.5.1 contribution (Path I - institution service)", () => {
    it("pays the higher same-school rate per whole year, capped at ten", () => {
      expect(
        scoreCategory64({ contributionPath: "institution", contributionSameSchool: true, contributionServiceStartDate: "2023-09-01" }).breakdown[0]?.marks,
      ).toBe(6); // 2/yr * 3 years
      expect(
        scoreCategory64({ contributionPath: "institution", contributionSameSchool: true, contributionServiceStartDate: "2018-09-01" }).breakdown[0]?.marks,
      ).toBe(10); // 8 years capped at 5 * 2/yr
    });

    it("pays the lower elsewhere rate per whole year, capped at seven and a half", () => {
      expect(
        scoreCategory64({ contributionPath: "institution", contributionSameSchool: false, contributionServiceStartDate: "2023-09-01" }).breakdown[0]?.marks,
      ).toBe(4.5); // 1.5/yr * 3 years
      expect(
        scoreCategory64({ contributionPath: "institution", contributionSameSchool: false, contributionServiceStartDate: "2010-09-01" }).breakdown[0]?.marks,
      ).toBe(7.5); // capped at 5 years * 1.5/yr
    });

    it("awards half of one year's rate for under a year at the current station", () => {
      expect(
        scoreCategory64({ contributionPath: "institution", contributionSameSchool: true, contributionServiceStartDate: "2026-03-01" }).breakdown[0]?.marks,
      ).toBe(1); // half of 2
      expect(
        scoreCategory64({ contributionPath: "institution", contributionSameSchool: false, contributionServiceStartDate: "2026-03-01" }).breakdown[0]?.marks,
      ).toBe(0.75); // half of 1.5
    });

    it("scores zero with no service start date", () => {
      expect(scoreCategory64({ contributionPath: "institution", contributionSameSchool: true }).breakdown[0]?.marks).toBe(0);
    });
  });

  describe("7.5.1 contribution (Path II - UGC university staff)", () => {
    it("sums three sub-items at 0.5 marks per year, each capped at two and a half", () => {
      expect(
        scoreCategory64({
          contributionPath: "university",
          contributionExamYears: 2,
          contributionCurriculumYears: 3,
          contributionTrainingYears: 6,
        }).breakdown[0]?.marks,
      ).toBe(5); // 1 + 1.5 + 2.5(capped from 3)
    });

    it("scores zero with no sub-items entered", () => {
      expect(scoreCategory64({ contributionPath: "university" }).breakdown[0]?.marks).toBe(0);
    });
  });

  it("zeroes the entire category when contribution is zero, regardless of other inputs", () => {
    const maximal = scoreCategory64({
      serviceStartDate: "2001-01-01",
      difficultServiceType: "current",
      difficultServiceStartDate: "2020-09-01",
      unutilizedLeaveYears: 5,
      residenceToSchoolKm: 0.5,
      workplaceToSchoolKm: 150,
    });
    expect(maximal.breakdown.every((row) => row.marks === 0)).toBe(true);
    expect(maximal.total).toBe(0);
  });

  it("awards one mark per whole completed service year, capped at twenty, only when gated open", () => {
    expect(scoreCategory64({ ...institutionBase, serviceStartDate: "2019-09-01" }).breakdown[1]?.marks).toBe(7);
    expect(scoreCategory64({ ...institutionBase, serviceStartDate: "2001-01-01" }).breakdown[1]?.marks).toBe(20);
    expect(scoreCategory64({ serviceStartDate: "2001-01-01" }).breakdown[1]?.marks).toBe(0);
  });

  describe("7.5.3 difficult service", () => {
    it("pays five marks per full year currently served, capped at twenty-five", () => {
      expect(
        scoreCategory64({ ...institutionBase, difficultServiceType: "current", difficultServiceStartDate: "2025-09-01" }).breakdown[2]?.marks,
      ).toBe(5);
      expect(
        scoreCategory64({ ...institutionBase, difficultServiceType: "current", difficultServiceStartDate: "2021-09-01" }).breakdown[2]?.marks,
      ).toBe(25);
    });

    it("adds a one-off half-rate bonus once a full year carries a six-month-or-more remainder", () => {
      expect(
        scoreCategory64({ ...institutionBase, difficultServiceType: "current", difficultServiceStartDate: "2025-02-01" }).breakdown[2]?.marks,
      ).toBe(7.5); // 1 year 7 months: 5 + 2.5
      expect(
        scoreCategory64({ ...institutionBase, difficultServiceType: "current", difficultServiceStartDate: "2025-06-01" }).breakdown[2]?.marks,
      ).toBe(5); // 1 year 3 months: remainder under six months, no bonus
    });

    it("pays three marks per full year previously served at a classified difficult station, capped at fifteen", () => {
      expect(
        scoreCategory64({
          ...institutionBase,
          difficultServiceType: "previous",
          difficultServicePreviousStartDate: "2020-09-01",
          difficultServicePreviousEndDate: "2023-09-01",
        }).breakdown[2]?.marks,
      ).toBe(9);
      expect(
        scoreCategory64({
          ...institutionBase,
          difficultServiceType: "previous",
          difficultServicePreviousStartDate: "2015-09-01",
          difficultServicePreviousEndDate: "2023-09-01",
        }).breakdown[2]?.marks,
      ).toBe(15); // 8 years capped at 5 * 3/yr
    });

    it("scores the distance-tier branch independently of the classified-difficult branch", () => {
      expect(
        scoreCategory64({
          ...institutionBase,
          difficultServiceType: "previous",
          difficultServiceDistanceStartDate: "2020-09-01",
          difficultServiceDistanceEndDate: "2023-09-01",
          difficultServiceDistanceKm: 200,
        }).breakdown[2]?.marks,
      ).toBe(9); // 3 years * 3/yr (150km+ tier) with no classified-difficult dates entered
      expect(
        scoreCategory64({
          ...institutionBase,
          difficultServiceType: "previous",
          difficultServiceDistanceStartDate: "2019-09-01",
          difficultServiceDistanceEndDate: "2023-09-01",
          difficultServiceDistanceKm: 120,
        }).breakdown[2]?.marks,
      ).toBe(8); // 4 years * 2/yr (100-150km tier)
    });

    it("takes the higher of the two independently-dated branches", () => {
      expect(
        scoreCategory64({
          ...institutionBase,
          difficultServiceType: "previous",
          difficultServicePreviousStartDate: "2024-09-01",
          difficultServicePreviousEndDate: "2026-09-01", // 2 years -> 3*2=6
          difficultServiceDistanceStartDate: "2021-09-01",
          difficultServiceDistanceEndDate: "2026-09-01", // 5 years -> 3*5=15
          difficultServiceDistanceKm: 160,
        }).breakdown[2]?.marks,
      ).toBe(15);
    });
  });

  it("restricts unutilized leave to the institution path, never the university path", () => {
    expect(scoreCategory64({ ...institutionBase, unutilizedLeaveYears: 3 }).breakdown[3]?.marks).toBe(6);
    expect(scoreCategory64({ ...institutionBase, unutilizedLeaveYears: 6 }).breakdown[3]?.marks).toBe(10);
    expect(scoreCategory64({ ...universityBase, unutilizedLeaveYears: 6 }).breakdown[3]?.marks).toBe(0);
  });

  it("bands residence distance downward with distance, only when gated open", () => {
    expect(scoreCategory64({ ...institutionBase, residenceToSchoolKm: 0.5 }).breakdown[4]?.marks).toBe(10);
    expect(scoreCategory64({ ...institutionBase, residenceToSchoolKm: 2 }).breakdown[4]?.marks).toBe(8);
    expect(scoreCategory64({ ...institutionBase, residenceToSchoolKm: 4.9 }).breakdown[4]?.marks).toBe(6);
    expect(scoreCategory64({ ...institutionBase, residenceToSchoolKm: 12 }).breakdown[4]?.marks).toBe(4);
    expect(scoreCategory64({ residenceToSchoolKm: 0.5 }).breakdown[4]?.marks).toBe(0);
  });

  it("bands workplace distance with a floor of five inside twenty kilometres, only when gated open", () => {
    expect(scoreCategory64({ ...institutionBase, workplaceToSchoolKm: 150 }).breakdown[5]?.marks).toBe(25);
    expect(scoreCategory64({ ...institutionBase, workplaceToSchoolKm: 45 }).breakdown[5]?.marks).toBe(15);
    expect(scoreCategory64({ ...institutionBase, workplaceToSchoolKm: 3 }).breakdown[5]?.marks).toBe(5);
    expect(scoreCategory64({ workplaceToSchoolKm: 150 }).breakdown[5]?.marks).toBe(0);
  });

  it("reaches the documented attainable maximum of one hundred", () => {
    const maximal = scoreCategory64({
      contributionPath: "institution",
      contributionSameSchool: true,
      contributionServiceStartDate: "2010-09-01",
      serviceStartDate: "2001-01-01",
      difficultServiceType: "current",
      difficultServiceStartDate: "2015-09-01",
      unutilizedLeaveYears: 5,
      residenceToSchoolKm: 0.5,
      workplaceToSchoolKm: 150,
    });
    expect(maximal.total).toBe(100);
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
    expect(scoreCategory66({ employmentPurpose: "diplomatic" }).breakdown[1]?.marks).toBe(40);
    expect(scoreCategory66({ employmentPurpose: "government" }).breakdown[1]?.marks).toBe(40);
    expect(scoreCategory66({ employmentPurpose: "education" }).breakdown[1]?.marks).toBe(30);
    expect(scoreCategory66({ employmentPurpose: "employment" }).breakdown[1]?.marks).toBe(25);
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
      employmentPurpose: "diplomatic",
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

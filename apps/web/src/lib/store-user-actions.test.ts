// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyLocationChange,
  createCategory,
  emptyDraft,
  LOCATION_HISTORY_LIMIT,
  normalizeDraft,
  prependLocationHistory,
  useApplicationStore,
  type ApplicationDraft,
  type CategoryApplication,
  type LocationDraft,
} from "./application-store";
import { scoreCategory } from "./scoring";

/* ───────── helpers ───────── */

const point = (lat: number, lng: number, overrides: Partial<LocationDraft> = {}): LocationDraft => ({
  label: `${lat},${lng}`,
  address: `${lat} Road`,
  latitude: lat,
  longitude: lng,
  source: "map",
  ...overrides,
});

beforeEach(() => {
  useApplicationStore.getState().reset();
});

/* ════════════════════════════════════════════════════════════════════════════
   1. CATEGORY CRUD - add → update → remove → verify scores
   ════════════════════════════════════════════════════════════════════════════ */

describe("Category CRUD during wizard", () => {
  it("addCategory creates entry with empty scoringInputs", () => {
    useApplicationStore.getState().addCategory("6.1");
    const cats = useApplicationStore.getState().categories;
    expect(cats).toHaveLength(1);
    expect(cats[0]?.categoryType).toBe("6.1");
    expect(cats[0]?.scoringInputs).toEqual({});
  });

  it("updateCategoryInputs patches only the target category", () => {
    const store = useApplicationStore.getState();
    store.addCategory("6.1");
    store.addCategory("6.4");
    const [id1, id2] = useApplicationStore.getState().categories.map((c) => c.id);

    useApplicationStore.getState().updateCategoryInputs(id1!, { mainDocumentType: "title-deed-applicant" });
    useApplicationStore.getState().updateCategoryInputs(id2!, { serviceStartDate: "2021-09-01" });

    const cats = useApplicationStore.getState().categories;
    expect(cats[0]?.scoringInputs.mainDocumentType).toBe("title-deed-applicant");
    expect(cats[0]?.scoringInputs.serviceStartDate).toBeUndefined();
    expect(cats[1]?.scoringInputs.serviceStartDate).toBe("2021-09-01");
    expect(cats[1]?.scoringInputs.mainDocumentType).toBeUndefined();
  });

  it("removeCategory removes only the matching entry", () => {
    const store = useApplicationStore.getState();
    store.addCategory("6.1");
    store.addCategory("6.3");
    const id2 = useApplicationStore.getState().categories[1]?.id!;
    useApplicationStore.getState().removeCategory(id2);
    const cats = useApplicationStore.getState().categories;
    expect(cats).toHaveLength(1);
    expect(cats[0]?.categoryType).toBe("6.1");
  });

  it("removing all categories leaves empty array", () => {
    useApplicationStore.getState().addCategory("6.1");
    useApplicationStore.getState().addCategory("6.2");
    const ids = useApplicationStore.getState().categories.map((c) => c.id);
    for (const id of ids) useApplicationStore.getState().removeCategory(id);
    expect(useApplicationStore.getState().categories).toEqual([]);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   2. SCORE CONSISTENCY - updating inputs changes scores
   ════════════════════════════════════════════════════════════════════════════ */

describe("Score consistency", () => {
  it("title-deed-applicant gives 20 marks for 6.1", () => {
    const cat: CategoryApplication = {
      id: "s1",
      categoryType: "6.1",
      locked: false,
      scoringInputs: { mainDocumentType: "title-deed-applicant", deedTransferDate: "2020-01-01", schoolsWithinRadius: [] },
    };
    const score = scoreCategory(cat);
    expect(score.breakdown.some((b) => b.label === "Main residence document" && b.marks === 20)).toBe(true);
  });

  it("removing a school from schoolsWithinRadius increases proximity score", () => {
    const withSchools: CategoryApplication = {
      id: "s2",
      categoryType: "6.1",
      locked: false,
      scoringInputs: { mainDocumentType: "other-documents", schoolsWithinRadius: ["s1", "s2", "s3"] },
    };
    const withoutSchools: CategoryApplication = {
      id: "s3",
      categoryType: "6.1",
      locked: false,
      scoringInputs: { mainDocumentType: "other-documents", schoolsWithinRadius: [] },
    };
    expect(scoreCategory(withoutSchools).total).toBeGreaterThan(scoreCategory(withSchools).total);
  });

  it("category total never exceeds 100", () => {
    const cat: CategoryApplication = {
      id: "s4",
      categoryType: "6.1",
      locked: false,
      scoringInputs: {
        mainDocumentType: "title-deed-applicant",
        additionalDocs: ["nic", "driving-license", "landline-bill", "marriage-certificate", "life-insurance-policy", "school-leaving-certificate", "child-birth-certificate", "vehicle-registration", "bank-passbook"],
        deedTransferDate: "2021-09-01",
        electoralMotherSince: 2020,
        electoralFatherSince: 2020,
        schoolsWithinRadius: ["s1", "s2", "s3", "s4", "s5"],
      },
    };
    expect(scoreCategory(cat).total).toBeLessThanOrEqual(100);
  });

  it("6.4 current difficult-service gives 25 flat", () => {
    const cat: CategoryApplication = {
      id: "s5",
      categoryType: "6.4",
      locked: false,
      scoringInputs: { serviceStartDate: "2016-09-01", difficultServiceType: "current" },
    };
    const score = scoreCategory(cat);
    expect(score.breakdown.some((b) => b.label.includes("Difficult") && b.marks === 25)).toBe(true);
  });

  it("6.2 exact ceiling A-level (3-subject) = 12/3", () => {
    const cat: CategoryApplication = {
      id: "s6",
      categoryType: "6.2",
      locked: false,
      scoringInputs: {
        olSubjectCount: 9,
        olGradeA: 9,
        alSubjectCount: 3,
        alGradeA: 3,
      },
    };
    const score = scoreCategory(cat);
    const alRow = score.breakdown.find((b) => b.label.includes("A/L"));
    expect(alRow?.marks).toBeCloseTo(12, 2);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   3. LOCATION HISTORY - accumulation and capping
   ════════════════════════════════════════════════════════════════════════════ */

describe("Location history accumulation", () => {
  it("multiple different locations accumulate in user history", () => {
    let draft: Pick<ApplicationDraft, "deviceLocationHistory" | "userLocationHistory" | "defaultLocations"> = {
      deviceLocationHistory: [],
      userLocationHistory: [],
      defaultLocations: [],
    };
    draft = applyLocationChange(draft, point(6.1, 80.1));
    draft = applyLocationChange(draft, point(6.2, 80.2));
    draft = applyLocationChange(draft, point(6.3, 80.3));
    expect(draft.userLocationHistory).toHaveLength(3);
    expect(draft.userLocationHistory[0]?.latitude).toBe(6.3);
  });

  it("identical consecutive selections are deduped", () => {
    let draft: Pick<ApplicationDraft, "deviceLocationHistory" | "userLocationHistory" | "defaultLocations"> = {
      deviceLocationHistory: [],
      userLocationHistory: [],
      defaultLocations: [],
    };
    for (let i = 0; i < 5; i++) draft = applyLocationChange(draft, point(6.1, 80.1));
    expect(draft.userLocationHistory).toHaveLength(1);
  });

  it("history list is capped at LOCATION_HISTORY_LIMIT", () => {
    let history: LocationDraft[] = [];
    for (let i = 0; i < LOCATION_HISTORY_LIMIT + 20; i++) {
      history = prependLocationHistory(history, point(i, i));
    }
    expect(history).toHaveLength(LOCATION_HISTORY_LIMIT);
    expect(history[0]?.latitude).toBe(LOCATION_HISTORY_LIMIT + 19);
    expect(history.at(-1)?.latitude).toBe(20);
  });

  it("device fix with defaultValue records into both deviceHistory and userHistory", () => {
    const fix = point(7.0, 81.0, { source: "device", label: "GPS" });
    const draft = applyLocationChange(
      { deviceLocationHistory: [], userLocationHistory: [], defaultLocations: [] },
      fix,
      fix,
    );
    expect(draft.deviceLocationHistory).toHaveLength(1);
    expect(draft.userLocationHistory).toHaveLength(1);
  });

  it("map selection without defaultValue goes into userHistory only", () => {
    const draft = applyLocationChange(
      { deviceLocationHistory: [], userLocationHistory: [], defaultLocations: [] },
      point(7.0, 81.0),
    );
    expect(draft.userLocationHistory).toHaveLength(1);
    expect(draft.deviceLocationHistory).toHaveLength(0);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   4. NORMALIZATION - corrupt drafts are repaired on rehydrate
   ════════════════════════════════════════════════════════════════════════════ */

describe("Normalization on rehydrate", () => {
  it("missing categories becomes empty array", () => {
    expect(normalizeDraft({}).categories).toEqual([]);
  });

  it("non-array categories becomes empty array", () => {
    expect(normalizeDraft({ categories: "bad" as unknown }).categories).toEqual([]);
  });

  it("junk category entries are dropped", () => {
    const draft = normalizeDraft({
      categories: [null, 42, "junk", { categoryType: "6.9" }] as unknown,
    });
    expect(draft.categories).toEqual([]);
  });

  it("valid category entries are preserved with defaults", () => {
    const draft = normalizeDraft({
      categories: [{ categoryType: "6.1" }, { id: "x", categoryType: "6.4", scoringInputs: { serviceStartDate: "2023-09-01" } }] as unknown,
    });
    expect(draft.categories).toHaveLength(2);
    expect(draft.categories[0]?.categoryType).toBe("6.1");
    expect(draft.categories[0]?.id).toMatch(/6\.1-/);
    expect(draft.categories[1]?.id).toBe("x");
    expect(draft.categories[1]?.scoringInputs.serviceStartDate).toBe("2023-09-01");
  });

  it("missing deviceLocationHistory becomes empty array", () => {
    const draft = normalizeDraft({});
    expect(draft.deviceLocationHistory).toEqual([]);
    expect(draft.userLocationHistory).toEqual([]);
  });

  it("non-array location histories are dropped", () => {
    const draft = normalizeDraft({
      deviceLocationHistory: "bad" as unknown,
      userLocationHistory: 42 as unknown,
    });
    expect(draft.deviceLocationHistory).toEqual([]);
    expect(draft.userLocationHistory).toEqual([]);
  });

  it("duplicate category ids are de-duplicated", () => {
    const draft = normalizeDraft({
      categories: [
        { id: "dup", categoryType: "6.1" },
        { id: "dup", categoryType: "6.4" },
        { id: "dup", categoryType: "6.5" },
      ] as unknown,
    });
    const ids = draft.categories.map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
  });
});


/* ════════════════════════════════════════════════════════════════════════════
   6. STEP NAVIGATION
   ════════════════════════════════════════════════════════════════════════════ */

describe("Step navigation", () => {
  it("setStep stores the value", () => {
    useApplicationStore.getState().setStep(3);
    expect(useApplicationStore.getState().currentStep).toBe(3);
  });

  it("reset returns draft to empty state", () => {
    useApplicationStore.getState().addCategory("6.1");
    useApplicationStore.getState().setStep(3);
    useApplicationStore.getState().reset();
    const store = useApplicationStore.getState();
    expect(store.currentStep).toBe(0);
    expect(store.categories).toEqual([]);
    expect(store.applicant.fullName).toBe("");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   7. MULTI-CATEGORY SCORING - multiple types sum independently
   ════════════════════════════════════════════════════════════════════════════ */

describe("Multi-category scoring", () => {
  it("6.1 and 6.3 scores are computed independently", () => {
    const cat61: CategoryApplication = {
      id: "m1",
      categoryType: "6.1",
      scoringInputs: { mainDocumentType: "title-deed-applicant", schoolsWithinRadius: ["s1"] },
    };
    const cat63: CategoryApplication = {
      id: "m2",
      categoryType: "6.3",
      scoringInputs: { mainDocumentType: "title-deed-applicant-spouse", schoolsWithinRadius: ["s1"] },
    };
    const score61 = scoreCategory(cat61);
    const score63 = scoreCategory(cat63);
    expect(score61.total).toBeGreaterThan(0);
    expect(score63.total).toBeGreaterThan(0);
    expect(score61.total).not.toBe(score63.total);
  });

  it("each category type has its own breakdown labels", () => {
    const types = ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6"] as const;
    for (const type of types) {
      const cat: CategoryApplication = { id: `t-${type}`, categoryType: type, scoringInputs: {} };
      const score = scoreCategory(cat);
      expect(score.breakdown.length).toBeGreaterThan(0);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
    }
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   8. UPDATED AT TIMESTAMP - set on every updateDraft call
   ════════════════════════════════════════════════════════════════════════════ */

describe("Updated-at timestamp", () => {
  it("lastSavedAt is null initially", () => {
    expect(useApplicationStore.getState().lastSavedAt).toBeNull();
  });

  it("lastSavedAt is set after addCategory", () => {
    useApplicationStore.getState().addCategory("6.1");
    expect(useApplicationStore.getState().lastSavedAt).toBeTruthy();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   9. createCategory utility
   ════════════════════════════════════════════════════════════════════════════ */

describe("createCategory", () => {
  it("generates unique ids for same type at different counts", () => {
    const c1 = createCategory("6.1", 0);
    const c2 = createCategory("6.1", 1);
    const c3 = createCategory("6.4", 0);
    expect(c1.id).not.toBe(c2.id);
    expect(c1.id).not.toBe(c3.id);
    expect(c1.categoryType).toBe("6.1");
    expect(c3.categoryType).toBe("6.4");
  });

  it("defaults scoringInputs to empty object", () => {
    const cat = createCategory("6.3");
    expect(cat.scoringInputs).toEqual({});
  });
});

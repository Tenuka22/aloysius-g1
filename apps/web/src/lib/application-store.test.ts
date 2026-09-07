// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  applyLocationChange,
  emptyDraft,
  LOCATION_HISTORY_LIMIT,
  normalizeDraft,
  prependLocationHistory,
  useApplicationStore,
  type ApplicationDraft,
  type CategoryApplication,
  type LocationDraft,
} from "./application-store";

const point = (latitude: number, longitude: number, overrides: Partial<LocationDraft> = {}): LocationDraft => ({
  label: `Point ${latitude},${longitude}`,
  address: `${latitude} Test Road`,
  latitude,
  longitude,
  source: "map",
  ...overrides,
});
describe("emptyDraft", () => {
  it("has step 0, empty strings and nulls", () => {
    expect(emptyDraft.currentStep).toBe(0);
    expect(emptyDraft.lastSavedAt).toBeNull();
    for (const section of ["location", "selectedLocation"]) {
      expect(emptyDraft[section as keyof ApplicationDraft]).toMatchObject({ label: "", address: "", latitude: null, longitude: null, source: "" });
    }
    expect(emptyDraft.defaultLocations).toEqual([]);
    expect(emptyDraft.applicant).toMatchObject({ fullName: "", sinhalaName: "", gender: "", religion: "", educationMedium: "", dateOfBirth: "", birthCertificateNumber: "" });
    expect(emptyDraft.guardian).toMatchObject({ relationship: "", fullName: "", nic: "", phone: "", whatsappPhone: "", email: "" });
    expect(emptyDraft.residence).toMatchObject({ permanentAddress: "", currentAddress: "", sameAsPermanent: false, district: "", dsDivision: "", gnDivision: "", electoralDistrict: "" });
    expect(emptyDraft.declaration).toEqual({ confirmed: false, consent: false });
  });
});

describe("normalizeDraft", () => {
  it("returns the empty draft for null input", () => expect(normalizeDraft(null)).toEqual(emptyDraft));
  it("returns the empty draft for undefined input", () => expect(normalizeDraft(undefined)).toEqual(emptyDraft));
  it("keeps the empty draft for an empty object", () => expect(normalizeDraft({})).toEqual(emptyDraft));
  it("merges top-level fields over the empty draft", () =>
    expect(normalizeDraft({ currentStep: 2, lastSavedAt: "2026-01-01T00:00:00.000Z" })).toMatchObject({ currentStep: 2, lastSavedAt: "2026-01-01T00:00:00.000Z" }));
  it("merges partial sections over the empty defaults", () => {
    const result = normalizeDraft({ applicant: { ...emptyDraft.applicant, fullName: "Ashan Perera" }, declaration: { confirmed: true, consent: false } });
    expect(result.applicant.fullName).toBe("Ashan Perera");
    expect(result.applicant.gender).toBe("");
    expect(result.declaration.confirmed).toBe(true);
    expect(result.declaration.consent).toBe(false);
    expect(result.guardian).toEqual(emptyDraft.guardian);
  });
  it("does not mutate the input", () => {
    const input = { applicant: { ...emptyDraft.applicant, fullName: "Ashan Perera" } };
    normalizeDraft(input);
    expect(input).toEqual({ applicant: { ...emptyDraft.applicant, fullName: "Ashan Perera" } });
  });
  it("defaults categories to an empty array when missing", () => expect(normalizeDraft({}).categories).toEqual([]));
  it("resets categories to an empty array for non-array input", () =>
    expect(normalizeDraft({ categories: "nope" as unknown as CategoryApplication[] }).categories).toEqual([]));
  it("drops junk entries and invalid category types", () => {
    const result = normalizeDraft({
      categories: [null, 42, "junk", { categoryType: "6.9" },         { id: "kept-1", categoryType: "6.5", scoringInputs: { serviceStartDate: "2023-09-01" } }] as unknown as CategoryApplication[],
    });
    expect(result.categories.map((category) => category.id)).toEqual(["kept-1"]);
    expect(result.categories[0]?.scoringInputs).toEqual({ serviceStartDate: "2023-09-01" });
  });
  it("synthesizes ids for entries with missing ids and defaults scoringInputs to an object", () => {
    const result = normalizeDraft({
      categories: [{ categoryType: "6.1" }, { id: "", categoryType: "6.4" }, { id: "kept-1", categoryType: "6.6" }] as unknown as CategoryApplication[],
    });
    expect(result.categories.map((category) => category.id)).toEqual(["6.1-0", "6.4-1", "kept-1"]);
    expect(result.categories.map((category) => category.categoryType)).toEqual(["6.1", "6.4", "6.6"]);
    expect(result.categories[1]?.scoringInputs).toEqual({});
  });
  it("replaces duplicate category ids with synthesized ones", () => {
    const result = normalizeDraft({
      categories: [
        { id: "same", categoryType: "6.1" },
        { id: "same", categoryType: "6.4" },
        { id: "same", categoryType: "6.4" },
      ] as unknown as CategoryApplication[],
    });
    expect(result.categories[0]?.id).toBe("same");
    expect(new Set(result.categories.map((category) => category.id)).size).toBe(3);
  });
});

describe("prependLocationHistory", () => {
  it("prepends onto an empty list", () => {
    const list = prependLocationHistory([], point(6.03, 80.21));
    expect(list).toHaveLength(1);
    expect(list[0]?.latitude).toBe(6.03);
  });

  it("places the newest entry at the top", () => {
    let list = prependLocationHistory([], point(1, 1));
    list = prependLocationHistory(list, point(2, 2));
    list = prependLocationHistory(list, point(3, 3));
    expect(list.map((entry) => entry.latitude)).toEqual([3, 2, 1]);
  });

  it("does not duplicate when the head has identical coordinates", () => {
    const original = [point(6.03, 80.21)];
    const list = prependLocationHistory(original, point(6.03, 80.21));
    expect(list).toBe(original);
    expect(list).toHaveLength(1);
  });

  it("records revisits to older coordinates as new entries", () => {
    let list = prependLocationHistory([], point(1, 1));
    list = prependLocationHistory(list, point(2, 2));
    list = prependLocationHistory(list, point(1, 1));
    expect(list).toHaveLength(3);
    expect(list[0]?.latitude).toBe(1);
  });

  it("caps the list at the history limit with newest retained", () => {
    let list: LocationDraft[] = [];
    for (let index = 0; index < LOCATION_HISTORY_LIMIT + 10; index += 1) {
      list = prependLocationHistory(list, point(index, index));
    }
    expect(list).toHaveLength(LOCATION_HISTORY_LIMIT);
    expect(list[0]?.latitude).toBe(LOCATION_HISTORY_LIMIT + 9);
    expect(list.at(-1)?.latitude).toBe(10);
  });

  it("does not mutate the input list", () => {
    const original = [point(1, 1)];
    prependLocationHistory(original, point(2, 2));
    expect(original).toHaveLength(1);
  });
});

describe("applyLocationChange", () => {
  const baseDraft: Pick<ApplicationDraft, "deviceLocationHistory" | "userLocationHistory" | "defaultLocations"> = {
    deviceLocationHistory: [],
    userLocationHistory: [],
    defaultLocations: [],
  };

  it("records a device fix into the device history and defaultLocations when defaultValue is present", () => {
    const fix = point(6.05, 80.22, { source: "device", label: "Your location" });
    const result = applyLocationChange(baseDraft, fix, fix);
    expect(result.deviceLocationHistory).toHaveLength(1);
    expect(result.deviceLocationHistory[0]).toMatchObject({ latitude: 6.05, source: "device" });
    expect(result.defaultLocations).toHaveLength(1);
    expect(result.defaultLocations[0]).toMatchObject({ latitude: 6.05, source: "device" });
  });

  it("does not touch device history or defaultLocations without a defaultValue (map/manual selection)", () => {
    const result = applyLocationChange(baseDraft, point(6.03, 80.21));
    expect(result.deviceLocationHistory).toEqual([]);
    expect(result.defaultLocations).toEqual([]);
  });

  it("records any coordinate-bearing selection into the user history", () => {
    const result = applyLocationChange(baseDraft, point(6.03, 80.21), undefined);
    expect(result.userLocationHistory).toHaveLength(1);
  });

  it("ignores coordinate-less edits such as address typing", () => {
    const value = { ...emptyDraft.location, address: "typed text", source: "manual" } as LocationDraft;
    const result = applyLocationChange(baseDraft, value);
    expect(result.userLocationHistory).toEqual([]);
    expect(result.deviceLocationHistory).toEqual([]);
  });

  it("records a deliberate device-button fix only in the user history", () => {
    const fix = point(7.0, 81.0, { source: "device" });
    const result = applyLocationChange(baseDraft, fix, undefined);
    expect(result.userLocationHistory).toHaveLength(1);
    expect(result.userLocationHistory[0]?.source).toBe("device");
    expect(result.deviceLocationHistory).toEqual([]);
  });

  it("deduplicates repeated identical selections", () => {
    let draft = baseDraft;
    for (let index = 0; index < 3; index += 1) {
      draft = applyLocationChange(draft, point(6.03, 80.21));
    }
    expect(draft.userLocationHistory).toHaveLength(1);
  });

  it("orders mixed updates newest first within each independent array", () => {
    const deviceFix = point(1, 1, { source: "device", label: "Your location" });
    const mapPickOne = point(2, 2);
    const deviceButton = point(3, 3, { source: "device" });
    const mapPickTwo = point(4, 4);
    let draft = baseDraft;
    draft = applyLocationChange(draft, deviceFix, deviceFix);
    draft = applyLocationChange(draft, mapPickOne);
    draft = applyLocationChange(draft, deviceButton);
    draft = applyLocationChange(draft, mapPickTwo);
    expect(draft.deviceLocationHistory.map((entry) => entry.latitude)).toEqual([1]);
    expect(draft.userLocationHistory.map((entry) => entry.latitude)).toEqual([4, 3, 2, 1]);
    expect(draft.defaultLocations.map((entry) => entry.latitude)).toEqual([1]);
  });

  it("never exceeds the history limit across many changes", () => {
    let draft = baseDraft;
    for (let index = 0; index < LOCATION_HISTORY_LIMIT + 5; index += 1) {
      draft = applyLocationChange(draft, point(index, -index));
    }
    expect(draft.userLocationHistory).toHaveLength(LOCATION_HISTORY_LIMIT);
  });
});

describe("location history normalization", () => {
  it("defaults both histories to empty arrays", () => {
    const result = normalizeDraft({});
    expect(result.deviceLocationHistory).toEqual([]);
    expect(result.userLocationHistory).toEqual([]);
  });

  it("drops entries without numeric coordinates", () => {
    const result = normalizeDraft({
      userLocationHistory: [
        null,
        { label: "no coords" },
        { latitude: "x", longitude: 5 },
        point(6.03, 80.21),
      ] as unknown as LocationDraft[],
    });
    expect(result.userLocationHistory).toHaveLength(1);
    expect(result.userLocationHistory[0]?.latitude).toBe(6.03);
  });

  it("coerces invalid sources to map and fills missing strings", () => {
    const result = normalizeDraft({
      userLocationHistory: [{ latitude: 1.5, longitude: 2.5, source: "hacked", label: 42 }] as unknown as LocationDraft[],
    });
    expect(result.userLocationHistory[0]?.source).toBe("map");
    expect(result.userLocationHistory[0]?.label).toBe("");
    expect(result.userLocationHistory[0]?.address).toBe("");
  });

  it("caps restored histories at the limit preserving order", () => {
    const flood = Array.from({ length: LOCATION_HISTORY_LIMIT + 8 }, (_, index) => point(index, index));
    const result = normalizeDraft({ deviceLocationHistory: flood });
    expect(result.deviceLocationHistory).toHaveLength(LOCATION_HISTORY_LIMIT);
    expect(result.deviceLocationHistory[0]?.latitude).toBe(0);
  });

  it("survives round-tripping through JSON persistence", () => {
    const drafted: Partial<ApplicationDraft> = normalizeDraft({
      deviceLocationHistory: [point(1, 1)],
      userLocationHistory: [point(2, 2), point(3, 3)],
    });
    const restored = normalizeDraft(JSON.parse(JSON.stringify(drafted)));
    expect(restored.deviceLocationHistory).toEqual(drafted.deviceLocationHistory);
    expect(restored.userLocationHistory).toEqual(drafted.userLocationHistory);
  });
});

describe("useApplicationStore actions", () => {
  beforeEach(() => useApplicationStore.getState().reset());

  it("starts from the empty draft", () => {
    const state = useApplicationStore.getState();
    expect(state.currentStep).toBe(0);
    expect(state.declaration).toEqual({ confirmed: false, consent: false });
    expect(state.lastSavedAt).toBeNull();
  });

  it("updateDraft merges the patch and stamps lastSavedAt", () => {
    useApplicationStore.getState().updateDraft({ applicant: { ...emptyDraft.applicant, fullName: "Ashan Perera" } });
    const state = useApplicationStore.getState();
    expect(state.applicant.fullName).toBe("Ashan Perera");
    expect(state.applicant.gender).toBe("");
    expect(state.lastSavedAt).not.toBeNull();
  });

  it("setStep changes the current step and leaves the rest untouched", () => {
    useApplicationStore.getState().setStep(3);
    const state = useApplicationStore.getState();
    expect(state.currentStep).toBe(3);
    expect(state.applicant).toEqual(emptyDraft.applicant);
  });

  it("reset restores the empty draft", () => {
    useApplicationStore.getState().updateDraft({ currentStep: 4, applicant: { ...emptyDraft.applicant, fullName: "Ashan Perera" } });
    useApplicationStore.getState().reset();
    expect(useApplicationStore.getState()).toMatchObject(emptyDraft);
  });
});

describe("useApplicationStore category actions", () => {
  beforeEach(() => useApplicationStore.getState().reset());

  it("addCategory appends categories with unique ids and empty inputs", () => {
    useApplicationStore.getState().addCategory("6.1");
    useApplicationStore.getState().addCategory("6.1");
    const { categories } = useApplicationStore.getState();
    expect(categories.map((category) => category.categoryType)).toEqual(["6.1", "6.1"]);
    expect(new Set(categories.map((category) => category.id)).size).toBe(2);
    for (const category of categories) expect(category.scoringInputs).toEqual({});
  });

  it("removeCategory removes only the matching category", () => {
    useApplicationStore.getState().addCategory("6.1");
    useApplicationStore.getState().addCategory("6.4");
    const targetId = useApplicationStore.getState().categories.find((category) => category.categoryType === "6.1")?.id ?? "";
    useApplicationStore.getState().removeCategory(targetId);
    const { categories } = useApplicationStore.getState();
    expect(categories.map((category) => category.categoryType)).toEqual(["6.4"]);
    expect(categories.some((category) => category.id === targetId)).toBe(false);
  });

  it("updateCategoryInputs patches only the target category", () => {
    useApplicationStore.getState().addCategory("6.1");
    useApplicationStore.getState().addCategory("6.4");
    const targetId = useApplicationStore.getState().categories.find((category) => category.categoryType === "6.4")?.id ?? "";
    useApplicationStore.getState().updateCategoryInputs(targetId, { serviceStartDate: "2014-09-01", difficultServiceType: "current" });
    const categories = useApplicationStore.getState().categories;
    expect(categories.find((category) => category.id === targetId)?.scoringInputs).toEqual({ serviceStartDate: "2014-09-01", difficultServiceType: "current" });
    const other = categories.find((category) => category.id !== targetId);
    expect(other?.scoringInputs).toEqual({});
  });
});
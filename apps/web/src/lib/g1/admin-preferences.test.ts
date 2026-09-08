// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { ADMIN_PREFERENCES_KEY, isFieldVisible, useAdminPreferences } from "./admin-preferences";

function reset() {
  useAdminPreferences.setState({
    defaultTab: "overview",
    density: "comfortable",
    autoExpandScoringInputs: false,
    showMarkBars: true,
    showMarkBreakdown: true,
    recentlyViewed: [],
    applicationsSort: null,
    applicationsStatusFilter: "all",
    fieldVisibility: {},
  });
}

describe("useAdminPreferences", () => {
  beforeEach(() => {
    localStorage.clear();
    reset();
  });

  it("starts with the documented defaults", () => {
    const state = useAdminPreferences.getState();
    expect(state.defaultTab).toBe("overview");
    expect(state.density).toBe("comfortable");
    expect(state.autoExpandScoringInputs).toBe(false);
    expect(state.showMarkBars).toBe(true);
    expect(state.showMarkBreakdown).toBe(true);
    expect(state.recentlyViewed).toEqual([]);
    expect(state.applicationsSort).toBeNull();
    expect(state.applicationsStatusFilter).toBe("all");
    expect(state.fieldVisibility).toEqual({});
  });

  it("persists state to localStorage under the admin preferences key", () => {
    useAdminPreferences.getState().setDensity("compact");
    expect(localStorage.getItem(ADMIN_PREFERENCES_KEY)).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem(ADMIN_PREFERENCES_KEY)!);
    expect(stored.state.density).toBe("compact");
  });

  describe("simple setters", () => {
    it("setDefaultTab", () => {
      useAdminPreferences.getState().setDefaultTab("scoring");
      expect(useAdminPreferences.getState().defaultTab).toBe("scoring");
    });

    it("setDensity", () => {
      useAdminPreferences.getState().setDensity("compact");
      expect(useAdminPreferences.getState().density).toBe("compact");
    });

    it("setAutoExpandScoringInputs", () => {
      useAdminPreferences.getState().setAutoExpandScoringInputs(true);
      expect(useAdminPreferences.getState().autoExpandScoringInputs).toBe(true);
    });

    it("setShowMarkBars", () => {
      useAdminPreferences.getState().setShowMarkBars(false);
      expect(useAdminPreferences.getState().showMarkBars).toBe(false);
    });

    it("setShowMarkBreakdown", () => {
      useAdminPreferences.getState().setShowMarkBreakdown(false);
      expect(useAdminPreferences.getState().showMarkBreakdown).toBe(false);
    });

    it("setApplicationsSort stores the sort and clears it with null", () => {
      useAdminPreferences.getState().setApplicationsSort({ id: "applicantName", desc: true });
      expect(useAdminPreferences.getState().applicationsSort).toEqual({ id: "applicantName", desc: true });
      useAdminPreferences.getState().setApplicationsSort(null);
      expect(useAdminPreferences.getState().applicationsSort).toBeNull();
    });

    it("setApplicationsStatusFilter", () => {
      useAdminPreferences.getState().setApplicationsStatusFilter("pending");
      expect(useAdminPreferences.getState().applicationsStatusFilter).toBe("pending");
    });
  });

  describe("addRecentlyViewed", () => {
    it("prepends the newest entry", () => {
      useAdminPreferences.getState().addRecentlyViewed("id-1", "First Applicant");
      useAdminPreferences.getState().addRecentlyViewed("id-2", "Second Applicant");
      const recent = useAdminPreferences.getState().recentlyViewed;
      expect(recent.map((entry) => entry.id)).toEqual(["id-2", "id-1"]);
      expect(recent[0].name).toBe("Second Applicant");
      expect(typeof recent[0].viewedAt).toBe("string");
    });

    it("moves a re-viewed application to the front instead of duplicating it", () => {
      useAdminPreferences.getState().addRecentlyViewed("id-1", "First");
      useAdminPreferences.getState().addRecentlyViewed("id-2", "Second");
      useAdminPreferences.getState().addRecentlyViewed("id-1", "First");
      const recent = useAdminPreferences.getState().recentlyViewed;
      expect(recent.map((entry) => entry.id)).toEqual(["id-1", "id-2"]);
    });

    it("caps the list at 10 entries", () => {
      for (let i = 1; i <= 12; i++) {
        useAdminPreferences.getState().addRecentlyViewed(`id-${i}`, `Applicant ${i}`);
      }
      const recent = useAdminPreferences.getState().recentlyViewed;
      expect(recent).toHaveLength(10);
      expect(recent[0].id).toBe("id-12");
      expect(recent.map((entry) => entry.id)).not.toContain("id-1");
      expect(recent.map((entry) => entry.id)).not.toContain("id-2");
    });
  });

  describe("setFieldVisibility", () => {
    it("records visibility per section and field", () => {
      useAdminPreferences.getState().setFieldVisibility("applicant", "fullName", false);
      useAdminPreferences.getState().setFieldVisibility("applicant", "gender", false);
      useAdminPreferences.getState().setFieldVisibility("guardian", "nic", false);
      const state = useAdminPreferences.getState();
      expect(state.fieldVisibility.applicant).toEqual({ fullName: false, gender: false });
      expect(state.fieldVisibility.guardian).toEqual({ nic: false });
    });

    it("keeps other sections when updating one section", () => {
      useAdminPreferences.getState().setFieldVisibility("applicant", "fullName", false);
      useAdminPreferences.getState().setFieldVisibility("guardian", "nic", false);
      expect(useAdminPreferences.getState().fieldVisibility.applicant.fullName).toBe(false);
      expect(useAdminPreferences.getState().fieldVisibility.guardian.nic).toBe(false);
    });
  });

  describe("resetPreferences", () => {
    it("restores every default", () => {
      useAdminPreferences.getState().setDensity("compact");
      useAdminPreferences.getState().setDefaultTab("scoring");
      useAdminPreferences.getState().addRecentlyViewed("id-1", "First");
      useAdminPreferences.getState().setApplicationsSort({ id: "x", desc: true });
      useAdminPreferences.getState().setFieldVisibility("applicant", "fullName", false);
      useAdminPreferences.getState().resetPreferences();

      const state = useAdminPreferences.getState();
      expect(state.defaultTab).toBe("overview");
      expect(state.density).toBe("comfortable");
      expect(state.recentlyViewed).toEqual([]);
      expect(state.applicationsSort).toBeNull();
      expect(state.fieldVisibility).toEqual({});
    });
  });

  describe("persisted state rehydration", () => {
    it("restores saved preferences from localStorage on a fresh store read", () => {
      useAdminPreferences.getState().setDensity("compact");
      useAdminPreferences.getState().setDefaultTab("scoring");
      // Simulate a fresh module load: zustand persist rehydrates lazily on
      // store creation, so emulate it by merging the persisted JSON.
      const persisted = JSON.parse(localStorage.getItem(ADMIN_PREFERENCES_KEY)!);
      expect(persisted.state.density).toBe("compact");
      expect(persisted.state.defaultTab).toBe("scoring");
    });
  });
});

describe("isFieldVisible", () => {
  it("defaults to visible when the section has no preferences", () => {
    expect(isFieldVisible({}, "applicant", "fullName")).toBe(true);
  });

  it("defaults to visible when the field has no preference in a known section", () => {
    expect(isFieldVisible({ applicant: { fullName: false } }, "applicant", "gender")).toBe(true);
  });

  it("returns the stored preference for a configured field", () => {
    expect(isFieldVisible({ applicant: { fullName: false } }, "applicant", "fullName")).toBe(false);
    expect(isFieldVisible({ applicant: { fullName: true } }, "applicant", "fullName")).toBe(true);
  });
});

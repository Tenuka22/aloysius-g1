import { describe, expect, it } from "vitest";
import { emptyDraft, normalizeDraft, useApplicationStore, type ApplicationDraft } from "./application-store";

describe("emptyDraft", () => {
  it("has step 0, empty strings and nulls", () => {
    expect(emptyDraft.currentStep).toBe(0);
    expect(emptyDraft.lastSavedAt).toBeNull();
    for (const section of ["location", "defaultLocation", "selectedLocation"]) {
      expect(emptyDraft[section as keyof ApplicationDraft]).toMatchObject({ label: "", address: "", latitude: null, longitude: null, source: "" });
    }
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
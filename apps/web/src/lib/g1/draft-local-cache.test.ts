// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyDraft } from "./application-store";
import { clearDraftLocally, loadUnsyncedDraft, saveDraftLocally } from "./draft-local-cache";

beforeEach(() => {
  window.localStorage.clear();
});

describe("saveDraftLocally / loadUnsyncedDraft", () => {
  it("round-trips a draft under its access key", () => {
    const draft = { ...emptyDraft, applicant: { ...emptyDraft.applicant, fullName: "Ashan Perera" } };
    saveDraftLocally("ALY-key-1", draft);
    expect(loadUnsyncedDraft("ALY-key-1")).toMatchObject({ applicant: { fullName: "Ashan Perera" } });
  });

  it("keeps separate entries per access key", () => {
    saveDraftLocally("ALY-key-1", { ...emptyDraft, currentStep: 1 });
    saveDraftLocally("ALY-key-2", { ...emptyDraft, currentStep: 3 });
    expect(loadUnsyncedDraft("ALY-key-1")).toMatchObject({ currentStep: 1 });
    expect(loadUnsyncedDraft("ALY-key-2")).toMatchObject({ currentStep: 3 });
  });

  it("returns null when nothing was ever saved for that key", () => {
    expect(loadUnsyncedDraft("ALY-never-saved")).toBeNull();
  });

  it("returns null for an empty access key", () => {
    expect(loadUnsyncedDraft("")).toBeNull();
  });

  it("overwrites the previous entry for the same key on repeated saves", () => {
    saveDraftLocally("ALY-key-1", { ...emptyDraft, currentStep: 1 });
    saveDraftLocally("ALY-key-1", { ...emptyDraft, currentStep: 5 });
    expect(loadUnsyncedDraft("ALY-key-1")).toMatchObject({ currentStep: 5 });
  });

  it("is a no-op when writing under an empty access key", () => {
    saveDraftLocally("", { ...emptyDraft, currentStep: 4 });
    expect(window.localStorage.length).toBe(0);
  });

  it("does not throw when localStorage.setItem throws", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => saveDraftLocally("ALY-key-1", emptyDraft)).not.toThrow();
    spy.mockRestore();
  });

  it("returns null when the stored entry is corrupt JSON", () => {
    window.localStorage.setItem("aloysius-admissions-g1-draft:ALY-key-1", "{not json");
    expect(loadUnsyncedDraft("ALY-key-1")).toBeNull();
  });
});

describe("clearDraftLocally", () => {
  it("removes a previously saved entry so it no longer recovers", () => {
    saveDraftLocally("ALY-key-1", emptyDraft);
    clearDraftLocally("ALY-key-1");
    expect(loadUnsyncedDraft("ALY-key-1")).toBeNull();
  });

  it("is a no-op when nothing was saved for that key", () => {
    expect(() => clearDraftLocally("ALY-never-saved")).not.toThrow();
  });

  it("leaves other keys' entries untouched", () => {
    saveDraftLocally("ALY-key-1", { ...emptyDraft, currentStep: 1 });
    saveDraftLocally("ALY-key-2", { ...emptyDraft, currentStep: 2 });
    clearDraftLocally("ALY-key-1");
    expect(loadUnsyncedDraft("ALY-key-1")).toBeNull();
    expect(loadUnsyncedDraft("ALY-key-2")).toMatchObject({ currentStep: 2 });
  });
});

// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { emptyDraft, normalizeDraft } from "@/lib/g1/application-store";
import { describe, expect, it } from "vitest";

/**
 * Regression guards for three crashes reachable from server-supplied draft data.
 *
 * The draft is not persisted client-side, so every one of these values arrives
 * from `application.get`. `normalizeDraft` is the single choke point that the
 * whole form trusts, and before these guards a malformed payload took the
 * applicant to a blank white page with no error boundary to catch it.
 */
describe("normalizeDraft coercion", () => {
  it("coerces a non-string birth certificate number so .trim() cannot throw", () => {
    const draft = normalizeDraft({
      ...emptyDraft,
      applicant: { ...emptyDraft.applicant, birthCertificateNumber: null as unknown as string },
    });

    expect(draft.applicant.birthCertificateNumber).toBe("");
    // The form calls .trim() on this in three places; prove it is now safe.
    expect(() => draft.applicant.birthCertificateNumber.trim()).not.toThrow();
  });

  it("coerces non-string applicant names rather than passing numbers through", () => {
    const draft = normalizeDraft({
      ...emptyDraft,
      applicant: {
        ...emptyDraft.applicant,
        fullName: 12345 as unknown as string,
        sinhalaName: undefined as unknown as string,
      },
    });

    expect(draft.applicant.fullName).toBe("");
    expect(draft.applicant.sinhalaName).toBe("");
  });

  it("clamps an out-of-range currentStep instead of yielding NaN progress", () => {
    expect(normalizeDraft({ ...emptyDraft, currentStep: 99 }).currentStep).toBeLessThanOrEqual(6);
    expect(normalizeDraft({ ...emptyDraft, currentStep: -3 }).currentStep).toBeGreaterThanOrEqual(
      0,
    );
  });

  it("keeps a valid draft untouched", () => {
    const draft = normalizeDraft({
      ...emptyDraft,
      currentStep: 2,
      applicant: {
        ...emptyDraft.applicant,
        fullName: "Nadhila",
        birthCertificateNumber: "BC/1234",
      },
    });

    expect(draft.currentStep).toBe(2);
    expect(draft.applicant.fullName).toBe("Nadhila");
    expect(draft.applicant.birthCertificateNumber).toBe("BC/1234");
  });
});

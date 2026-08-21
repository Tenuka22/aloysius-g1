import { describe, expect, it, test } from "vitest";
import { completionPercent } from "./completion";
import { emptyDraft } from "./application-store";

type Draft = typeof emptyDraft;

function withSection(draft: Draft, section: keyof Draft, completed: boolean): Draft {
  const next = JSON.parse(JSON.stringify(draft)) as Draft;
  switch (section) {
    case "location":
      if (completed) next.location = { ...next.location, address: "Temple Rd", latitude: 7.29, longitude: 80.63 };
      break;
    case "applicant":
      if (completed) next.applicant = { fullName: "Ashan", sinhalaName: "", gender: "Male", religion: "Buddhist", educationMedium: "Sinhala", dateOfBirth: "2021-01-01", birthCertificateNumber: "ABC123" };
      break;
    case "guardian":
      if (completed) next.guardian = { relationship: "Mother", fullName: "Mala", nic: "901234567V", phone: "+94712345678", whatsappPhone: "", email: "mala@x.com" };
      break;
    case "residence":
      if (completed) next.residence = { permanentAddress: "12 Rd", currentAddress: "", sameAsPermanent: false, district: "Gampaha", dsDivision: "Gampaha", gnDivision: "Wewaldeniya", electoralDistrict: "Gampaha" };
      break;
    case "declaration":
      if (completed) next.declaration = { confirmed: true, consent: true };
      break;
    default:
      throw new Error(`Unexpected section ${section as string}`);
  }
  return next;
}

describe("completionPercent", () => {
  const sections = ["location", "applicant", "guardian", "residence", "declaration"] as const;

  it("returns 0 for null, undefined and empty drafts", () => {
    expect(completionPercent(null)).toBe(0);
    expect(completionPercent(undefined)).toBe(0);
    expect(completionPercent(emptyDraft)).toBe(0);
  });

  it("counts each completed section as one fifth (all 32 combinations)", () => {
    for (let count = 0; count <= 5; count += 1) {
      for (const combo of combinations(sections, count)) {
        let draft = JSON.parse(JSON.stringify(emptyDraft)) as Draft;
        for (const section of sections) {
          if (combo.has(section)) draft = withSection(draft, section, true);
        }
        expect(completionPercent(draft)).toBe(Math.round((count / 5) * 100));
      }
    }
  });

  it("treats a location with address but no coordinates as complete", () => {
    const draft = withSection(emptyDraft, "location", true);
    draft.location = { ...draft.location, latitude: null, longitude: null };
    expect(completionPercent(draft)).toBe(20);
  });

  it("treats a location with coordinates but no address as complete", () => {
    const draft = JSON.parse(JSON.stringify(emptyDraft)) as Draft;
    draft.location = { ...draft.location, latitude: 7.29, longitude: 80.63 };
    expect(completionPercent(draft)).toBe(20);
  });

  test("a single missing field within a section drops the whole section", () => {
    const draft = withSection(emptyDraft, "guardian", true);
    draft.guardian.email = "";
    expect(completionPercent(draft)).toBe(0);
  });

  it("reports 100% for a fully completed draft", () => {
    let draft = JSON.parse(JSON.stringify(emptyDraft)) as Draft;
    for (const section of sections) draft = withSection(draft, section, true);
    expect(completionPercent(draft)).toBe(100);
  });
});

function combinations(items: readonly string[], size: number): Set<string>[] {
  const results: Set<string>[] = [];
  const pick = (start: number, chosen: string[]) => {
    if (chosen.length === size) {
      results.push(new Set(chosen));
      return;
    }
    for (let i = start; i < items.length; i += 1) pick(i + 1, [...chosen, items[i]]);
  };
  pick(0, []);
  return results;
}
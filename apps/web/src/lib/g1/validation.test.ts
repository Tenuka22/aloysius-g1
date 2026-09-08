import { describe, expect, it } from "vitest";
import {
  applicantStepSchema,
  categoryApplicationSchema,
  categoryStepSchema,
  categoriesSchema,
  declarationStepSchema,
  guardianStepSchema,
  residenceStepSchema,
  scoringInputsSchema,
} from "./validation";
import { G1_DOB_EARLIEST, G1_DOB_LATEST, nicRegex } from "./eligibility";

describe("nicRegex shared with the decision tree", () => {
  it.each([
    ["199912345678", true],
    ["912345678V", true],
    ["912345678X", true],
    ["912345678v", false],
    ["912345678", false],
    ["912345678W", false],
    ["12345", false],
    ["", false],
  ])("%s -> %s", (nic, expected) => expect(nicRegex.test(nic)).toBe(expected));
});

const validApplicant = {
  fullName: "Ashan Perera",
  sinhalaName: "අෂාන් පෙරේරා",
  gender: "Male",
  religion: "Buddhist",
  educationMedium: "Sinhala",
  dateOfBirth: G1_DOB_LATEST(),
  birthCertificateNumber: "1234567890",
};

describe("applicantStepSchema", () => {
  it("accepts a complete valid applicant", () =>
    expect(applicantStepSchema.safeParse(validApplicant).success).toBe(true));
  it("accepts both genders", () => {
    expect(applicantStepSchema.safeParse({ ...validApplicant, gender: "Female" }).success).toBe(true);
    expect(applicantStepSchema.safeParse({ ...validApplicant, gender: "Male" }).success).toBe(true);
  });
  it("accepts all religions", () => {
    for (const religion of ["Catholic", "Christian", "Buddhist", "Islam"]) {
      expect(applicantStepSchema.safeParse({ ...validApplicant, religion }).success).toBe(true);
    }
  });
  it("rejects a gender outside the enum", () =>
    expect(applicantStepSchema.safeParse({ ...validApplicant, gender: "Other" }).success).toBe(false));
  it("rejects a religion outside the enum", () =>
    expect(applicantStepSchema.safeParse({ ...validApplicant, religion: "Hindu" }).success).toBe(false));
  it("rejects English as education medium", () =>
    expect(applicantStepSchema.safeParse({ ...validApplicant, educationMedium: "English" }).success).toBe(false));
  it("rejects a missing education medium", () =>
    expect(applicantStepSchema.safeParse({ ...validApplicant, educationMedium: "" }).success).toBe(false));
  it("accepts DOB exactly on the latest boundary", () =>
    expect(applicantStepSchema.safeParse({ ...validApplicant, dateOfBirth: G1_DOB_LATEST() }).success).toBe(true));
  it("accepts DOB exactly on the earliest boundary", () =>
    expect(applicantStepSchema.safeParse({ ...validApplicant, dateOfBirth: G1_DOB_EARLIEST() }).success).toBe(true));
  it("rejects DOB after the latest boundary (not yet five)", () => {
    const [year] = G1_DOB_LATEST().split("-");
    expect(applicantStepSchema.safeParse({ ...validApplicant, dateOfBirth: `${year}-02-01` }).success).toBe(false);
  });
  it("rejects DOB before the earliest boundary (already six)", () => {
    const [year] = G1_DOB_EARLIEST().split("-");
    expect(applicantStepSchema.safeParse({ ...validApplicant, dateOfBirth: `${year}-01-31` }).success).toBe(false);
  });
  it("rejects an empty DOB", () =>
    expect(applicantStepSchema.safeParse({ ...validApplicant, dateOfBirth: "" }).success).toBe(false));
  it("rejects a missing full name", () =>
    expect(applicantStepSchema.safeParse({ ...validApplicant, fullName: "" }).success).toBe(false));
  it("rejects a missing birth certificate number", () =>
    expect(applicantStepSchema.safeParse({ ...validApplicant, birthCertificateNumber: "" }).success).toBe(false));
  it("allows sinhalaName to be omitted", () => {
    const { sinhalaName: _omitted, ...withoutSinhalaName } = validApplicant;
    expect(applicantStepSchema.safeParse(withoutSinhalaName).success).toBe(true);
  });
});

describe("guardianStepSchema", () => {
  const base = { relationship: "Mother", fullName: "Mala Perera", nic: "199012345678", phone: "+94712345678", email: "mala@example.com" };
  it("accepts every relationship", () => {
    for (const relationship of ["Mother", "Father", "Guardian"]) {
      expect(guardianStepSchema.safeParse({ ...base, relationship }).success).toBe(true);
    }
  });
  it("rejects a relationship outside the enum", () =>
    expect(guardianStepSchema.safeParse({ ...base, relationship: "Aunt" }).success).toBe(false));
  it("accepts a 12-digit NIC", () => expect(guardianStepSchema.safeParse({ ...base, nic: "199012345678" }).success).toBe(true));
  it("accepts a 9-digit V NIC", () => expect(guardianStepSchema.safeParse({ ...base, nic: "901234567V" }).success).toBe(true));
  it("rejects an omitted NIC (now required)", () => {
    const { nic: _omitted, ...withoutNic } = base;
    expect(guardianStepSchema.safeParse(withoutNic).success).toBe(false);
  });
  it("rejects an invalid NIC", () => expect(guardianStepSchema.safeParse({ ...base, nic: "12345" }).success).toBe(false));
  it("rejects a lowercase v NIC (schema is case-sensitive)", () =>
    expect(guardianStepSchema.safeParse({ ...base, nic: "901234567v" }).success).toBe(false));
  it("rejects a missing phone", () => expect(guardianStepSchema.safeParse({ ...base, phone: "" }).success).toBe(false));
  it("rejects an invalid email", () => expect(guardianStepSchema.safeParse({ ...base, email: "nope" }).success).toBe(false));
  it("accepts an omitted email", () => {
    const { email: _omitted, ...withoutEmail } = base;
    expect(guardianStepSchema.safeParse(withoutEmail).success).toBe(true);
  });
});

describe("residenceStepSchema", () => {
  const base = { permanentAddress: "12 Temple Rd", currentAddress: "12 Temple Rd", district: "Gampaha", dsDivision: "Gampaha", gnDivision: "Wewaldeniya", electoralDistrict: "Gampaha" };
  it("accepts a complete residence", () => expect(residenceStepSchema.safeParse(base).success).toBe(true));
  it("accepts currentAddress and sameAsPermanent", () =>
    expect(residenceStepSchema.safeParse({ ...base, currentAddress: "12 Temple Rd", sameAsPermanent: true }).success).toBe(true));
  it.each([
    ["permanentAddress", "permanentAddress", ""],
    ["currentAddress", "currentAddress", ""],
    ["district", "district", ""],
    ["dsDivision", "dsDivision", ""],
    ["gnDivision", "gnDivision", ""],
    ["electoralDistrict", "electoralDistrict", ""],
  ])("rejects a missing %s", (_label, key, value) =>
    expect(residenceStepSchema.safeParse({ ...base, [key]: value }).success).toBe(false));
});

describe("declarationStepSchema", () => {
  it("requires both confirmed and consent", () => {
    for (const declaration of [
      { confirmed: false, consent: false },
      { confirmed: true, consent: false },
      { confirmed: false, consent: true },
    ]) {
      expect(declarationStepSchema.safeParse(declaration).success).toBe(false);
    }
  });
  it("accepts both true", () => expect(declarationStepSchema.safeParse({ confirmed: true, consent: true }).success).toBe(true));
});

const validCategory = {
  id: "category-1",
  categoryType: "6.1",
  scoringInputs: { mainDocumentType: "title-deed", deedTransferDate: "2021-09-01", additionalDocs: ["nic"] },
};

describe("scoringInputsSchema", () => {
  it("accepts an empty object", () => expect(scoringInputsSchema.safeParse({}).success).toBe(true));
  it("coerces numeric fields from strings", () =>
    expect(scoringInputsSchema.parse({ electoralMotherSince: "2020", schoolsRadiusKm: "1.5" })).toEqual({ electoralMotherSince: 2020, schoolsRadiusKm: 1.5 }));
  it("accepts every difficult service type", () => {
    for (const difficultServiceType of ["current", "previous", "none"]) {
      expect(scoringInputsSchema.safeParse({ difficultServiceType }).success).toBe(true);
    }
  });
  it("rejects a difficult service type outside the enum", () =>
    expect(scoringInputsSchema.safeParse({ difficultServiceType: "future" }).success).toBe(false));
  it("rejects an employment purpose outside the enum", () =>
    expect(scoringInputsSchema.safeParse({ employmentPurpose: "charity" }).success).toBe(false));
  it("rejects a non-positive schools radius", () =>
    expect(scoringInputsSchema.safeParse({ schoolsRadiusKm: 0 }).success).toBe(false));
  it("rejects a non-numeric schools radius", () =>
    expect(scoringInputsSchema.safeParse({ schoolsRadiusKm: "nearby" }).success).toBe(false));
  it("rejects non-string additional docs entries", () =>
    expect(scoringInputsSchema.safeParse({ additionalDocs: [1] }).success).toBe(false));
});

describe("categoryApplicationSchema", () => {
  it("accepts a valid category", () => expect(categoryApplicationSchema.safeParse(validCategory).success).toBe(true));
  it("accepts every category type", () => {
    for (const categoryType of ["6.1", "6.4", "6.5", "6.6"]) {
      expect(categoryApplicationSchema.safeParse({ ...validCategory, categoryType }).success).toBe(true);
    }
  });
  it("rejects an unsupported category type", () =>
    expect(categoryApplicationSchema.safeParse({ ...validCategory, categoryType: "6.9" }).success).toBe(false));
  it("rejects an empty id", () => expect(categoryApplicationSchema.safeParse({ ...validCategory, id: "" }).success).toBe(false));
  it("rejects missing scoring inputs", () => {
    const { scoringInputs: _omitted, ...withoutScoringInputs } = validCategory;
    expect(categoryApplicationSchema.safeParse(withoutScoringInputs).success).toBe(false);
  });
});

describe("categoriesSchema", () => {
  it("accepts categories with unique ids", () =>
    expect(categoriesSchema.safeParse([validCategory, { ...validCategory, id: "category-2", categoryType: "6.4" }]).success).toBe(true));
  it("rejects duplicate ids", () =>
    expect(categoriesSchema.safeParse([validCategory, { ...validCategory, categoryType: "6.4" }]).success).toBe(false));
  it("accepts an empty array", () => expect(categoriesSchema.safeParse([]).success).toBe(true));
});

describe("categoryStepSchema", () => {
  it("accepts at least one category", () => expect(categoryStepSchema.safeParse({ categories: [validCategory] }).success).toBe(true));
  it("rejects an empty categories list", () => expect(categoryStepSchema.safeParse({ categories: [] }).success).toBe(false));
  it("propagates duplicate id failures", () =>
    expect(categoryStepSchema.safeParse({ categories: [validCategory, { ...validCategory, categoryType: "6.4" }] }).success).toBe(false));
});

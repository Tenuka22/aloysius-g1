import { describe, expect, it, test } from "vitest";
import {
  applicantStepSchema,
  declarationStepSchema,
  guardianStepSchema,
  residenceStepSchema,
  signInSchema,
  signUpSchema,
} from "./validation";
import { G1_DOB_CUTOFF, nicRegex } from "./eligibility";

describe("signInSchema", () => {
  it("accepts valid credentials", () =>
    expect(signInSchema.safeParse({ email: "parent@example.com", password: "password123" }).success).toBe(true));
  it("rejects an invalid email", () =>
    expect(signInSchema.safeParse({ email: "not-an-email", password: "password123" }).success).toBe(false));
  it("rejects a short password", () =>
    expect(signInSchema.safeParse({ email: "parent@example.com", password: "short" }).success).toBe(false));
  it("rejects an empty email", () =>
    expect(signInSchema.safeParse({ email: "", password: "password123" }).success).toBe(false));
});

describe("signUpSchema", () => {
  it("accepts valid input", () =>
    expect(signUpSchema.safeParse({ name: "An", email: "parent@example.com", password: "password123" }).success).toBe(true));
  it("rejects a too-short name", () =>
    expect(signUpSchema.safeParse({ name: "A", email: "parent@example.com", password: "password123" }).success).toBe(false));
  it("rejects an invalid email", () =>
    expect(signUpSchema.safeParse({ name: "An", email: "nope", password: "password123" }).success).toBe(false));
  it("rejects a short password", () =>
    expect(signUpSchema.safeParse({ name: "An", email: "parent@example.com", password: "1234567" }).success).toBe(false));
});

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
  dateOfBirth: "2021-01-15",
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
  it("accepts DOB exactly on the cutoff", () =>
    expect(applicantStepSchema.safeParse({ ...validApplicant, dateOfBirth: G1_DOB_CUTOFF() }).success).toBe(true));
  it("rejects DOB after the cutoff", () => {
    const nextYear = new Date().getFullYear() + 1;
    expect(applicantStepSchema.safeParse({ ...validApplicant, dateOfBirth: `${nextYear}-02-01` }).success).toBe(false));
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
import { describe, expect, it, test } from "vitest";
import {
  ALLOWED_EDUCATION_MEDIUMS,
  DISALLOWED_GENDERS,
  DISALLOWED_RELIGIONS,
  G1_DOB_CUTOFF,
  applicantSectionComplete,
  educationMediumAllowed,
  getNextStepReason,
  guardianNicInvalid,
  isG1EligibleDob,
  isRestrictedGender,
  isRestrictedReligion,
  locationIsReady,
} from "./eligibility";

const DUP_REASON = "This birth certificate number is already used by another applicant.";
const FIELDS_REASON = "Complete all required applicant fields to continue.";
const LOCATION_REASON = "Select a location on the map to continue.";
const NIC_REASON = "Complete all required guardian fields to continue.";
const NIC_INVALID_REASON = "Enter a valid NIC number for the guardian.";
const DECLARATION_REASON = "You must confirm the declaration and provide consent to proceed.";

describe("isRestrictedGender", () => {
  test.each(DISALLOWED_GENDERS)("blocks %s", (gender) => expect(isRestrictedGender(gender)).toBe(true));
  test.each(["Male", "", "Other", "Undefined"])("allows %s", (gender) => expect(isRestrictedGender(gender)).toBe(false));
  it("blocks nullish input", () => expect(isRestrictedGender(undefined)).toBe(false));
});

describe("isRestrictedReligion", () => {
  test.each(DISALLOWED_RELIGIONS)("blocks %s", (religion) => expect(isRestrictedReligion(religion)).toBe(true));
  test.each(["Buddhist", "Islam", "", "Hindu"])("allows %s", (religion) => expect(isRestrictedReligion(religion)).toBe(false));
  it("allows undefined", () => expect(isRestrictedReligion(undefined)).toBe(false));
});

describe("isG1EligibleDob", () => {
  const nextYear = new Date().getFullYear() + 1;
  it("is eligible exactly on the cutoff", () => expect(isG1EligibleDob(G1_DOB_CUTOFF())).toBe(true));
  it("is eligible before the cutoff", () => expect(isG1EligibleDob("2021-12-31")).toBe(true));
  it("is eligible in early years", () => expect(isG1EligibleDob("2019-06-15")).toBe(true));
  it("is not eligible after the cutoff", () => expect(isG1EligibleDob(`${nextYear}-02-01`)).toBe(false));
  it("is not eligible far after the cutoff", () => expect(isG1EligibleDob(`${nextYear + 1}-05-10`)).toBe(false));
  it("is not eligible when empty", () => expect(isG1EligibleDob("")).toBe(false));
  it("is not eligible when whitespace only", () => expect(isG1EligibleDob("   ")).toBe(false));
  it("is not eligible when undefined", () => expect(isG1EligibleDob(undefined)).toBe(false));
});

describe("educationMediumAllowed", () => {
  test.each(ALLOWED_EDUCATION_MEDIUMS)("allows %s", (medium) => expect(educationMediumAllowed(medium)).toBe(true));
  test.each(["English", "", "Sinhala-Medium", "Tamil Medium"])("rejects %s", (medium) => expect(educationMediumAllowed(medium)).toBe(false));
});

describe("locationIsReady", () => {
  it("is ready with both coordinates", () => expect(locationIsReady({ latitude: 7.29, longitude: 80.63 })).toBe(true));
  it("is not ready when latitude is null", () => expect(locationIsReady({ latitude: null, longitude: 80.63 })).toBe(false));
  it("is not ready when latitude missing", () => expect(locationIsReady({ longitude: 80.63 })).toBe(false));
  it("is not ready when longitude is null", () => expect(locationIsReady({ latitude: 7.29, longitude: null })).toBe(false));
  it("is not ready when both missing", () => expect(locationIsReady({})).toBe(false));
  it("accepts zero coordinates", () => expect(locationIsReady({ latitude: 0, longitude: 0 })).toBe(true));
  it("is not ready for null location", () => expect(locationIsReady(null)).toBe(false));
  it("is not ready for undefined location", () => expect(locationIsReady(undefined)).toBe(false));
});

describe("guardianNicInvalid", () => {
  it("accepts a 12-digit NIC", () => expect(guardianNicInvalid("199123456789")).toBe(false));
  it("accepts a 9-digit V NIC", () => expect(guardianNicInvalid("912345678V")).toBe(false));
  it("accepts a 9-digit X NIC", () => expect(guardianNicInvalid("912345678X")).toBe(false));
  it("accepts a lowercase v NIC (normalized)", () => expect(guardianNicInvalid("912345678v")).toBe(false));
  it("accepts whitespace-padded NIC (normalized)", () => expect(guardianNicInvalid(" 912345678V ")).toBe(false));
  it("rejects a short NIC", () => expect(guardianNicInvalid("12345")).toBe(true));
  it("rejects an alphanumeric NIC", () => expect(guardianNicInvalid("AB1234567V")).toBe(true));
  it("rejects a W suffix NIC", () => expect(guardianNicInvalid("912345678W")).toBe(true));
  it("rejects a 13-digit NIC", () => expect(guardianNicInvalid("1999123456789")).toBe(true));
  it("accepts an empty NIC (optional)", () => expect(guardianNicInvalid("")).toBe(false));
  it("accepts undefined NIC (optional)", () => expect(guardianNicInvalid(undefined)).toBe(false));
});

describe("applicantSectionComplete", () => {
  it("is complete with all fields", () =>
    expect(applicantSectionComplete({ fullName: "A", gender: "Male", religion: "Buddhist", educationMedium: "Sinhala", dateOfBirth: "2021-01-01", birthCertificateNumber: "ABC" })).toBe(true));
  it.each([
    ["fullName", { fullName: "", gender: "Male", religion: "Buddhist", educationMedium: "Sinhala", dateOfBirth: "2021-01-01", birthCertificateNumber: "ABC" }],
    ["gender", { fullName: "A", gender: "", religion: "Buddhist", educationMedium: "Sinhala", dateOfBirth: "2021-01-01", birthCertificateNumber: "ABC" }],
    ["religion", { fullName: "A", gender: "Male", religion: "", educationMedium: "Sinhala", dateOfBirth: "2021-01-01", birthCertificateNumber: "ABC" }],
    ["educationMedium", { fullName: "A", gender: "Male", religion: "Buddhist", educationMedium: "", dateOfBirth: "2021-01-01", birthCertificateNumber: "ABC" }],
    ["dateOfBirth", { fullName: "A", gender: "Male", religion: "Buddhist", educationMedium: "Sinhala", dateOfBirth: "", birthCertificateNumber: "ABC" }],
    ["birthCertificateNumber", { fullName: "A", gender: "Male", religion: "Buddhist", educationMedium: "Sinhala", dateOfBirth: "2021-01-01", birthCertificateNumber: "" }],
  ])("is incomplete when %s is missing", (_label, applicant) => expect(applicantSectionComplete(applicant)).toBe(false));
  it("is incomplete for undefined applicant", () => expect(applicantSectionComplete(undefined)).toBe(false));
});

describe("getNextStepReason — step 0 (location)", () => {
  test.each([
    ["map approved even without coordinates", { locationCanProceed: true, location: { latitude: null, longitude: null } }, LOCATION_REASON],
    ["map approved with coordinates", { locationCanProceed: true, location: { latitude: 7.29, longitude: 80.63 } }, ""],
    ["not approved but coordinates set", { locationCanProceed: false, location: { latitude: 7.29, longitude: 80.63 } }, ""],
    ["not approved and no location", { locationCanProceed: false, location: undefined }, LOCATION_REASON],
    ["not approved and null location", { locationCanProceed: false, location: null }, LOCATION_REASON],
    ["not approved and empty location", { locationCanProceed: false, location: {} }, LOCATION_REASON],
    ["not approved and latitude only", { locationCanProceed: false, location: { latitude: 7.29 } }, LOCATION_REASON],
    ["not approved and longitude only", { locationCanProceed: false, location: { longitude: 80.63 } }, LOCATION_REASON],
    ["defaults when locationCanProceed missing", { location: { latitude: null, longitude: null } }, LOCATION_REASON],
  ])("%s", (_label, deps, expected) => expect(getNextStepReason({ step: 0, ...deps })).toBe(expected));
});

describe("getNextStepReason — step 1 (applicant) exhaustive combinations", () => {
  const genders = ["", "Female", "Male"];
  const religions = ["", "Catholic", "Christian", "Buddhist", "Islam"];
  const datesOfBirth = ["", "2019-01-01", "2021-01-31", "2022-01-31", "2022-02-01", "2023-12-31"];
  const certificates = ["", "ABC1234567"];
  const names = ["", "Ashan Perera"];
  const mediums = ["", "Sinhala", "Tamil"];

  type ApplicantCase = { duplicate: boolean; gender: string; religion: string; dateOfBirth: string; certificate: string; name: string; medium: string };

  function expectedReason(case_: ApplicantCase): string {
    if (case_.duplicate) return DUP_REASON;
    const fieldBlocked =
      case_.gender === "Female" ||
      case_.religion === "Catholic" ||
      case_.religion === "Christian" ||
      !case_.dateOfBirth ||
      case_.dateOfBirth > G1_DOB_CUTOFF() ||
      !case_.certificate ||
      !case_.name ||
      !case_.medium;
    return fieldBlocked ? FIELDS_REASON : "";
  }

  let combinationCount = 0;
  for (const duplicate of [false, true]) {
    for (const gender of genders) {
      for (const religion of religions) {
        for (const dateOfBirth of datesOfBirth) {
          for (const certificate of certificates) {
            for (const name of names) {
              for (const medium of mediums) {
                combinationCount += 1;
                const description = `duplicate=${duplicate} gender=${gender || "∅"} religion=${religion || "∅"} dob=${dateOfBirth || "∅"} cert=${certificate || "∅"} name=${name || "∅"} medium=${medium || "∅"}`;
                test(description, () => {
                  const applicant = { gender, religion, dateOfBirth, birthCertificateNumber: certificate, fullName: name, educationMedium: medium };
                  expect(getNextStepReason({ step: 1, duplicateBirthCertificate: duplicate, applicant })).toBe(expectedReason({ duplicate, gender, religion, dateOfBirth, certificate, name, medium }));
                });
              }
            }
          }
        }
      }
    }
  }
  it(`exercised every combination (${combinationCount})`, () => expect(combinationCount).toBe(2 * 3 * 5 * 6 * 2 * 2 * 3));
});

describe("getNextStepReason — step 2 (guardian)", () => {
  const fullGuardian = { relationship: "Mother", fullName: "Jane Doe", nic: "912345678V", phone: "+94712345678" };
  test.each([
    ["all fields provided proceeds", { guardian: fullGuardian }, ""],
    ["missing relationship blocked", { guardian: { ...fullGuardian, relationship: "" } }, NIC_REASON],
    ["missing fullName blocked", { guardian: { ...fullGuardian, fullName: "" } }, NIC_REASON],
    ["missing nic blocked", { guardian: { ...fullGuardian, nic: "" } }, NIC_REASON],
    ["missing phone blocked", { guardian: { ...fullGuardian, phone: "" } }, NIC_REASON],
    ["invalid NIC blocked", { guardian: { ...fullGuardian, nic: "12345" } }, NIC_INVALID_REASON],
    ["letter-prefixed NIC blocked", { guardian: { ...fullGuardian, nic: "AB1234567V" } }, NIC_INVALID_REASON],
    ["wrong suffix blocked", { guardian: { ...fullGuardian, nic: "912345678W" } }, NIC_INVALID_REASON],
    ["12-digit NIC is allowed", { guardian: { ...fullGuardian, nic: "199123456789" } }, ""],
    ["lowercase nic is allowed (normalized)", { guardian: { ...fullGuardian, nic: "912345678v" } }, ""],
    ["missing guardian blocked", {}, NIC_REASON],
  ])("%s", (_label, deps, expected) =>
    expect(getNextStepReason({ step: 2, ...deps })).toBe(expected));
});

describe("getNextStepReason — step 4 (declaration) exhaustive", () => {
  test.each([
    ["confirmed true, consent true proceeds", { confirmed: true, consent: true }, ""],
    ["confirmed true, consent false blocked", { confirmed: true, consent: false }, DECLARATION_REASON],
    ["confirmed false, consent true blocked", { confirmed: false, consent: true }, DECLARATION_REASON],
    ["confirmed false, consent false blocked", { confirmed: false, consent: false }, DECLARATION_REASON],
    ["missing declaration blocked", undefined, DECLARATION_REASON],
  ])("%s", (_label, declaration, expected) =>
    expect(getNextStepReason({ step: 4, declaration })).toBe(expected));
});

describe("getNextStepReason — other steps", () => {
  test.each([3, 5, -1, 99])("step %d always proceeds", (step) =>
    expect(getNextStepReason({ step })).toBe(""));
  it("respects no other step's rules", () =>
    expect(getNextStepReason({ step: 3, locationCanProceed: false, duplicateBirthCertificate: true, declaration: { confirmed: false, consent: false } })).toBe(""));
});
import { describe, expect, it, test } from "vitest";
import type { AccessRequestInput } from "./logic";
import {
  accessRequestIssues,
  applicationValidationErrors,
  createAccessKey,
  createSessionCode,
  defaultSubmissionWindow,
  extractBirthCertificateNumber,
  hashKey,
  isSubmissionLocked,
  isValidSessionCode,
  isValidSubmissionWindow,
  keySchema,
  sessionCodePattern,
  withoutSchoolPreferences,
} from "./logic";

describe("keySchema", () => {
  it.each([
    ["a".repeat(32), true],
    ["a".repeat(128), true],
    ["a".repeat(31), false],
    ["a".repeat(129), false],
    ["", false],
  ])("%s -> %s", (key, expected) => expect(keySchema.safeParse(key).success).toBe(expected));
});

describe("hashKey", () => {
  it("is deterministic", () => expect(hashKey("same-key")).toBe(hashKey("same-key")));
  it("is a 64-character hex digest", () => expect(hashKey("anything")).toMatch(/^[0-9a-f]{64}$/));
  it("differs for different keys", () => expect(hashKey("key-a")).not.toBe(hashKey("key-b")));
  it("hashes the exact bytes (case-sensitive)", () => expect(hashKey("Key")).not.toBe(hashKey("key")));
});

describe("createAccessKey", () => {
  it("is prefixed with ALY-", () => expect(createAccessKey()).toMatch(/^ALY-/));
  it("uses 32 random bytes encoded as base64url", () => expect(createAccessKey()).toMatch(/^ALY-[A-Za-z0-9_-]{43}$/));
  it("is unique across calls", () => {
    const [a, b, c] = [createAccessKey(), createAccessKey(), createAccessKey()];
    expect(new Set([a, b, c]).size).toBe(3);
  });
  it("is never stored verbatim (hash differs from key)", () => {
    const key = createAccessKey();
    expect(hashKey(key)).not.toBe(key);
  });
});

describe("session codes", () => {
  it("validates the documented format 26XXX123", () => {
    expect(isValidSessionCode("26ABC123")).toBe(true);
    expect(isValidSessionCode("99XYZ000")).toBe(true);
    expect(isValidSessionCode("26abc123")).toBe(false);
    expect(isValidSessionCode("26123ABC")).toBe(false);
    expect(isValidSessionCode("26ABC12")).toBe(false);
    expect(isValidSessionCode("26ABCD12")).toBe(false);
    expect(isValidSessionCode("")).toBe(false);
    expect(sessionCodePattern.test("26ABC123")).toBe(true);
  });
  it("generates codes in the documented format", () => {
    for (let i = 0; i < 500; i += 1) {
      expect(isValidSessionCode(createSessionCode())).toBe(true);
    }
  });
  it("generates codes starting with the 26 year prefix", () => {
    for (let i = 0; i < 500; i += 1) {
      expect(createSessionCode().startsWith("26")).toBe(true);
    }
  });
});

describe("defaultSubmissionWindow", () => {
  const window = defaultSubmissionWindow();
  it("opens 2026-09-09 00:00 +05:30", () => expect(window.opensAt.toISOString()).toBe("2026-09-08T18:30:00.000Z"));
  it("closes 2026-09-12 00:00 +05:30", () => expect(window.closesAt.toISOString()).toBe("2026-09-11T18:30:00.000Z"));
  it("closes after it opens", () => expect(window.closesAt > window.opensAt).toBe(true));
});

describe("isSubmissionLocked (default window)", () => {
  const window = defaultSubmissionWindow();
  test.each([
    ["before opening", "2026-09-08T18:29:59.999Z", true],
    ["exactly at opening", "2026-09-08T18:30:00.000Z", false],
    ["during the window", "2026-09-10T12:00:00.000Z", false],
    ["exactly at closing", "2026-09-11T18:30:00.000Z", false],
    ["after closing", "2026-09-11T18:30:00.001Z", true],
    ["a year later", "2027-09-10T12:00:00.000Z", true],
  ])("%s is %s", (_label, now, expected) => expect(isSubmissionLocked(window, new Date(now))).toBe(expected));
});

describe("isSubmissionLocked (custom window)", () => {
  const window = { opensAt: new Date("2026-01-01T00:00:00.000Z"), closesAt: new Date("2026-02-01T00:00:00.000Z") };
  it("locks before a custom opening", () => expect(isSubmissionLocked(window, new Date("2025-12-31T23:59:59.999Z"))).toBe(true));
  it("unlocks inside a custom window", () => expect(isSubmissionLocked(window, new Date("2026-01-15T00:00:00.000Z"))).toBe(false));
  it("locks after a custom closing", () => expect(isSubmissionLocked(window, new Date("2026-02-01T00:00:00.001Z"))).toBe(true));
});

describe("isValidSubmissionWindow (admin setting)", () => {
  it("rejects closesAt before opensAt", () => expect(isValidSubmissionWindow(new Date("2026-09-12"), new Date("2026-09-09"))).toBe(false));
  it("rejects closesAt equal to opensAt", () => expect(isValidSubmissionWindow(new Date("2026-09-12"), new Date("2026-09-12"))).toBe(false));
  it("accepts closesAt after opensAt", () => expect(isValidSubmissionWindow(new Date("2026-09-09"), new Date("2026-09-12"))).toBe(true));
});

describe("withoutSchoolPreferences", () => {
  it("removes the schools key and preserves everything else", () =>
    expect(withoutSchoolPreferences({ applicant: { fullName: "A" }, schools: ["S1", "S2"], location: { label: "L" } })).toEqual({ applicant: { fullName: "A" }, location: { label: "L" } }));
  it("returns an empty object for empty input", () => expect(withoutSchoolPreferences({})).toEqual({}));
});

describe("extractBirthCertificateNumber", () => {
  it("normalizes a present certificate number to uppercase", () =>
    expect(extractBirthCertificateNumber({ applicant: { birthCertificateNumber: "  abc123  " } })).toBe("ABC123"));
  it("returns empty when no applicant section", () => expect(extractBirthCertificateNumber({})).toBe(""));
  it("returns the raw value when not a string", () => expect(extractBirthCertificateNumber({ applicant: { birthCertificateNumber: 42 } })).toBe("42"));
});

describe("applicationValidationErrors — every branch", () => {
  it("flags every missing field on an empty draft", () => {
    expect(applicationValidationErrors({})).toEqual(["missing_full_name", "missing_birth_certificate", "missing_date_of_birth", "missing_location"]);
  });
  it("flags missing fields on null data", () => {
    const errors = applicationValidationErrors(null);
    expect(errors).toContain("missing_full_name");
    expect(errors).toContain("missing_location");
  });
  test.each(["Female"])("flags female applicant (%s)", (gender) => {
    const errors = applicationValidationErrors({ applicant: { fullName: "A", birthCertificateNumber: "X", dateOfBirth: "2021-01-01", gender } });
    expect(errors).toContain("female_applicant");
    expect(errors).not.toContain("missing_full_name");
  });
  it("does not flag a male applicant", () => {
    const errors = applicationValidationErrors({ applicant: { gender: "Male" } });
    expect(errors).not.toContain("female_applicant");
  });
  test.each(["Catholic", "Christian"])("flags religion %s", (religion) => {
    const errors = applicationValidationErrors({ applicant: { religion } });
    expect(errors).toContain("restricted_religion");
  });
  test.each(["Buddhist", "Islam", undefined])("does not flag religion %s", (religion) => {
    const errors = applicationValidationErrors({ applicant: { religion } });
    expect(errors).not.toContain("restricted_religion");
  });
  it("flags an invalid guardian email", () => {
    const errors = applicationValidationErrors({ guardian: { email: "not-an-email" } });
    expect(errors).toContain("invalid_email");
  });
  test.each(["mala@example.com", "", undefined])("does not flag email %s", (email) => {
    const errors = applicationValidationErrors({ guardian: { email } });
    expect(errors).not.toContain("invalid_email");
  });
  test.each([
    [{ latitude: null, longitude: null }, true],
    [{ latitude: 7.29, longitude: null }, true],
    [{ latitude: null, longitude: 80.63 }, true],
    [{ latitude: 7.29, longitude: 80.63 }, false],
    [undefined, true],
  ])("location %j missing_location=%s", (location, expected) => {
    const errors = applicationValidationErrors({ location });
    expect(errors.includes("missing_location")).toBe(expected);
  });
  it("returns no errors for a fully valid record", () =>
    expect(applicationValidationErrors({
      applicant: { fullName: "Ashan Perera", gender: "Male", religion: "Buddhist", educationMedium: "Sinhala", dateOfBirth: "2021-01-01", birthCertificateNumber: "ABC123" },
      guardian: { email: "mala@example.com" },
      location: { latitude: 7.29, longitude: 80.63 },
    })).toEqual([]));
});

describe("accessRequestIssues — every rule", () => {
  it("requires at least one identifier", () => {
    expect(accessRequestIssues({ requestType: "access" }).some((issue) => issue.message.includes("birth certificate number, session code"))).toBe(true);
  });
  test.each([
    ["birthCertificateNumber", { birthCertificateNumber: "ABC123" }],
    ["sessionCode", { sessionCode: "26ABC123" }],
    ["guardianNic", { guardianNic: "901234567V" }],
    ["accessKey", { accessKey: "a".repeat(32) }],
  ])("an identifier alone (%s) satisfies the requirement", (_label, partial) => {
    const issues = accessRequestIssues({ ...partial, requestType: "access", contactPhone: "+94712345678", applicantName: "A" });
    expect(issues.some((issue) => issue.message.includes("is required"))).toBe(false);
  });
  it("requires a contact number for access requests", () => {
    const issues = accessRequestIssues({ birthCertificateNumber: "ABC123", requestType: "access" });
    expect(issues.some((issue) => issue.path?.includes("contactPhone"))).toBe(true);
  });
  it("does not require a contact number when supplied", () => {
    const issues = accessRequestIssues({ birthCertificateNumber: "ABC123", requestType: "access", contactPhone: "+94712345678" });
    expect(issues.some((issue) => issue.path?.includes("contactPhone"))).toBe(false);
  });
  it("requires name, guardian name and contact for removal requests", () => {
    const partials: AccessRequestInput[] = [
      { requestType: "removal", birthCertificateNumber: "ABC123" },
      { requestType: "removal", birthCertificateNumber: "ABC123", applicantName: "A", guardianName: "G" },
      { requestType: "removal", birthCertificateNumber: "ABC123", applicantName: "A", guardianName: "G", contactPhone: "" },
    ];
    for (const partial of partials) {
      expect(accessRequestIssues(partial).some((issue) => issue.message.includes("Applicant name, guardian name, and contact number"))).toBe(true);
    }
  });
  it("accepts a complete removal request", () => {
    expect(accessRequestIssues({ requestType: "removal", birthCertificateNumber: "ABC123", applicantName: "A", guardianName: "G", contactPhone: "+94712345678" })).toEqual([]);
  });
  it("requires the applicant name when recovering by guardian NIC", () => {
    expect(accessRequestIssues({ requestType: "access", guardianNic: "901234567V", contactPhone: "+94712345678" }).some((issue) => issue.message.includes("Applicant name is required when using guardian NIC"))).toBe(true);
  });
  it("accepts an access request by guardian NIC with name and phone", () => {
    expect(accessRequestIssues({ requestType: "access", guardianNic: "901234567V", applicantName: "Ashan", contactPhone: "+94712345678" })).toEqual([]);
  });
  it("applies access rules for an omitted request type (schema default)", () => {
    const issues = accessRequestIssues({ birthCertificateNumber: "ABC123" });
    expect(issues.some((issue) => issue.path?.includes("contactPhone"))).toBe(true);
  });
  it("requires access key, applicant name, and contact for submission requests", () => {
    const partials: AccessRequestInput[] = [
      { requestType: "submission" },
      { requestType: "submission", accessKey: "a".repeat(32) },
      { requestType: "submission", accessKey: "a".repeat(32), applicantName: "A" },
      { requestType: "submission", accessKey: "a".repeat(32), applicantName: "A", contactPhone: "" },
    ];
    for (const partial of partials) {
      expect(accessRequestIssues(partial).some((issue) => issue.message.includes("Access key, applicant name, and contact number"))).toBe(true);
    }
  });
  it("accepts a complete submission request", () => {
    expect(accessRequestIssues({ requestType: "submission", accessKey: "a".repeat(32), applicantName: "Ashan", contactPhone: "+94712345678" })).toEqual([]);
  });
});
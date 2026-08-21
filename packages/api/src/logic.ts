import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export const draftSchema = z.record(z.string(), z.unknown());

export const keySchema = z.string().min(32).max(128);

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export const createAccessKey = () => `ALY-${randomBytes(32).toString("base64url")}`;

export const sessionCodePattern = /^\d{2}[A-Z]{3}\d{3}$/;

export const createSessionCode = () =>
  `26${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(
    65 + Math.floor(Math.random() * 26),
  )}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;

export const isValidSessionCode = (code: string) => sessionCodePattern.test(code);

export const defaultSubmissionWindow = () => ({
  opensAt: new Date("2026-09-09T00:00:00+05:30"),
  closesAt: new Date("2026-09-12T00:00:00+05:30"),
});

export const isSubmissionLocked = (window: { opensAt: Date; closesAt: Date }, now: Date = new Date()) =>
  now < window.opensAt || now > window.closesAt;

export const isValidSubmissionWindow = (opensAt: Date, closesAt: Date) => closesAt > opensAt;

export const withoutSchoolPreferences = (data: Record<string, unknown>): Record<string, unknown> => {
  const { schools: _removed, ...sanitized } = data;
  return sanitized;
};

export const extractBirthCertificateNumber = (data: Record<string, unknown>): string => {
  if (typeof data.applicant === "object" && data.applicant !== null && "birthCertificateNumber" in data.applicant) {
    return String((data.applicant as { birthCertificateNumber?: unknown }).birthCertificateNumber ?? "")
      .trim()
      .toUpperCase();
  }
  return "";
};

export type ApplicationData = {
  applicant?: {
    fullName?: string;
    gender?: string;
    religion?: string;
    educationMedium?: string;
    dateOfBirth?: string;
    birthCertificateNumber?: string;
  };
  guardian?: { email?: string };
  location?: { latitude?: number | null; longitude?: number | null };
};

export const applicationValidationErrors = (data: ApplicationData | null | undefined): string[] => {
  const email = data?.guardian?.email?.trim() ?? "";
  return [
    !data?.applicant?.fullName && "missing_full_name",
    !data?.applicant?.birthCertificateNumber && "missing_birth_certificate",
    !data?.applicant?.dateOfBirth && "missing_date_of_birth",
    data?.applicant?.gender === "Female" && "female_applicant",
    ["Catholic", "Christian"].includes(data?.applicant?.religion ?? "") && "restricted_religion",
    email && !/^\S+@\S+\.\S+$/.test(email) && "invalid_email",
    (data?.location?.latitude == null || data?.location?.longitude == null) && "missing_location",
  ].filter(Boolean) as string[];
};

export type AccessRequestInput = {
  birthCertificateNumber?: string;
  sessionCode?: string;
  guardianNic?: string;
  applicantName?: string;
  guardianName?: string;
  contactPhone?: string;
  accessKey?: string;
  requestType?: "access" | "removal" | "submission";
};

export const accessRequestIssues = (input: AccessRequestInput): { path?: string[]; message: string }[] => {
  const issues: { path?: string[]; message: string }[] = [];
  const requestType = input.requestType ?? "access";
  if (!input.birthCertificateNumber && !input.sessionCode && !input.guardianNic && !input.accessKey) {
    issues.push({ message: "A birth certificate number, session code, guardian NIC, or access key is required" });
  }
  if (requestType === "access" && !input.contactPhone) {
    issues.push({ path: ["contactPhone"], message: "A mobile number is required for access recovery" });
  }
  if (requestType === "removal" && (!input.applicantName || !input.guardianName || !input.contactPhone)) {
    issues.push({ message: "Applicant name, guardian name, and contact number are required for removal requests" });
  }
  if (requestType === "submission" && (!input.accessKey || !input.applicantName || !input.contactPhone)) {
    issues.push({ message: "Access key, applicant name, and contact number are required for submission requests" });
  }
  if (requestType === "access" && input.guardianNic && !input.applicantName) {
    issues.push({ message: "Applicant name is required when using guardian NIC recovery" });
  }
  return issues;
};
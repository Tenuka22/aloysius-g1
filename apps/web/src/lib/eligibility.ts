import { ADMISSION_RESTRICTIONS, G1_AGE_ELIGIBILITY } from "./school-config";

export const g1SchoolYear = () => new Date().getFullYear() + 1;

export const G1_DOB_CUTOFF = () => `${g1SchoolYear()}-01-31`;

// The applicant must be at least `minYears` and at most `maxYears` old on the
// cutoff date (31 January of the intake year) — born on or before G1_DOB_LATEST
// and after G1_DOB_EARLIEST. With minYears === maxYears === 5 this pins
// eligibility to a single one-year birth-date window (exactly age 5).
export const G1_DOB_LATEST = () => `${g1SchoolYear() - G1_AGE_ELIGIBILITY.minYears}-01-31`;
export const G1_DOB_EARLIEST = () => `${g1SchoolYear() - G1_AGE_ELIGIBILITY.maxYears - 1}-02-01`;

export const nicRegex = /^\d{12}$|^\d{9}[VX]$/;

export const DISALLOWED_GENDERS = ADMISSION_RESTRICTIONS.disallowedGenders;
export const DISALLOWED_RELIGIONS = ADMISSION_RESTRICTIONS.disallowedReligions;
export const ALLOWED_EDUCATION_MEDIUMS = ADMISSION_RESTRICTIONS.allowedEducationMediums;

export type ApplicantValues = {
  fullName?: string;
  sinhalaName?: string;
  gender?: string;
  religion?: string;
  educationMedium?: string;
  dateOfBirth?: string;
  birthCertificateNumber?: string;
};

export function isRestrictedGender(gender: string | undefined): boolean {
  return DISALLOWED_GENDERS.includes(gender as (typeof DISALLOWED_GENDERS)[number]);
}

export function isRestrictedReligion(religion: string | undefined): boolean {
  return DISALLOWED_RELIGIONS.includes(religion as (typeof DISALLOWED_RELIGIONS)[number]);
}

export function educationMediumAllowed(medium: string | undefined): boolean {
  if (!medium) return false;
  if (ALLOWED_EDUCATION_MEDIUMS.length === 0) return true;
  return ALLOWED_EDUCATION_MEDIUMS.includes(medium as (typeof ALLOWED_EDUCATION_MEDIUMS)[number]);
}

export function isG1EligibleDob(dateOfBirth: string | undefined): boolean {
  const value = dateOfBirth?.trim();
  return Boolean(value) && value! >= G1_DOB_EARLIEST() && value! <= G1_DOB_LATEST();
}

export type Age = { years: number; months: number };

/** The child's real age today (or as of `asOf`), in whole years and months — not age at the intake cutoff. */
export function ageAsOf(dateOfBirth: string | undefined, asOf: Date = new Date()): Age | null {
  const value = dateOfBirth?.trim();
  if (!value) return null;
  const [birthYear, birthMonth, birthDay] = value.split("-").map(Number);
  if (!birthYear || !birthMonth || !birthDay) return null;
  let years = asOf.getFullYear() - birthYear;
  let months = asOf.getMonth() - (birthMonth - 1);
  if (asOf.getDate() < birthDay) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0 || (years === 0 && months < 0)) return null;
  return { years, months };
}

const G1_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatG1Date(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${G1_MONTH_NAMES[month - 1]} ${year}`;
}

export function g1DobEligibilityMessage(): string {
  const ageDescription = G1_AGE_ELIGIBILITY.minYears === G1_AGE_ELIGIBILITY.maxYears
    ? `exactly ${G1_AGE_ELIGIBILITY.minYears} years old`
    : `between ${G1_AGE_ELIGIBILITY.minYears} and ${G1_AGE_ELIGIBILITY.maxYears} years old`;
  return `The child must be ${ageDescription} by 31 January ${g1SchoolYear()} — born between ${formatG1Date(G1_DOB_EARLIEST())} and ${formatG1Date(G1_DOB_LATEST())}.`;
}

export function applicantSectionComplete(applicant: ApplicantValues | undefined): boolean {
  return Boolean(
    applicant?.fullName &&
      applicant?.gender &&
      applicant?.religion &&
      applicant?.educationMedium &&
      applicant?.dateOfBirth &&
      applicant?.birthCertificateNumber,
  );
}

export function guardianNicInvalid(nic: string | undefined): boolean {
  const normalized = String(nic ?? "").trim().toUpperCase();
  return Boolean(normalized) && !nicRegex.test(normalized);
}

export function isGoodNIC(nic: string | undefined): boolean {
  return !guardianNicInvalid(nic);
}

export function locationIsReady(location: { latitude?: number | null; longitude?: number | null } | null | undefined): boolean {
  return location?.latitude != null && location?.longitude != null;
}

export type NextStepDeps = {
  step: number;
  locationCanProceed?: boolean;
  location?: { latitude?: number | null; longitude?: number | null } | null;
  locationSkipped?: boolean;
  duplicateBirthCertificate?: boolean;
  birthCertificateSkipped?: boolean;
  applicant?: ApplicantValues;
  guardian?: { relationship?: string; fullName?: string; nic?: string; phone?: string };
  categories?: { length?: number };
  declaration?: { confirmed?: boolean; consent?: boolean };
};

export function getNextStepReason(deps: NextStepDeps): string {
  const { step } = deps;
  if (step === 0) {
    if (!locationIsReady(deps.location) && !deps.locationSkipped)
      return "Select a location on the map to continue.";
    return "";
  }
  if (step === 1) {
    const applicant = deps.applicant ?? {};
    if (deps.duplicateBirthCertificate)
      return "This birth certificate number is already used by another applicant.";
    if (
      isRestrictedGender(applicant.gender) ||
      isRestrictedReligion(applicant.religion) ||
      !educationMediumAllowed(applicant.educationMedium) ||
      !isG1EligibleDob(applicant.dateOfBirth) ||
      (!applicant.birthCertificateNumber && !deps.birthCertificateSkipped) ||
      !applicant.fullName
    )
      return "Complete all required applicant fields to continue.";
    return "";
  }
  if (step === 2) {
    const guardian = deps.guardian ?? {};
    if (!guardian.relationship || !guardian.fullName || !guardian.nic || !guardian.phone)
      return "Complete all required guardian fields to continue.";
    if (guardianNicInvalid(guardian.nic))
      return "Enter a valid NIC number for the guardian.";
    return "";
  }
  if (step === 4) {
    if (!deps.categories?.length) return "Select at least one category to continue.";
    return "";
  }
  if (step === 5) {
    if (deps.locationSkipped && !locationIsReady(deps.location))
      return "Provide the home location you skipped earlier before submitting.";
    if (deps.birthCertificateSkipped && !deps.applicant?.birthCertificateNumber)
      return "Provide the birth certificate number you skipped earlier before submitting.";
    if (!deps.declaration?.confirmed || !deps.declaration?.consent)
      return "You must confirm the declaration and provide consent to proceed.";
    return "";
  }
  return "";
}
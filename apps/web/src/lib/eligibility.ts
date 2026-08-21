export const g1SchoolYear = () => new Date().getFullYear() + 1;

export const G1_DOB_CUTOFF = () => `${g1SchoolYear()}-01-31`;

export const nicRegex = /^\d{12}$|^\d{9}[VX]$/;

export const DISALLOWED_GENDERS = ["Female"] as const;
export const DISALLOWED_RELIGIONS = ["Catholic", "Christian"] as const;
export const ALLOWED_EDUCATION_MEDIUMS = ["Sinhala", "Tamil"] as const;

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
  return ALLOWED_EDUCATION_MEDIUMS.includes(medium as (typeof ALLOWED_EDUCATION_MEDIUMS)[number]);
}

export function isG1EligibleDob(dateOfBirth: string | undefined): boolean {
  return Boolean(dateOfBirth?.trim()) && dateOfBirth!.trim() <= G1_DOB_CUTOFF();
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
  duplicateBirthCertificate?: boolean;
  applicant?: ApplicantValues;
  guardian?: { relationship?: string; fullName?: string; nic?: string; phone?: string };
  declaration?: { confirmed?: boolean; consent?: boolean };
};

export function getNextStepReason(deps: NextStepDeps): string {
  const { step } = deps;
  if (step === 0) {
    if (!locationIsReady(deps.location))
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
      !isG1EligibleDob(applicant.dateOfBirth) ||
      !applicant.birthCertificateNumber ||
      !applicant.fullName ||
      !applicant.educationMedium
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
    if (!deps.declaration?.confirmed || !deps.declaration?.consent)
      return "You must confirm the declaration and provide consent to proceed.";
    return "";
  }
  return "";
}
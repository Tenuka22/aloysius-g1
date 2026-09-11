import { z } from "zod";
import { g1DobEligibilityMessage, isG1EligibleDob, nicRegex } from "./eligibility";
import { CATEGORY_TYPES } from "./application-store";

export const applicantStepSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  sinhalaName: z.string().optional(),
  gender: z.enum(["Female", "Male"], { message: "Gender is required" }),
  // "Hindu" sits alongside the other four - the admission-eligibility logic in
  // eligibility.ts already treats "Hindu" as unrestricted, so this enum was the
  // only place a Hindu applicant was actually blocked from completing step 1.
  religion: z.enum(["Catholic", "Christian", "Buddhist", "Islam", "Hindu"], { message: "Religion is required" }),
  educationMedium: z.enum(["Sinhala", "Tamil"], { message: "Education medium is required" }),
  dateOfBirth: z
    .string()
    .min(1, "Date of birth is required")
    .refine((val) => isG1EligibleDob(val), g1DobEligibilityMessage()),
  birthCertificateNumber: z.string().min(1, "Birth certificate number is required"),
});

export const guardianStepSchema = z.object({
  relationship: z.enum(["Mother", "Father", "Guardian"], { message: "Relationship is required" }),
  fullName: z.string().min(1, "Full name is required"),
  nic: z
    .string()
    .min(1, "NIC number is required")
    .refine((val) => nicRegex.test(val), "Enter a valid Sri Lankan NIC: 9 digits followed by V/X, or 12 digits"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().optional().refine((val) => !val || /^\S+@\S+\.\S+$/.test(val), "Enter a valid email address"),
});

export const residenceStepSchema = z.object({
  permanentAddressEn: z.string().min(1, "Permanent address (English) is required"),
  permanentAddressSi: z.string().optional(),
  currentAddressEn: z.string().min(1, "Current address (English) is required"),
  currentAddressSi: z.string().optional(),
  sameAsPermanent: z.boolean().optional(),
  district: z.string().min(1, "District is required"),
  dsDivision: z.string().min(1, "Divisional Secretariat division is required"),
  gnDivision: z.string().min(1, "Grama Niladhari division is required"),
  electoralDistrict: z.string().min(1, "Electoral district is required"),
});

export const declarationStepSchema = z.object({
  confirmed: z.literal(true, { message: "You must confirm the information is accurate" }),
  consent: z.literal(true, { message: "You must consent to the information being used" }),
});

export const scoringInputsSchema = z.object({
  mainDocumentType: z.string().optional(),
  documentOwnership: z.string().optional(),
  deedTransferDate: z.string().optional(),
  additionalDocs: z.array(z.string()).optional(),
  electoralMotherSince: z.coerce.number().optional(),
  electoralFatherSince: z.coerce.number().optional(),
  schoolsWithinRadius: z.array(z.string()).optional(),
  schoolsRadiusKm: z.coerce.number().positive("School radius must be greater than zero").optional(),
  serviceStartDate: z.string().optional(),
  difficultServiceType: z.enum(["current", "previous", "none"]).optional(),
  difficultServiceDistanceKm: z.coerce.number().optional(),
  difficultServiceExtraPeriods: z.coerce.number().optional(),
  unutilizedLeaveYears: z.coerce.number().optional(),
  serviceLocationLevel: z.string().optional(),
  residenceToSchoolKm: z.coerce.number().optional(),
  workplaceToSchoolKm: z.coerce.number().optional(),
  previousWorkplaceDistanceKm: z.coerce.number().optional(),
  previousWorkplaceStartDate: z.string().optional(),
  transferDate: z.string().optional(),
  abroadStartDate: z.string().optional(),
  abroadEndDate: z.string().optional(),
  employmentPurpose: z.enum(["board", "personal", "government", "education"]).optional(),
  alumniStartDate: z.string().optional(),
  alumniEndDate: z.string().optional(),
  grade5ScholarshipPassed: z.boolean().optional(),
  olSubjectCount: z.union([z.literal(6), z.literal(8), z.literal(9)]).optional(),
  olGradeS: z.coerce.number().optional(),
  olGradeC: z.coerce.number().optional(),
  olGradeB: z.coerce.number().optional(),
  olGradeA: z.coerce.number().optional(),
  alSubjectCount: z.union([z.literal(3), z.literal(4)]).optional(),
  alGradeS: z.coerce.number().optional(),
  alGradeC: z.coerce.number().optional(),
  alGradeB: z.coerce.number().optional(),
  alGradeA: z.coerce.number().optional(),
  sportsLevel: z.enum(["none", "inter-house", "zonal", "district", "provincial", "national", "international"]).optional(),
  sportsCount: z.coerce.number().optional(),
  leadershipRole: z
    .enum([
      "none",
      "prefect-primary",
      "prefect-junior",
      "prefect-senior",
      "deputy-head-prefect",
      "head-prefect",
      "first-team-vice-captain",
      "first-team-captain",
    ])
    .optional(),
  siblingsCurrentlyStudyingCount: z.coerce.number().optional(),
  siblingStudiedAtAppliedSchool: z.boolean().optional(),
  twoOrMoreSiblingsApplying: z.boolean().optional(),
  siblingPrefectLevel: z.enum(["none", "inter-house", "zonal", "district", "provincial", "national", "international"]).optional(),
  siblingPrefectCount: z.coerce.number().optional(),
  siblingExamAchievement: z.enum(["none", "scholarship", "ol", "al"]).optional(),
  siblingPraiseworthyAchievement: z.boolean().optional(),
  parentsSupportRendered: z.boolean().optional(),
});

export const categoryApplicationSchema = z.object({
  id: z.string().min(1, "Category id is required"),
  categoryType: z.enum(CATEGORY_TYPES, { message: "Category type is invalid" }),
  scoringInputs: scoringInputsSchema,
});

export const categoriesSchema = z.array(categoryApplicationSchema).superRefine((categories, ctx) => {
  const seenIds = new Set<string>();
  categories.forEach((category, index) => {
    if (seenIds.has(category.id)) {
      ctx.addIssue({ code: "custom", message: "duplicate_category_ids", path: [index] });
      return;
    }
    seenIds.add(category.id);
  });
});

export const categoryStepSchema = z.object({
  categories: categoriesSchema.min(1, "select_at_least_one_category"),
});

export type ApplicantStepValues = z.infer<typeof applicantStepSchema>;
export type GuardianStepValues = z.infer<typeof guardianStepSchema>;
export type ResidenceStepValues = z.infer<typeof residenceStepSchema>;
export type DeclarationStepValues = z.infer<typeof declarationStepSchema>;
export type ScoringInputsValues = z.infer<typeof scoringInputsSchema>;
export type CategoryApplicationValues = z.infer<typeof categoryApplicationSchema>;
export type CategoriesValues = z.infer<typeof categoriesSchema>;
export type CategoryStepValues = z.infer<typeof categoryStepSchema>;

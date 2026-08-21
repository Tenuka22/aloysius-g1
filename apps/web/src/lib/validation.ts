import { z } from "zod";
import { G1_DOB_CUTOFF, g1SchoolYear, nicRegex } from "./eligibility";

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const applicantStepSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  sinhalaName: z.string().optional(),
  gender: z.enum(["Female", "Male"], { message: "Gender is required" }),
  religion: z.enum(["Catholic", "Christian", "Buddhist", "Islam"], { message: "Religion is required" }),
  educationMedium: z.enum(["Sinhala", "Tamil"], { message: "Education medium is required" }),
  dateOfBirth: z
    .string()
    .min(1, "Date of birth is required")
    .refine((val) => val <= G1_DOB_CUTOFF(), `The child must be at least five years old by 31 January ${g1SchoolYear()}`),
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
  permanentAddress: z.string().min(1, "Permanent address is required"),
  currentAddress: z.string().min(1, "Current address is required"),
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

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ApplicantStepValues = z.infer<typeof applicantStepSchema>;
export type GuardianStepValues = z.infer<typeof guardianStepSchema>;
export type ResidenceStepValues = z.infer<typeof residenceStepSchema>;
export type DeclarationStepValues = z.infer<typeof declarationStepSchema>;

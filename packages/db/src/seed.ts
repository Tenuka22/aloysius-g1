import { createHash } from "node:crypto";
import { applications } from "./schema/applications";
import { db } from "./index";
import { env } from "@aloysius-g1/env/server";

type SeedLocation = {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  source: "device" | "map";
};

type SeedApplication = {
  id: string;
  sessionCode: string;
  accessKey: string;
  birthCertificateNumber: string;
  applicant: {
    fullName: string;
    sinhalaName: string;
    gender: string;
    religion: string;
    educationMedium: string;
    dateOfBirth: string;
    birthCertificateNumber: string;
  };
  guardian: {
    relationship: string;
    fullName: string;
    sinhalaName: string;
    nic: string;
    phone: string;
    whatsappPhone: string;
    email: string;
  };
  residence: {
    permanentAddress: string;
    currentAddress: string;
    sameAsPermanent: boolean;
    district: string;
    dsDivision: string;
    gnDivision: string;
    electoralDistrict: string;
    districtSearch: string;
    dsSearch: string;
    gnSearch: string;
    electoralSearch: string;
  };
  selectedLocation: SeedLocation;
  defaultLocations: SeedLocation[];
  userLocationHistory: SeedLocation[];
  deviceLocationHistory: SeedLocation[];
  categories: Array<{ id: string; categoryType: "6.1" | "6.2" | "6.3" | "6.4" | "6.6"; scoringInputs: Record<string, unknown>; locked: boolean }>;
  admissionStatus: "pending" | "verified" | "fake";
  interviewNotes: string;
  isBanned: boolean;
  banReason: string | null;
};

const location = (label: string, address: string, latitude: number, longitude: number, source: SeedLocation["source"]): SeedLocation => ({ label, address, latitude, longitude, source });

const seedApplications: SeedApplication[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    sessionCode: "26SEE001",
    accessKey: "ALY-SEED-26SEE001-AMAYA-2026-LOCATION",
    birthCertificateNumber: "SEED-BC-001",
    applicant: { fullName: "Amaya Perera", sinhalaName: "අමයා පෙරේරා", gender: "Female", religion: "Buddhist", educationMedium: "Sinhala", dateOfBirth: "2019-01-14", birthCertificateNumber: "SEED-BC-001" },
    guardian: { relationship: "Mother", fullName: "Nimali Perera", sinhalaName: "නිමලි පෙරේරා", nic: "856789012V", phone: "+94771234567", whatsappPhone: "+94771234567", email: "nimali.seed@example.com" },
    residence: { permanentAddress: "12 Lighthouse Street, Galle", currentAddress: "12 Lighthouse Street, Galle", sameAsPermanent: true, district: "Galle", dsDivision: "Galle Four Gravets", gnDivision: "Fort", electoralDistrict: "Galle", districtSearch: "Galle", dsSearch: "Galle", gnSearch: "Fort", electoralSearch: "Galle" },
    selectedLocation: location("Selected home pin", "12 Lighthouse Street, Galle", 6.03241, 80.21692, "map"),
    defaultLocations: [location("Browser location at start", "Near Galle Fort", 6.03418, 80.21877, "device")],
    userLocationHistory: [location("Earlier selected pin", "18 Church Street, Galle", 6.03022, 80.21461, "map"), location("First selected pin", "Galle town", 6.03704, 80.22214, "map")],
    deviceLocationHistory: [location("Earlier device fix", "Near Galle bus stand", 6.03662, 80.21783, "device")],
    categories: [
      { id: "seed-001-6-1", categoryType: "6.1", scoringInputs: { mainDocumentType: "title-deed-parents", documentOwnership: "parent", deedTransferDate: "2018-02-10", additionalDocs: ["nic", "driving-license", "landline-bill"], electoralMotherSince: 2020, electoralFatherSince: 2021, schoolsWithinRadius: ["galle-fort"], schoolsRadiusKm: 2.5, residenceToSchoolKm: 0.8 }, locked: false },
      { id: "seed-001-6-3", categoryType: "6.3", scoringInputs: { siblingsCurrentlyStudyingCount: 1, siblingStudiedAtAppliedSchool: false, siblingExamAchievement: "scholarship", siblingPraiseworthyAchievement: false, twoOrMoreSiblingsApplying: false }, locked: false },
    ],
    admissionStatus: "pending",
    interviewNotes: "",
    isBanned: false,
    banReason: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    sessionCode: "26SEE002",
    accessKey: "ALY-SEED-26SEE002-KAVINDU-2026-LOCATION",
    birthCertificateNumber: "SEED-BC-002",
    applicant: { fullName: "Kavindu Silva", sinhalaName: "කවිඳු සිල්වා", gender: "Male", religion: "Buddhist", educationMedium: "English", dateOfBirth: "2019-03-20", birthCertificateNumber: "SEED-BC-002" },
    guardian: { relationship: "Father", fullName: "Ruwan Silva", sinhalaName: "රුවන් සිල්වා", nic: "821234567V", phone: "+94772345678", whatsappPhone: "+94772345678", email: "ruwan.seed@example.com" },
    residence: { permanentAddress: "45 Wakwella Road, Galle", currentAddress: "45 Wakwella Road, Galle", sameAsPermanent: true, district: "Galle", dsDivision: "Bope-Poddala", gnDivision: "Wakwella", electoralDistrict: "Galle", districtSearch: "Galle", dsSearch: "Bope", gnSearch: "Wakwella", electoralSearch: "Galle" },
    selectedLocation: location("Selected home pin", "45 Wakwella Road, Galle", 6.04591, 80.22704, "map"),
    defaultLocations: [location("Browser location at start", "Wakwella Road", 6.04482, 80.22572, "device")],
    userLocationHistory: [location("Earlier selected pin", "Wakwella junction", 6.04832, 80.22914, "map")],
    deviceLocationHistory: [location("Earlier device fix", "Near Wakwella", 6.04317, 80.22419, "device"), location("First device fix", "Galle", 6.04044, 80.22183, "device")],
    categories: [
      { id: "seed-002-6-4", categoryType: "6.4", scoringInputs: { serviceStartDate: "2014-06-01", difficultServiceType: "current", difficultServiceDistanceKm: 112, difficultServiceExtraPeriods: 2, unutilizedLeaveYears: 3, serviceLocationLevel: "divisional", residenceToSchoolKm: 4.2, workplaceToSchoolKm: 112, previousWorkplaceDistanceKm: 45 }, locked: true },
      { id: "seed-002-6-2", categoryType: "6.2", scoringInputs: { alumniStartDate: "2005-01-01", alumniEndDate: "2017-12-31", grade5ScholarshipPassed: true, olSubjectCount: 9, olGradeA: 3, olGradeB: 4, olGradeC: 2, alSubjectCount: 3, alGradeA: 1, alGradeB: 2, pastPupilsLifeMember: true, pastPupilsMembershipStart: "2018-01-01", pastPupilsCommitteeMember: false, pastPupilsExecutiveOffice: false }, locked: false },
    ],
    admissionStatus: "verified",
    interviewNotes: "Residence documents checked against the submitted address. Category 6.4 verified with service records.",
    isBanned: false,
    banReason: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    sessionCode: "26SEE003",
    accessKey: "ALY-SEED-26SEE003-NETHMI-2026-LOCATION",
    birthCertificateNumber: "SEED-BC-003",
    applicant: { fullName: "Nethmi Fernando", sinhalaName: "නෙත්මි ප්‍රනාන්දු", gender: "Female", religion: "Catholic", educationMedium: "Sinhala", dateOfBirth: "2018-11-07", birthCertificateNumber: "SEED-BC-003" },
    guardian: { relationship: "Guardian", fullName: "Madhavi Fernando", sinhalaName: "මාධවී ප්‍රනාන්දු", nic: "796543210V", phone: "+94773456789", whatsappPhone: "+94773456789", email: "madhavi.seed@example.com" },
    residence: { permanentAddress: "8 Temple Lane, Unawatuna", currentAddress: "8 Temple Lane, Unawatuna", sameAsPermanent: true, district: "Galle", dsDivision: "Habaraduwa", gnDivision: "Unawatuna", electoralDistrict: "Galle", districtSearch: "Galle", dsSearch: "Habaraduwa", gnSearch: "Unawatuna", electoralSearch: "Galle" },
    selectedLocation: location("Selected home pin", "8 Temple Lane, Unawatuna", 6.01072, 80.24931, "map"),
    defaultLocations: [location("Browser location at start", "Unawatuna", 6.01218, 80.25062, "device")],
    userLocationHistory: [location("Earlier selected pin", "Unawatuna beach road", 6.01496, 80.24881, "map")],
    deviceLocationHistory: [],
    categories: [
      { id: "seed-003-6-6", categoryType: "6.6", scoringInputs: { abroadStartDate: "2021-01-01", abroadEndDate: "2024-12-31", employmentPurpose: "personal" }, locked: false },
      { id: "seed-003-6-1", categoryType: "6.1", scoringInputs: { mainDocumentType: "lease-deed", documentOwnership: "parent", deedTransferDate: "2020-06-15", additionalDocs: ["nic", "bank-passbook"], schoolsWithinRadius: [], schoolsRadiusKm: 5, residenceToSchoolKm: 3.7 }, locked: false },
    ],
    admissionStatus: "fake",
    interviewNotes: "Seeded flagged record for testing the ban and review controls.",
    isBanned: true,
    banReason: "Seeded test record — do not contact.",
  },
];

if (env.NODE_ENV === "production") throw new Error("The local admissions seed is disabled in production.");

const now = new Date("2026-09-10T08:00:00.000Z");

for (const seed of seedApplications) {
  const selectedLocation = seed.selectedLocation;
  const data = {
    currentStep: 6,
    location: selectedLocation,
    defaultLocations: seed.defaultLocations,
    selectedLocation,
    applicant: seed.applicant,
    guardian: seed.guardian,
    residence: seed.residence,
    categories: seed.categories,
    userLocationHistory: seed.userLocationHistory,
    deviceLocationHistory: seed.deviceLocationHistory,
    declaration: { confirmed: true, consent: true },
  };
  await db.insert(applications).values({
    id: seed.id,
    sessionCode: seed.sessionCode,
    accessKeyHash: createHash("sha256").update(seed.accessKey).digest("hex"),
    accessKeyHint: seed.accessKey.slice(-6),
    birthCertificateNumber: seed.birthCertificateNumber,
    data,
    createdAt: new Date("2026-09-01T08:00:00.000Z"),
    updatedAt: now,
    submittedAt: new Date("2026-09-09T08:00:00.000Z"),
    admissionStatus: seed.admissionStatus,
    interviewNotes: seed.interviewNotes,
    isBanned: seed.isBanned,
    banReason: seed.banReason,
    admissionUpdatedAt: seed.admissionStatus === "pending" ? null : now,
  }).onConflictDoUpdate({
    target: applications.id,
    set: {
      sessionCode: seed.sessionCode,
      accessKeyHash: createHash("sha256").update(seed.accessKey).digest("hex"),
      accessKeyHint: seed.accessKey.slice(-6),
      birthCertificateNumber: seed.birthCertificateNumber,
      data,
      updatedAt: now,
      submittedAt: new Date("2026-09-09T08:00:00.000Z"),
      admissionStatus: seed.admissionStatus,
      interviewNotes: seed.interviewNotes,
      isBanned: seed.isBanned,
      banReason: seed.banReason,
      admissionUpdatedAt: seed.admissionStatus === "pending" ? null : now,
    },
  }).run();
  console.log(`Seeded ${seed.applicant.fullName} · session ${seed.sessionCode} · key ${seed.accessKey}`);
}

console.log(`Seeded ${seedApplications.length} submitted admissions records.`);

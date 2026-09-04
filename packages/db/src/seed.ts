import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { applications } from "./schema/applications";
import { applicationMarks } from "./schema/application-marks";
import { db } from "./index";
import { env } from "@aloysius-g1/env/server";

if (env.NODE_ENV === "production") throw new Error("The local admissions seed is disabled in production.");

// ── Helpers ──────────────────────────────────────────────────────────────────
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickN = <T>(arr: T[], n: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
};
const randDate = (startYear: number, endYear: number): string => {
  const y = randInt(startYear, endYear);
  const m = String(randInt(1, 12)).padStart(2, "0");
  const maxD = new Date(y, m, 0).getDate();
  const d = String(randInt(1, maxD)).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const randDateTime = (year: number, monthRange: [number, number]): Date => {
  const m = randInt(monthRange[0], monthRange[1]);
  const maxD = new Date(year, m, 0).getDate();
  const d = randInt(1, maxD);
  const h = randInt(6, 22);
  const min = randInt(0, 59);
  const s = randInt(0, 59);
  return new Date(year, m - 1, d, h, min, s);
};

// ── Name pools ───────────────────────────────────────────────────────────────
const maleFirst = ["Kavindu", "Tharindu", "Nipun", "Pasindu", "Dulaj", "Kusal", "Danushka", "Bhagya", "Ashan", "Ruwan", "Charith", "Madawa", "Nipuna", "Sachith", "Kanishka", "Dinesh", "Lakmal", "Supun", "Ishara", "Nuwan", "Amila", "Chanaka", "Dilshan", "Eranga", "Fazal", "Gayan", "Hashan", "Isuru", "Janaka", "Kasun"];
const femaleFirst = ["Nethmi", "Amaya", "Kavisha", "Tharushi", "Nipuni", "Pasindi", "Dulmi", "Kumudini", "Ashanthi", "Ruvini", "Chathurika", "Madushi", "Nipuni", "Sachini", "Kanchana", "Dilani", "Lakmali", "Supuni", "Ishani", "Nuwanthi", "Amali", "Chamari", "Dilhari", "Erandathi", "Fathima", "Gayanath", "Hasini", "Induni", "Jayani", "Kaluwila"];
const lastNames = ["Perera", "Silva", "Fernando", "de Silva", "Gamage", "Bandara", "Jayawardena", "Wickramasinghe", "Mendis", "Ratnayake", "Gunaratne", "Dissanayake", "Kumara", "Herath", "Wijesinghe", "Liyanage", "Ranasinghe", "Amarasinghe", "Samaraweera", "Weerasinghe", "Edirisinghe", "Senanayake", "Samararatne", "Ariyaratne", "Withanage"];
const sinhalaLast = ["පෙරේරා", "සිල්වා", "ප්‍රනාන්දු", "ද සිල්වා", "ගමගේ", "බණ්ඩාර", "ජයවර්ධන", "වික්‍රමසිංහ", "මෙන්ඩිස්", "රත්නායක", "ගුණරත්න", "දිසානායක", "කුමාර", "හේරත්", "විජේසිංහ"];
const religions = ["Buddhist", "Hindu", "Catholic", "Muslim", "Christian"];
const mediums = ["Sinhala", "English", "Tamil"];
const genders = ["Male", "Female"];
const relationships = ["Father", "Mother", "Guardian"];

// ── Location pools (Galle district) ──────────────────────────────────────────
const locations = [
  { label: "Galle Fort area", lat: 6.0324, lng: 80.2169, address: "Near Galle Fort, Galle" },
  { label: "Wakwella Road", lat: 6.0459, lng: 80.2270, address: "Wakwella Road, Galle" },
  { label: "Unawatuna", lat: 6.0107, lng: 80.2493, address: "Unawatuna, Galle" },
  { label: "Habaraduwa", lat: 6.0012, lng: 80.2645, address: "Habaraduwa, Galle" },
  { label: "Baddegama", lat: 6.1762, lng: 80.3831, address: "Baddegama, Galle" },
  { label: "Imaduwa", lat: 6.0721, lng: 80.3294, address: "Imaduwa, Galle" },
  { label: "Dodanduwa", lat: 6.0987, lng: 80.3012, address: "Dodanduwa, Galle" },
  { label: "Richmond Hill", lat: 6.0412, lng: 80.2201, address: "Richmond Hill, Galle" },
  { label: "Kalutara South", lat: 6.5848, lng: 79.9606, address: "Kalutara South, Kalutara" },
  { label: "Panadura", lat: 6.7132, lng: 79.9044, address: "Panadura, Kalutara" },
  { label: "Moratuwa", lat: 6.7730, lng: 79.8831, address: "Moratuwa, Colombo" },
  { label: "Mount Lavinia", lat: 6.8396, lng: 79.8637, address: "Mount Lavinia, Colombo" },
  { label: "Dehiwala", lat: 6.8512, lng: 79.8632, address: "Dehiwala, Colombo" },
  { label: "Ratnapura Town", lat: 6.6828, lng: 80.3992, address: "Ratnapura, Ratnapura" },
  { label: "Kurunegala Town", lat: 7.4864, lng: 80.3650, address: "Kurunegala, Kurunegala" },
  { label: "Matara Center", lat: 5.9549, lng: 80.5548, address: "Matara Center, Matara" },
  { label: "Tangalle Beach", lat: 6.0234, lng: 80.7922, address: "Tangalle, Hambantota" },
  { label: "Galle Road Colombo", lat: 6.8520, lng: 79.8600, address: "Galle Road, Colombo 03" },
  { label: "Kandy City", lat: 7.2906, lng: 80.6337, address: "Kandy City, Kandy" },
  { label: "Jaffna Town", lat: 9.6615, lng: 80.0255, address: "Jaffna Town, Jaffna" },
];

// ── School IDs for proximity ─────────────────────────────────────────────────
const schoolIds = ["st-aloysius-galle", "richmond-galle", "mahinda-galle", "riverside-galle", "sacred-heart-galle", "vladimir-galle", "holy-family-galle"];

// ── Document types ───────────────────────────────────────────────────────────
const docTypes61 = ["title-deed-applicant", "title-deed-parents", "feeder-electoral-5yrs", "lease-deed", "municipal-ds-certificate", "other-documents"];
const docTypes63 = ["title-deed-applicant-spouse", "title-deed-parents", "feeder-electoral-5yrs", "lease-deed", "municipal-ds-rentact-cert", "other-documents"];
const additionalDocsPool = ["nic", "driving-license", "landline-bill", "bank-passbook", "electricity-bill", "water-bill", "rental-agreement", "gas-bill", "telephone-bill", "gps-coordinates"];

const sportsLevels = ["inter-house", "zonal", "district", "provincial", "national", "international"];
const leadershipRoles = ["prefect-primary", "prefect-junior", "prefect-senior", "deputy-head-prefect", "head-prefect", "first-team-vice-captain", "first-team-captain"];
const societyRoles = ["committee-member", "vice-president", "president"];
const otherActivities = ["junior-band-leader", "junior-band-member", "scout-leader", "scout-member", "cub-scout", "cadet-team-leader", "cadet-team-member", "debating-team-leader", "debating-team-member"];
const degrees = ["first-degree", "postgraduate", "doctorate", "chartered-professional"];
const serviceLocations = ["national", "provincial", "divisional", "local", "rural"];
const difficultTypes = ["current", "previous", "none"];
const abroadPurposes = ["board", "personal", "government", "education"];
const prefectLevels = ["inter-house", "zonal", "district", "provincial", "national", "international"];
const examAchievements = ["scholarship", "ol", "al"];

// ── Scoring input generators ─────────────────────────────────────────────────
function gen61(): Record<string, unknown> {
  return {
    mainDocumentType: pick(docTypes61),
    documentOwnership: pick(["applicant", "parent"]),
    deedTransferDate: randDate(2015, 2024),
    additionalDocs: pickN(additionalDocsPool, randInt(0, 5)),
    electoralMotherSince: randInt(2015, 2024),
    electoralFatherSince: randInt(2015, 2024),
    schoolsWithinRadius: pickN(schoolIds, randInt(0, 4)),
    schoolsRadiusKm: Math.round(Math.random() * 8 * 10) / 10,
    residenceToSchoolKm: Math.round(Math.random() * 15 * 10) / 10,
  };
}

function gen62(): Record<string, unknown> {
  const olCount = pick([6, 8, 9]);
  const alCount = pick([3, 4]);
  return {
    alumniStartDate: randDate(2005, 2012),
    alumniEndDate: randDate(2014, 2022),
    grade5ScholarshipPassed: Math.random() > 0.5,
    olSubjectCount: olCount,
    olGradeA: randInt(0, olCount),
    olGradeB: randInt(0, olCount),
    olGradeC: randInt(0, olCount),
    olGradeS: randInt(0, 3),
    alSubjectCount: alCount,
    alGradeA: randInt(0, alCount),
    alGradeB: randInt(0, alCount),
    alGradeC: randInt(0, alCount),
    alGradeS: randInt(0, 2),
    sportsLevel: pick(sportsLevels),
    sportsCount: randInt(0, 4),
    leadershipRole: pick(leadershipRoles),
    studentSocietiesRole: pick(societyRoles),
    otherActivity: pick(otherActivities),
    pastPupilsLifeMember: Math.random() > 0.6,
    pastPupilsMembershipStart: randDate(2018, 2024),
    pastPupilsMembershipEnd: randDate(2024, 2026),
    pastPupilsCommitteeMember: Math.random() > 0.7,
    pastPupilsExecutiveOffice: Math.random() > 0.85,
    highestDegree: pick(degrees),
    hasDiploma: Math.random() > 0.6,
    sportsMeetContribution: Math.random() > 0.5,
    shramadanaContribution: Math.random() > 0.5,
    schoolProjectsContribution: Math.random() > 0.6,
  };
}

function gen63(): Record<string, unknown> {
  return {
    siblingsCurrentlyStudyingCount: randInt(0, 3),
    siblingStudiedAtAppliedSchool: Math.random() > 0.7,
    twoOrMoreSiblingsApplying: Math.random() > 0.85,
    siblingPrefectLevel: pick(prefectLevels),
    siblingPrefectCount: randInt(0, 2),
    siblingExamAchievement: pick(examAchievements),
    siblingPraiseworthyAchievement: Math.random() > 0.7,
    parentsSupportRendered: Math.random() > 0.6,
    mainDocumentType: pick(docTypes63),
    documentOwnership: pick(["applicant", "parent", "spouse"]),
    deedTransferDate: randDate(2015, 2024),
    additionalDocs: pickN(additionalDocsPool, randInt(0, 3)),
    electoralMotherSince: randInt(2015, 2024),
    electoralFatherSince: randInt(2015, 2024),
    schoolsWithinRadius: pickN(schoolIds, randInt(0, 3)),
    schoolsRadiusKm: Math.round(Math.random() * 8 * 10) / 10,
    residenceToSchoolKm: Math.round(Math.random() * 15 * 10) / 10,
  };
}

function gen64(): Record<string, unknown> {
  const diffType = pick(difficultTypes);
  return {
    serviceStartDate: randDate(2010, 2022),
    difficultServiceType: diffType,
    difficultServiceDistanceKm: diffType === "previous" ? randInt(30, 200) : undefined,
    difficultServiceExtraPeriods: diffType === "previous" ? randInt(0, 4) : undefined,
    unutilizedLeaveYears: randInt(0, 5),
    serviceLocationLevel: pick(serviceLocations),
    residenceToSchoolKm: Math.round(Math.random() * 15 * 10) / 10,
    workplaceToSchoolKm: Math.round(Math.random() * 150 * 10) / 10,
  };
}

function gen65(): Record<string, unknown> {
  return {
    previousWorkplaceDistanceKm: Math.round((20 + Math.random() * 180) * 10) / 10,
    serviceStartDate: randDate(2010, 2020),
    previousWorkplaceStartDate: randDate(2010, 2018),
    transferDate: randDate(2018, 2025),
    unutilizedLeaveYears: randInt(0, 4),
    schoolsWithinRadius: pickN(schoolIds, randInt(0, 3)),
    schoolsRadiusKm: Math.round(Math.random() * 8 * 10) / 10,
    residenceToSchoolKm: Math.round(Math.random() * 15 * 10) / 10,
  };
}

function gen66(): Record<string, unknown> {
  const start = randDate(2018, 2022);
  const end = randDate(2023, 2026);
  return {
    abroadStartDate: start,
    abroadEndDate: end,
    employmentPurpose: pick(abroadPurposes),
    schoolsWithinRadius: pickN(schoolIds, randInt(0, 2)),
    schoolsRadiusKm: Math.round(Math.random() * 8 * 10) / 10,
    residenceToSchoolKm: Math.round(Math.random() * 15 * 10) / 10,
  };
}

const categoryGenerators: Record<string, () => Record<string, unknown>> = {
  "6.1": gen61,
  "6.2": gen62,
  "6.3": gen63,
  "6.4": gen64,
  "6.5": gen65,
  "6.6": gen66,
};

// ── Application generator ────────────────────────────────────────────────────
function generateApplication(index: number, intakeYear: string) {
  const gender = pick(genders);
  const firstName = gender === "Male" ? pick(maleFirst) : pick(femaleFirst);
  const lastName = pick(lastNames);
  const sinhlastName = pick(sinhalaLast);
  const fullName = `${firstName} ${lastName}`;
  const loc = pick(locations);

  // Category assignment: everyone gets 6.1 + one other, some get two
  const primaryCat = pick(["6.1", "6.2", "6.3", "6.4", "6.5", "6.6"] as const);
  const secondaryCats = pickN(["6.1", "6.2", "6.3", "6.4", "6.5", "6.6"].filter((c) => c !== primaryCat), randInt(0, 2));
  const catTypes = [primaryCat, ...secondaryCats];
  const categories = catTypes.map((ct) => ({
    id: `seed-${String(index).padStart(3, "0")}-${ct}`,
    categoryType: ct as "6.1" | "6.2" | "6.3" | "6.4" | "6.5" | "6.6",
    scoringInputs: categoryGenerators[ct](),
    locked: Math.random() > 0.5,
  }));

  const isDraft = Math.random() < 0.15;
  const admissionStatus = pick(["pending", "pending", "pending", "pending", "verified", "verified", "fake"] as const);
  const isBanned = admissionStatus === "fake" && Math.random() > 0.5;
  const intakeNum = Number(intakeYear);
  const createdAt = randDateTime(intakeNum - 1, [1, 6]);
  const updatedAt = new Date(createdAt.getTime() + randInt(1, 72) * 3600000);
  const submittedAt = isDraft ? null : new Date(updatedAt.getTime() + randInt(1, 48) * 3600000);

  const accessKey = `ALY-SEED-${String(index).padStart(3, "0")}-${firstName.toUpperCase()}-${intakeYear}-TEST`;
  const sessionCode = `${intakeYear.slice(-2)}S${String(index).padStart(4, "0")}`;
  const bcNum = `SEED-BC-${String(index).padStart(4, "0")}`;

  const locHistLen = randInt(0, 3);
  const deviceHistLen = randInt(0, 2);

  return {
    id: randomUUID(),
    sessionCode,
    accessKey,
    accessKeyHint: accessKey.slice(-6),
    birthCertificateNumber: bcNum,
    intakeYear,
    data: {
      currentStep: 6,
      location: { label: loc.label, address: loc.address, latitude: loc.lat, longitude: loc.lng, source: "map" },
      defaultLocations: [{ label: "Browser location", address: loc.address, latitude: loc.lat + (Math.random() - 0.5) * 0.01, longitude: loc.lng + (Math.random() - 0.5) * 0.01, source: "device" }],
      selectedLocation: { label: "Selected home pin", address: loc.address, latitude: loc.lat, longitude: loc.lng, source: "map" },
      applicant: {
        fullName,
        sinhalaName: `${firstName} ${sinhlastName}`,
        gender,
        religion: pick(religions),
        educationMedium: pick(mediums),
        dateOfBirth: randDate(2018, 2020),
        birthCertificateNumber: bcNum,
      },
      guardian: {
        relationship: pick(relationships),
        fullName: `${pick(gender === "Male" ? femaleFirst : maleFirst)} ${lastName}`,
        sinhalaName: `${pick(maleFirst)} ${sinhlastName}`,
        nic: `${randInt(700000000, 999999999)}V`,
        phone: `+9477${String(randInt(1000000, 9999999))}`,
        whatsappPhone: `+9477${String(randInt(1000000, 9999999))}`,
        email: `${firstName.toLowerCase()}.${(lastName ?? "").toLowerCase().replace(/\s/g, "")}@seed.example.com`,
      },
      residence: {
        permanentAddress: `${randInt(1, 200)} ${pick(["Temple", "Church", "Lake", "Garden", "Hill", "Park", "River", "Road", "Street", "Lane"])} ${pick(["Road", "Street", "Lane", "Place"])}, ${loc.address.split(",").pop()?.trim() ?? "Galle"}`,
        currentAddress: `${randInt(1, 200)} ${pick(["Temple", "Church", "Lake", "Garden", "Hill", "Park", "River", "Road", "Street", "Lane"])} ${pick(["Road", "Street", "Lane", "Place"])}, ${loc.address.split(",").pop()?.trim() ?? "Galle"}`,
        sameAsPermanent: Math.random() > 0.3,
        district: pick(["Galle", "Matara", "Hambantota", "Colombo", "Kalutara", "Kandy"]),
        dsDivision: pick(["Galle Four Gravets", "Bope-Poddala", "Habaraduwa", "Baddegama", "Imaduwa", "Dodanduwa"]),
        gnDivision: pick(["Fort", "Wakwella", "Unawatuna", "Ratgama", "Nagoda", "Talpe"]),
        electoralDistrict: pick(["Galle", "Matara", "Colombo", "Kalutara"]),
        districtSearch: "Galle",
        dsSearch: "Galle",
        gnSearch: "Fort",
        electoralSearch: "Galle",
      },
      categories,
      userLocationHistory: Array.from({ length: locHistLen }, (_, i) => ({
        label: `Earlier pin ${i + 1}`,
        address: `${randInt(1, 100)} Side Street, Galle`,
        latitude: loc.lat + (Math.random() - 0.5) * 0.02,
        longitude: loc.lng + (Math.random() - 0.5) * 0.02,
        source: "map" as const,
      })),
      deviceLocationHistory: Array.from({ length: deviceHistLen }, (_, i) => ({
        label: `Device fix ${i + 1}`,
        address: `Device location ${i + 1}`,
        latitude: loc.lat + (Math.random() - 0.5) * 0.015,
        longitude: loc.lng + (Math.random() - 0.5) * 0.015,
        source: "device" as const,
      })),
      declaration: { confirmed: true, consent: true },
    },
    createdAt,
    updatedAt,
    submittedAt,
    admissionStatus,
    interviewNotes: isBanned ? "Seeded test record for ban testing." : "",
    isBanned,
    banReason: isBanned ? "Seeded test record — do not contact." : null,
  };
}

// ── Main seed ────────────────────────────────────────────────────────────────
console.log("Seeding 100 applications across all sectors...\n");

const seedApps = Array.from({ length: 100 }, (_, i) => {
  const intakeYear = i < 70 ? "2027" : "2026";
  return generateApplication(i + 1, intakeYear);
});

// Insert applications
for (const app of seedApps) {
  const { accessKey, ...rest } = app;
  await db.insert(applications).values({
    ...rest,
    accessKeyHash: createHash("sha256").update(accessKey).digest("hex"),
    accessKeyHint: rest.accessKeyHint,
  }).onConflictDoUpdate({
    target: applications.id,
    set: {
      sessionCode: rest.sessionCode,
      accessKeyHash: createHash("sha256").update(accessKey).digest("hex"),
      accessKeyHint: rest.accessKeyHint,
      birthCertificateNumber: rest.birthCertificateNumber,
      intakeYear: rest.intakeYear,
      data: rest.data,
      updatedAt: rest.updatedAt,
      submittedAt: rest.submittedAt,
      admissionStatus: rest.admissionStatus,
      interviewNotes: rest.interviewNotes,
      isBanned: rest.isBanned,
      banReason: rest.banReason,
      admissionUpdatedAt: rest.submittedAt ? rest.updatedAt : null,
    },
  }).run();

  // Generate indicative marks for submitted applications
  if (rest.submittedAt) {
    const cats = (rest.data as { categories: Array<{ categoryType: string; scoringInputs: Record<string, unknown> }> }).categories;
    for (const cat of cats) {
      const total = randInt(20, 95);
      const breakdown = Array.from({ length: randInt(3, 6) }, (_, i) => ({
        label: `Component ${i + 1}`,
        marks: Math.floor(total / (randInt(3, 6))),
        max: 30,
      }));
      // Normalize breakdown to sum to total
      const sum = breakdown.reduce((s, r) => s + r.marks, 0);
      if (breakdown.length > 0) breakdown[0].marks += total - sum;

      await db.insert(applicationMarks).values({
        id: randomUUID(),
        applicationId: app.id,
        categoryType: cat.categoryType,
        breakdown,
        total,
        createdAt: rest.submittedAt ? new Date(rest.submittedAt.getTime() + randInt(1, 168) * 3600000) : rest.updatedAt,
        updatedAt: rest.updatedAt,
      }).onConflictDoNothing().run();
    }
  }
}

// Summary
const submitted2027 = seedApps.filter((a) => a.intakeYear === "2027" && a.submittedAt).length;
const drafts2027 = seedApps.filter((a) => a.intakeYear === "2027" && !a.submittedAt).length;
const submitted2026 = seedApps.filter((a) => a.intakeYear === "2026" && a.submittedAt).length;
const drafts2026 = seedApps.filter((a) => a.intakeYear === "2026" && !a.submittedAt).length;

console.log(`Seeded ${seedApps.length} applications:`);
console.log(`  2027 intake: ${submitted2027} submitted, ${drafts2027} drafts`);
console.log(`  2026 intake: ${submitted2026} submitted, ${drafts2026} drafts`);
console.log(`  Admission: ${seedApps.filter((a) => a.admissionStatus === "pending").length} pending, ${seedApps.filter((a) => a.admissionStatus === "verified").length} verified, ${seedApps.filter((a) => a.admissionStatus === "fake").length} fake`);
console.log(`  Banned: ${seedApps.filter((a) => a.isBanned).length}`);
const allCats = [...new Set(seedApps.flatMap((a) => (a.data as { categories: Array<{ categoryType: string }> }).categories.map((c) => c.categoryType)))].sort().join(", ");
console.log(`  Categories covered: ${allCats}`);
console.log("\nAccess keys are in the format: ALY-SEED-XXX-NAME-YEAR-TEST");
console.log("All applications are in the Galle / Kalutara / Colombo area.");

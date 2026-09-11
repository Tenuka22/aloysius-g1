import { create } from "zustand";

export type LocationDraft = {
  id?: string;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  source: "manual" | "device" | "map" | "network" | "admin" | "";
};

/**
 * Lifecycle of a field the applicant is allowed to defer.
 *
 * A boolean could not tell "not reached yet" apart from "deliberately
 * skipped", so the UI could not show a skip as outstanding without also
 * flagging every untouched field.
 */
export const FIELD_STATUSES = ["pending", "skipped", "provided"] as const;
export type FieldStatus = (typeof FIELD_STATUSES)[number];

export const CATEGORY_TYPES = ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export type SportsEntry = { name?: string; levels?: string[] };
export type SocietyEntry = { name?: string; roles?: string[] };

export type ScoringInputs = {
  mainDocumentType?: string;
  documentOwnership?: string;
  deedTransferDate?: string;
  additionalDocs?: string[];
  electoralMotherYears?: number[];
  electoralFatherYears?: number[];
  schoolsWithinRadius?: string[];
  schoolsRadiusKm?: number;
  serviceStartDate?: string;
  difficultServiceType?: "current" | "previous" | "none";
  difficultServiceStartDate?: string;
  difficultServicePreviousStartDate?: string;
  difficultServicePreviousEndDate?: string;
  difficultServiceDistanceStartDate?: string;
  difficultServiceDistanceEndDate?: string;
  difficultServiceDistanceKm?: number;
  unutilizedLeaveYears?: number;
  contributionPath?: "institution" | "university";
  contributionSameSchool?: boolean;
  contributionServiceStartDate?: string;
  contributionExamYears?: number;
  contributionCurriculumYears?: number;
  contributionTrainingYears?: number;
  residenceToSchoolKm?: number;
  workplaceToSchoolKm?: number;
  previousWorkplaceDistanceKm?: number;
  previousWorkplaceStartDate?: string;
  transferDate?: string;
  abroadStartDate?: string;
  abroadEndDate?: string;
  employmentPurpose?: "diplomatic" | "government" | "education" | "employment";
  alumniStartDate?: string;
  alumniEndDate?: string;
  grade5ScholarshipPassed?: boolean;
  olSubjectCount?: number;
  olGradeS?: number;
  olGradeC?: number;
  olGradeB?: number;
  olGradeA?: number;
  alSubjectCount?: number;
  alGradeS?: number;
  alGradeC?: number;
  alGradeB?: number;
  alGradeA?: number;
  sportsEntries?: SportsEntry[];
  leadershipRoles?: string[];
  studentSocietiesEntries?: SocietyEntry[];
  otherActivities?: string[];
  otherActivityName?: string;
  pastPupilsLifeMember?: boolean;
  pastPupilsLifeMemberStart?: string;
  pastPupilsMembershipStart?: string;
  pastPupilsMembershipEnd?: string;
  pastPupilsCommitteeYears?: number;
  pastPupilsExecutiveCount?: number;
  highestDegree?: string;
  hasDiploma?: boolean;
  sportsMeetContribution?: number;
  shramadanaContribution?: number;
  schoolProjectsContribution?: boolean;
  schoolProjectsDescription?: string;
  siblingGradesCompletedCount?: number;
  siblingStudiedAtAppliedSchool?: boolean;
  twoOrMoreSiblingsStudyingOtherGrades?: boolean;
  siblingSportsEntries?: SportsEntry[];
  siblingExamAchievements?: string[];
  siblingLeadershipAchievement?: boolean;
  parentsSupportRendered?: boolean;
  parentsSupportDescription?: string;
};

export type CategoryApplication = {
  id: string;
  categoryType: CategoryType;
  scoringInputs: ScoringInputs;
  locked: boolean;
};

export type ApplicationDraft = {
  currentStep: number;
  maxVisitedStep: number;
  location: LocationDraft;
  defaultLocations: LocationDraft[];
  selectedLocation: LocationDraft;
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
    permanentAddressEn: string;
    permanentAddressSi: string;
    currentAddressEn: string;
    currentAddressSi: string;
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
  declaration: { confirmed: boolean; consent: boolean };
  categories: CategoryApplication[];
  deviceLocationHistory: LocationDraft[];
  userLocationHistory: LocationDraft[];
  lastSavedAt: string | null;
  accessKey: string;
  sessionCode: string;
  duplicateBirthCertificate: boolean;
  locationCanProceed: boolean;
  locationStatus: FieldStatus;
  birthCertificateStatus: FieldStatus;
  submittedAt: string | null;
  submissionLocked: boolean;
  submissionOpensAt: string;
  submissionClosesAt: string;
  saveStatus: string;
  submitError: string;
  isSubmitting: boolean;
  copiedField: string | null;
  showSubmissionRequest: boolean;
  requestName: string;
  requestPhone: string;
  requestSaving: boolean;
  bcDialogOpen: boolean;
  bcApplicantName: string;
  bcGuardianName: string;
  bcContactPhone: string;
  bcRequestState: string;
  districtSearch: string;
  dsSearch: string;
  gnSearch: string;
  electoralSearch: string;
  interviewEdits: InterviewEdit[];
  admissionStatus: string;
  interviewNotes: string;
  isBanned: boolean;
  banReason: string | null;
  flags: Array<{ type: string; key: string; label: string }>;
  clearDraftDialogOpen: boolean;
};

export type InterviewEdit = {
  field: string;
  label: string;
  previousValue: string;
  newValue: string;
  editedAt: string;
};

export const emptyDraft: ApplicationDraft = {
  currentStep: 0,
  maxVisitedStep: 0,
  location: { label: "", address: "", latitude: null, longitude: null, source: "" },
  defaultLocations: [],
  selectedLocation: { label: "", address: "", latitude: null, longitude: null, source: "" },
  applicant: { fullName: "", sinhalaName: "", gender: "", religion: "", educationMedium: "", dateOfBirth: "", birthCertificateNumber: "" },
  guardian: { relationship: "", fullName: "", sinhalaName: "", nic: "", phone: "", whatsappPhone: "", email: "" },
  // sameAsPermanent defaults true: only the permanent address is shown until
  // the applicant says the current address differs.
  residence: { permanentAddressEn: "", permanentAddressSi: "", currentAddressEn: "", currentAddressSi: "", sameAsPermanent: true, district: "", dsDivision: "", gnDivision: "", electoralDistrict: "", districtSearch: "", dsSearch: "", gnSearch: "", electoralSearch: "" },
  declaration: { confirmed: false, consent: false },
  categories: [],
  deviceLocationHistory: [],
  userLocationHistory: [],
  lastSavedAt: null,
  accessKey: "",
  sessionCode: "",
  duplicateBirthCertificate: false,
  locationCanProceed: false,
  locationStatus: "pending",
  birthCertificateStatus: "pending",
  submittedAt: null,
  submissionLocked: false,
  submissionOpensAt: "",
  submissionClosesAt: "",
  saveStatus: "",
  submitError: "",
  isSubmitting: false,
  copiedField: null,
  showSubmissionRequest: false,
  requestName: "",
  requestPhone: "",
  requestSaving: false,
  bcDialogOpen: false,
  bcApplicantName: "",
  bcGuardianName: "",
  bcContactPhone: "",
  bcRequestState: "",
  districtSearch: "",
  dsSearch: "",
  gnSearch: "",
  electoralSearch: "",
  interviewEdits: [],
  admissionStatus: "pending",
  interviewNotes: "",
  isBanned: false,
  banReason: null,
  flags: [],
  clearDraftDialogOpen: false,
};

export const LOCATION_HISTORY_LIMIT = 25;

function normalizeLocationHistory(input: unknown): LocationDraft[] {
  if (!Array.isArray(input)) return [];
  const history: LocationDraft[] = [];
  for (const entry of input) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as Record<string, unknown>;
    const latitude = typeof candidate.latitude === "number" ? candidate.latitude : undefined;
    const longitude = typeof candidate.longitude === "number" ? candidate.longitude : undefined;
    if (latitude == null || longitude == null) continue;
    history.push({
      id: typeof candidate.id === "string" ? candidate.id : undefined,
      label: typeof candidate.label === "string" ? candidate.label : "",
      address: typeof candidate.address === "string" ? candidate.address : "",
      latitude,
      longitude,
      source: typeof candidate.source === "string" && ["manual", "device", "map", "network", "admin"].includes(candidate.source) ? (candidate.source as LocationDraft["source"]) : "map",
    });
    if (history.length >= LOCATION_HISTORY_LIMIT) break;
  }
  return history;
}

export function prependLocationHistory(list: LocationDraft[], entry: LocationDraft): LocationDraft[] {
  const head = list[0];
  if (head && head.latitude === entry.latitude && head.longitude === entry.longitude) return list;
  return [entry, ...list].slice(0, LOCATION_HISTORY_LIMIT);
}

export function applyLocationChange(
  draft: Pick<ApplicationDraft, "deviceLocationHistory" | "userLocationHistory" | "defaultLocations">,
  value: LocationDraft,
  defaultValue?: LocationDraft,
): Pick<ApplicationDraft, "deviceLocationHistory" | "userLocationHistory" | "defaultLocations"> {
  let deviceLocationHistory = draft.deviceLocationHistory;
  let userLocationHistory = draft.userLocationHistory;
  let defaultLocations = draft.defaultLocations;
  if (defaultValue) {
    deviceLocationHistory = prependLocationHistory(deviceLocationHistory, defaultValue);
    if (defaultValue.latitude != null && defaultValue.longitude != null) {
      defaultLocations = prependLocationHistory(defaultLocations, defaultValue);
    }
  }
  if (value.latitude != null && value.longitude != null) {
    userLocationHistory = prependLocationHistory(userLocationHistory, value);
  }
  return { deviceLocationHistory, userLocationHistory, defaultLocations };
}

export function createCategory(categoryType: CategoryType, existingCount = 0): CategoryApplication {
  const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${categoryType}-${existingCount}`;
  return { id, categoryType, scoringInputs: {}, locked: false };
}

export function normalizeCategories(input: unknown): CategoryApplication[] {
  if (!Array.isArray(input)) return [];
  const seenIds = new Set<string>();
  const categories: CategoryApplication[] = [];
  for (const [index, entry] of input.entries()) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as Record<string, unknown>;
    const categoryType = candidate["categoryType"];
    if (typeof categoryType !== "string" || !(CATEGORY_TYPES as readonly string[]).includes(categoryType)) continue;
    let id = typeof candidate["id"] === "string" && candidate["id"] !== "" ? candidate["id"] : `${categoryType}-${index}`;
    if (seenIds.has(id)) id = `${categoryType}-${categories.length}-${index}`;
    seenIds.add(id);
    const rawScoringInputs = candidate["scoringInputs"];
    const scoringInputs =
      typeof rawScoringInputs === "object" && rawScoringInputs !== null && !Array.isArray(rawScoringInputs)
        ? ({ ...(rawScoringInputs as ScoringInputs) } as ScoringInputs)
        : {};
    categories.push({ id, categoryType: categoryType as CategoryType, scoringInputs, locked: candidate["locked"] === true });
  }
  return categories;
}

/**
 * Resolves the stored status against the value actually present.
 *
 * A skip is sticky: once recorded, it stays "skipped" even after the
 * applicant later fills the value in, so the Declaration step keeps
 * surfacing it for review instead of the field silently disappearing the
 * moment a value is typed. Everything else falls back on the value actually
 * present - including for drafts saved before this was an enum, which
 * carried only a `*Skipped` boolean.
 */
function toFieldStatus(stored: unknown, legacySkipped: boolean, hasValue: boolean): FieldStatus {
  if (stored === "skipped" || legacySkipped) return "skipped";
  if (hasValue) return "provided";
  return "pending";
}

export function normalizeDraft(input: Partial<ApplicationDraft> | null | undefined): ApplicationDraft {
  const raw = input as Record<string, unknown> | null | undefined;
  let defaultLocations: LocationDraft[] = Array.isArray(input?.defaultLocations) ? normalizeLocationHistory(input?.defaultLocations) : [];
  if (defaultLocations.length === 0 && raw && typeof raw["defaultLocation"] === "object" && raw["defaultLocation"] !== null && !Array.isArray(raw["defaultLocation"])) {
    const loc = raw["defaultLocation"] as Partial<LocationDraft>;
    if (typeof loc.latitude === "number" && typeof loc.longitude === "number") {
      defaultLocations = [{ label: typeof loc.label === "string" ? loc.label : "", address: typeof loc.address === "string" ? loc.address : "", latitude: loc.latitude, longitude: loc.longitude, source: typeof loc.source === "string" && ["manual", "device", "map", "network"].includes(loc.source) ? (loc.source as LocationDraft["source"]) : "device" }];
    }
  }
  // Coerce applicant fields to their declared types to prevent crashes from malformed server data
  const applicantInput = input?.applicant as Record<string, unknown> | undefined;
  const normalizedApplicant = {
    ...emptyDraft.applicant,
    ...input?.applicant,
    fullName: typeof applicantInput?.fullName === "string" ? applicantInput.fullName : emptyDraft.applicant.fullName,
    sinhalaName: typeof applicantInput?.sinhalaName === "string" ? applicantInput.sinhalaName : emptyDraft.applicant.sinhalaName,
    gender: typeof applicantInput?.gender === "string" ? applicantInput.gender : emptyDraft.applicant.gender,
    religion: typeof applicantInput?.religion === "string" ? applicantInput.religion : emptyDraft.applicant.religion,
    educationMedium: typeof applicantInput?.educationMedium === "string" ? applicantInput.educationMedium : emptyDraft.applicant.educationMedium,
    dateOfBirth: typeof applicantInput?.dateOfBirth === "string" ? applicantInput.dateOfBirth : emptyDraft.applicant.dateOfBirth,
    birthCertificateNumber: typeof applicantInput?.birthCertificateNumber === "string" ? applicantInput.birthCertificateNumber : emptyDraft.applicant.birthCertificateNumber,
  };
  // Coerce guardian fields to their declared types
  const guardianInput = input?.guardian as Record<string, unknown> | undefined;
  const normalizedGuardian = {
    ...emptyDraft.guardian,
    ...input?.guardian,
    relationship: typeof guardianInput?.relationship === "string" ? guardianInput.relationship : emptyDraft.guardian.relationship,
    fullName: typeof guardianInput?.fullName === "string" ? guardianInput.fullName : emptyDraft.guardian.fullName,
    sinhalaName: typeof guardianInput?.sinhalaName === "string" ? guardianInput.sinhalaName : emptyDraft.guardian.sinhalaName,
    nic: typeof guardianInput?.nic === "string" ? guardianInput.nic : emptyDraft.guardian.nic,
    phone: typeof guardianInput?.phone === "string" ? guardianInput.phone : emptyDraft.guardian.phone,
    whatsappPhone: typeof guardianInput?.whatsappPhone === "string" ? guardianInput.whatsappPhone : emptyDraft.guardian.whatsappPhone,
    email: typeof guardianInput?.email === "string" ? guardianInput.email : emptyDraft.guardian.email,
  };
  // Coerce residence fields to their declared types
  const residenceInput = input?.residence as Record<string, unknown> | undefined;
  const residenceSameAsPermanent =
    typeof residenceInput?.sameAsPermanent === "boolean"
      ? residenceInput.sameAsPermanent
      : emptyDraft.residence.sameAsPermanent;
  const residenceBase = {
    ...emptyDraft.residence,
    ...input?.residence,
    // Drafts saved before the address was split into English/Sinhala carry a
    // single `permanentAddress`/`currentAddress` string; treat it as the
    // English value so nothing already entered is lost.
    permanentAddressEn:
      typeof residenceInput?.permanentAddressEn === "string"
        ? residenceInput.permanentAddressEn
        : typeof residenceInput?.permanentAddress === "string"
          ? residenceInput.permanentAddress
          : emptyDraft.residence.permanentAddressEn,
    permanentAddressSi:
      typeof residenceInput?.permanentAddressSi === "string"
        ? residenceInput.permanentAddressSi
        : emptyDraft.residence.permanentAddressSi,
    currentAddressEn:
      typeof residenceInput?.currentAddressEn === "string"
        ? residenceInput.currentAddressEn
        : typeof residenceInput?.currentAddress === "string"
          ? residenceInput.currentAddress
          : emptyDraft.residence.currentAddressEn,
    currentAddressSi:
      typeof residenceInput?.currentAddressSi === "string"
        ? residenceInput.currentAddressSi
        : emptyDraft.residence.currentAddressSi,
    sameAsPermanent: residenceSameAsPermanent,
    district: typeof residenceInput?.district === "string" ? residenceInput.district : emptyDraft.residence.district,
    dsDivision: typeof residenceInput?.dsDivision === "string" ? residenceInput.dsDivision : emptyDraft.residence.dsDivision,
    gnDivision: typeof residenceInput?.gnDivision === "string" ? residenceInput.gnDivision : emptyDraft.residence.gnDivision,
    electoralDistrict: typeof residenceInput?.electoralDistrict === "string" ? residenceInput.electoralDistrict : emptyDraft.residence.electoralDistrict,
    districtSearch: typeof residenceInput?.districtSearch === "string" ? residenceInput.districtSearch : emptyDraft.residence.districtSearch,
    dsSearch: typeof residenceInput?.dsSearch === "string" ? residenceInput.dsSearch : emptyDraft.residence.dsSearch,
    gnSearch: typeof residenceInput?.gnSearch === "string" ? residenceInput.gnSearch : emptyDraft.residence.gnSearch,
    electoralSearch: typeof residenceInput?.electoralSearch === "string" ? residenceInput.electoralSearch : emptyDraft.residence.electoralSearch,
  };
  // Coerce declaration fields to their declared types
  const declarationInput = input?.declaration as Record<string, unknown> | undefined;
  const normalizedDeclaration = {
    confirmed: declarationInput?.confirmed === true,
    consent: declarationInput?.consent === true,
  };
  // Whenever the two addresses are marked as matching, force current to equal
  // permanent regardless of what was actually stored there. Every write path
  // (the applicant's own form, and the admin editor's generic field-by-field
  // updates) funnels through this function before a save, so this is the one
  // place that can guarantee the saved record is never stale or diverged.
  const normalizedResidence = residenceSameAsPermanent
    ? {
        ...residenceBase,
        currentAddressEn: residenceBase.permanentAddressEn,
        currentAddressSi: residenceBase.permanentAddressSi,
      }
    : residenceBase;
  // Clamp currentStep to valid range to prevent NaN in UI calculations
  const currentStep = input?.currentStep;
  const clampedCurrentStep = typeof currentStep === "number" ? Math.max(0, Math.min(currentStep, 6)) : emptyDraft.currentStep;

  const normalizedLocation = { ...emptyDraft.location, ...input?.location };
  const locationStatus = toFieldStatus(
    raw?.["locationStatus"],
    raw?.["locationSkipped"] === true,
    normalizedLocation.latitude != null && normalizedLocation.longitude != null,
  );
  const birthCertificateStatus = toFieldStatus(
    raw?.["birthCertificateStatus"],
    raw?.["birthCertificateSkipped"] === true,
    normalizedApplicant.birthCertificateNumber.trim().length > 0,
  );

  return {
    ...emptyDraft,
    ...input,
    location: normalizedLocation,
    locationStatus,
    birthCertificateStatus,
    defaultLocations,
    selectedLocation: { ...emptyDraft.selectedLocation, ...input?.selectedLocation },
    applicant: normalizedApplicant,
    guardian: normalizedGuardian,
    residence: normalizedResidence,
    declaration: normalizedDeclaration,
    currentStep: clampedCurrentStep,
    categories: normalizeCategories(input?.categories),
    deviceLocationHistory: normalizeLocationHistory(input?.deviceLocationHistory),
    userLocationHistory: normalizeLocationHistory(input?.userLocationHistory),
    interviewEdits: Array.isArray(input?.interviewEdits) ? input.interviewEdits : [],
    admissionStatus: typeof input?.admissionStatus === "string" ? input.admissionStatus : "pending",
    interviewNotes: typeof input?.interviewNotes === "string" ? input.interviewNotes : "",
    isBanned: Boolean(input?.isBanned),
    banReason: typeof input?.banReason === "string" ? input.banReason : null,
    flags: Array.isArray(input?.flags) ? input.flags : [],
    // Never trust a persisted/server value for ephemeral UI state: a stale
    // `true` here (e.g. from a tab closed mid-submit) would otherwise wedge
    // the form permanently with no way for the user to recover.
    saveStatus: emptyDraft.saveStatus,
    submitError: emptyDraft.submitError,
    isSubmitting: emptyDraft.isSubmitting,
    copiedField: emptyDraft.copiedField,
    showSubmissionRequest: emptyDraft.showSubmissionRequest,
    requestSaving: emptyDraft.requestSaving,
    bcDialogOpen: emptyDraft.bcDialogOpen,
    bcRequestState: emptyDraft.bcRequestState,
    clearDraftDialogOpen: emptyDraft.clearDraftDialogOpen,
  };
}

type ApplicationStore = ApplicationDraft & {
  updateDraft: (patch: Partial<ApplicationDraft>) => void;
  setStep: (currentStep: number) => void;
  addCategory: (categoryType: CategoryType) => void;
  removeCategory: (id: string) => void;
  updateCategoryInputs: (id: string, patch: Partial<ScoringInputs>) => void;
  reset: () => void;
};

// No client persistence: the DB is the only source of truth. Each step saves
// to the server on advance (see ApplicationForm's `next()`), and the SSR
// route loader seeds this store's initial values synchronously from the DB
// (see ApplicationForm's render-time seed) \u2014 there is nothing left to
// hydrate asynchronously, and nothing here ever touches `window`/localStorage.
export const useApplicationStore = create<ApplicationStore>()((set) => ({
  ...emptyDraft,
  updateDraft: (patch) => set({ ...patch, lastSavedAt: new Date().toISOString() }),
  setStep: (currentStep) => set((state) => ({ currentStep, maxVisitedStep: Math.max(state.maxVisitedStep, currentStep) })),
  addCategory: (categoryType) =>
    set((state) => ({
      categories: [...state.categories, createCategory(categoryType, state.categories.length)],
      lastSavedAt: new Date().toISOString(),
    })),
  removeCategory: (id) =>
    set((state) => ({
      categories: state.categories.filter((category) => category.id !== id),
      lastSavedAt: new Date().toISOString(),
    })),
  updateCategoryInputs: (id, patch) =>
    set((state) => ({
      categories: state.categories.map((category) =>
        category.id === id ? { ...category, scoringInputs: { ...category.scoringInputs, ...patch } } : category,
      ),
      lastSavedAt: new Date().toISOString(),
    })),
  reset: () => set(emptyDraft),
}));

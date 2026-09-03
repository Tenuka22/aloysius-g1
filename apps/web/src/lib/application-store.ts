import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  capturedSignature,
  extractCaptured,
  readLocationSeal,
  restoreCapturedLocations,
  writeLocationSeal,
  type SealedLocations,
} from "./location-seal";

export type LocationDraft = {
  id?: string;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  source: "manual" | "device" | "map" | "network" | "admin" | "";
};

export const CATEGORY_TYPES = ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export type ScoringInputs = {
  mainDocumentType?: string;
  documentOwnership?: string;
  deedTransferDate?: string;
  additionalDocs?: string[];
  electoralMotherSince?: number;
  electoralFatherSince?: number;
  schoolsWithinRadius?: string[];
  schoolsRadiusKm?: number;
  serviceStartDate?: string;
  difficultServiceType?: "current" | "previous" | "none";
  difficultServiceDistanceKm?: number;
  difficultServiceExtraPeriods?: number;
  unutilizedLeaveYears?: number;
  serviceLocationLevel?: string;
  residenceToSchoolKm?: number;
  workplaceToSchoolKm?: number;
  previousWorkplaceDistanceKm?: number;
  previousWorkplaceStartDate?: string;
  transferDate?: string;
  abroadStartDate?: string;
  abroadEndDate?: string;
  employmentPurpose?: "board" | "personal" | "government" | "education";
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
  sportsLevel?: string;
  sportsCount?: number;
  leadershipRole?: string;
  studentSocietiesRole?: string;
  otherActivity?: string;
  otherActivityName?: string;
  pastPupilsLifeMember?: boolean;
  pastPupilsMembershipStart?: string;
  pastPupilsMembershipEnd?: string;
  pastPupilsCommitteeMember?: boolean;
  pastPupilsExecutiveOffice?: boolean;
  highestDegree?: string;
  hasDiploma?: boolean;
  sportsMeetContribution?: boolean;
  shramadanaContribution?: boolean;
  schoolProjectsContribution?: boolean;
  siblingsCurrentlyStudyingCount?: number;
  siblingStudiedAtAppliedSchool?: boolean;
  twoOrMoreSiblingsApplying?: boolean;
  siblingPrefectLevel?: string;
  siblingPrefectCount?: number;
  siblingExamAchievement?: string;
  siblingPraiseworthyAchievement?: boolean;
  parentsSupportRendered?: boolean;
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
  declaration: { confirmed: boolean; consent: boolean };
  categories: CategoryApplication[];
  deviceLocationHistory: LocationDraft[];
  userLocationHistory: LocationDraft[];
  lastSavedAt: string | null;
  accessKey: string;
  sessionCode: string;
  duplicateBirthCertificate: boolean;
  locationCanProceed: boolean;
  submittedAt: string | null;
  submissionLocked: boolean;
  submissionOpensAt: string;
  submissionClosesAt: string;
  hydrated: boolean;
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
  residence: { permanentAddress: "", currentAddress: "", sameAsPermanent: false, district: "", dsDivision: "", gnDivision: "", electoralDistrict: "", districtSearch: "", dsSearch: "", gnSearch: "", electoralSearch: "" },
  declaration: { confirmed: false, consent: false },
  categories: [],
  deviceLocationHistory: [],
  userLocationHistory: [],
  lastSavedAt: null,
  accessKey: "",
  sessionCode: "",
  duplicateBirthCertificate: false,
  locationCanProceed: false,
  submittedAt: null,
  submissionLocked: false,
  submissionOpensAt: "",
  submissionClosesAt: "",
  hydrated: false,
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

export function normalizeDraft(input: Partial<ApplicationDraft> | null | undefined): ApplicationDraft {
  const raw = input as Record<string, unknown> | null | undefined;
  let defaultLocations: LocationDraft[] = Array.isArray(input?.defaultLocations) ? normalizeLocationHistory(input?.defaultLocations) : [];
  if (defaultLocations.length === 0 && raw && typeof raw["defaultLocation"] === "object" && raw["defaultLocation"] !== null && !Array.isArray(raw["defaultLocation"])) {
    const loc = raw["defaultLocation"] as Partial<LocationDraft>;
    if (typeof loc.latitude === "number" && typeof loc.longitude === "number") {
      defaultLocations = [{ label: typeof loc.label === "string" ? loc.label : "", address: typeof loc.address === "string" ? loc.address : "", latitude: loc.latitude, longitude: loc.longitude, source: typeof loc.source === "string" && ["manual", "device", "map", "network"].includes(loc.source) ? (loc.source as LocationDraft["source"]) : "device" }];
    }
  }
  return {
    ...emptyDraft,
    ...input,
    location: { ...emptyDraft.location, ...input?.location },
    defaultLocations,
    selectedLocation: { ...emptyDraft.selectedLocation, ...input?.selectedLocation },
    applicant: { ...emptyDraft.applicant, ...input?.applicant },
    guardian: { ...emptyDraft.guardian, ...input?.guardian },
    residence: { ...emptyDraft.residence, ...input?.residence },
    declaration: { ...emptyDraft.declaration, ...input?.declaration },
    categories: normalizeCategories(input?.categories),
    deviceLocationHistory: normalizeLocationHistory(input?.deviceLocationHistory),
    userLocationHistory: normalizeLocationHistory(input?.userLocationHistory),
    interviewEdits: Array.isArray(input?.interviewEdits) ? input.interviewEdits : [],
    admissionStatus: typeof input?.admissionStatus === "string" ? input.admissionStatus : "pending",
    interviewNotes: typeof input?.interviewNotes === "string" ? input.interviewNotes : "",
    isBanned: Boolean(input?.isBanned),
    banReason: typeof input?.banReason === "string" ? input.banReason : null,
    flags: Array.isArray(input?.flags) ? input.flags : [],
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

export const APPLICATION_DRAFT_STORAGE_KEY = "aloysius-g1-application-draft";

export const useApplicationStore = create<ApplicationStore>()(
  persist(
    (set) => ({
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
    }),
    {
      name: APPLICATION_DRAFT_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => window.localStorage),
      merge: (persisted, current) => ({
        ...current,
        ...normalizeDraft(persisted as Partial<ApplicationDraft>),
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Sealed browser-captured locations
//
// Every change to the captured (device/network) location re-encrypts its
// authoritative copy into localStorage (see lib/location-seal.ts). When the
// draft is loaded, reconcileCapturedLocations() compares the plaintext draft
// against the seal and restores the captured fields from the seal, so editing
// the auto-saved draft in devtools cannot silently move the recorded location.
// ---------------------------------------------------------------------------

let lastCapturedSignature: string | null = null;

function capturedSignatureOfState(): string {
  return capturedSignature(extractCaptured(useApplicationStore.getState()));
}

function resealIfChanged() {
  if (typeof window === "undefined") return;
  const signature = capturedSignatureOfState();
  if (signature === lastCapturedSignature) return;
  lastCapturedSignature = signature;
  void writeLocationSeal(useApplicationStore.getState()).catch(() => {
    // Sealing is best-effort; storage or crypto failures must not break the draft.
  });
}

/**
 * Verifies the persisted draft against the sealed captured locations and
 * restores the sealed values when the plaintext was modified. Safe to call
 * repeatedly after hydration; no-op when the draft already matches the seal.
 */
export async function reconcileCapturedLocations(): Promise<void> {
  if (typeof window === "undefined") return;
  const sealed: SealedLocations | null = await readLocationSeal();
  const current = useApplicationStore.getState();
  if (!sealed) {
    // No seal yet (first run of this feature, cleared storage, or fresh draft):
    // adopt the current captured locations as the baseline.
    lastCapturedSignature = capturedSignature(extractCaptured(current));
    await writeLocationSeal(current);
    return;
  }
  const patch = restoreCapturedLocations(current, sealed);
  if (patch) {
    useApplicationStore.setState(patch as Partial<ApplicationDraft>);
  }
  lastCapturedSignature = capturedSignatureOfState();
  await writeLocationSeal(useApplicationStore.getState());
}

useApplicationStore.subscribe(resealIfChanged);
void reconcileCapturedLocations().catch(() => {
  // Best-effort on first load; the form re-runs reconcile after hydration.
});

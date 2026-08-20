import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type LocationDraft = {
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  source: "manual" | "device" | "map" | "";
};

export type ApplicationDraft = {
  currentStep: number;
  location: LocationDraft;
  defaultLocation: LocationDraft;
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
  };
  declaration: { confirmed: boolean; consent: boolean };
  lastSavedAt: string | null;
};

export const emptyDraft: ApplicationDraft = {
  currentStep: 0,
  location: { label: "", address: "", latitude: null, longitude: null, source: "" },
  defaultLocation: { label: "", address: "", latitude: null, longitude: null, source: "" },
  selectedLocation: { label: "", address: "", latitude: null, longitude: null, source: "" },
  applicant: { fullName: "", sinhalaName: "", gender: "", religion: "", educationMedium: "", dateOfBirth: "", birthCertificateNumber: "" },
  guardian: { relationship: "", fullName: "", nic: "", phone: "", whatsappPhone: "", email: "" },
  residence: { permanentAddress: "", currentAddress: "", sameAsPermanent: false, district: "", dsDivision: "", gnDivision: "", electoralDistrict: "" },
  declaration: { confirmed: false, consent: false },
  lastSavedAt: null,
};

export function normalizeDraft(input: Partial<ApplicationDraft> | null | undefined): ApplicationDraft {
  return {
    ...emptyDraft,
    ...input,
    location: { ...emptyDraft.location, ...input?.location },
    defaultLocation: { ...emptyDraft.defaultLocation, ...input?.defaultLocation },
    selectedLocation: { ...emptyDraft.selectedLocation, ...input?.selectedLocation },
    applicant: { ...emptyDraft.applicant, ...input?.applicant },
    guardian: { ...emptyDraft.guardian, ...input?.guardian },
    residence: { ...emptyDraft.residence, ...input?.residence },
    declaration: { ...emptyDraft.declaration, ...input?.declaration },
  };
}

type ApplicationStore = ApplicationDraft & {
  updateDraft: (patch: Partial<ApplicationDraft>) => void;
  setStep: (currentStep: number) => void;
  reset: () => void;
};

export const useApplicationStore = create<ApplicationStore>()(
  persist(
    (set) => ({
      ...emptyDraft,
      updateDraft: (patch) => set({ ...patch, lastSavedAt: new Date().toISOString() }),
      setStep: (currentStep) => set({ currentStep }),
      reset: () => set(emptyDraft),
    }),
    {
      name: "aloysius-g1-2026-application-draft",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ ...state, updateDraft: undefined, setStep: undefined, reset: undefined }),
    },
  ),
);

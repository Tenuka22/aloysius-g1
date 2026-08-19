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
  applicant: {
    fullName: string;
    sinhalaName: string;
    gender: string;
    religion: string;
    educationMedium: string;
    dateOfBirth: string;
  };
  guardian: {
    relationship: string;
    fullName: string;
    nic: string;
    phone: string;
    email: string;
  };
  residence: {
    permanentAddress: string;
    currentAddress: string;
    district: string;
    dsDivision: string;
    gnDivision: string;
    electoralDistrict: string;
  };
  schools: { firstChoice: string; secondChoice: string; acceptNearby: string };
  declaration: { confirmed: boolean; consent: boolean };
  lastSavedAt: string | null;
};

export const emptyDraft: ApplicationDraft = {
  currentStep: 0,
  location: { label: "", address: "", latitude: null, longitude: null, source: "" },
  applicant: { fullName: "", sinhalaName: "", gender: "", religion: "", educationMedium: "", dateOfBirth: "" },
  guardian: { relationship: "", fullName: "", nic: "", phone: "", email: "" },
  residence: { permanentAddress: "", currentAddress: "", district: "", dsDivision: "", gnDivision: "", electoralDistrict: "" },
  schools: { firstChoice: "", secondChoice: "", acceptNearby: "" },
  declaration: { confirmed: false, consent: false },
  lastSavedAt: null,
};

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

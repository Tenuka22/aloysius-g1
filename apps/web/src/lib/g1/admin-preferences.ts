import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AdminViewDensity = "comfortable" | "compact";

export type AdminFieldVisibility = Record<string, Record<string, boolean>>;

export type AdminPreferences = {
  defaultTab: string;
  density: AdminViewDensity;
  autoExpandScoringInputs: boolean;
  showMarkBars: boolean;
  showMarkBreakdown: boolean;
  recentlyViewed: Array<{ id: string; name: string; viewedAt: string }>;
  applicationsSort: { id: string; desc: boolean } | null;
  applicationsStatusFilter: string;
  fieldVisibility: AdminFieldVisibility;
};

type AdminPreferencesStore = AdminPreferences & {
  setDefaultTab: (tab: string) => void;
  setDensity: (density: AdminViewDensity) => void;
  setAutoExpandScoringInputs: (expand: boolean) => void;
  setShowMarkBars: (show: boolean) => void;
  setShowMarkBreakdown: (show: boolean) => void;
  addRecentlyViewed: (id: string, name: string) => void;
  setApplicationsSort: (sort: { id: string; desc: boolean } | null) => void;
  setApplicationsStatusFilter: (filter: string) => void;
  setFieldVisibility: (section: string, field: string, visible: boolean) => void;
  resetPreferences: () => void;
};

const MAX_RECENTLY_VIEWED = 10;

const defaultPreferences: AdminPreferences = {
  defaultTab: "overview",
  density: "comfortable",
  autoExpandScoringInputs: false,
  showMarkBars: true,
  showMarkBreakdown: true,
  recentlyViewed: [],
  applicationsSort: null,
  applicationsStatusFilter: "all",
  fieldVisibility: {},
};

export const ADMIN_PREFERENCES_KEY = "aloysius-admissions-admin-preferences";

export const useAdminPreferences = create<AdminPreferencesStore>()(
  persist(
    (set) => ({
      ...defaultPreferences,
      setDefaultTab: (tab) => set({ defaultTab: tab }),
      setDensity: (density) => set({ density }),
      setAutoExpandScoringInputs: (expand) => set({ autoExpandScoringInputs: expand }),
      setShowMarkBars: (show) => set({ showMarkBars: show }),
      setShowMarkBreakdown: (show) => set({ showMarkBreakdown: show }),
      addRecentlyViewed: (id, name) =>
        set((state) => {
          const filtered = state.recentlyViewed.filter((r) => r.id !== id);
          const entry = { id, name, viewedAt: new Date().toISOString() };
          return { recentlyViewed: [entry, ...filtered].slice(0, MAX_RECENTLY_VIEWED) };
        }),
      setApplicationsSort: (sort) => set({ applicationsSort: sort }),
      setApplicationsStatusFilter: (filter) => set({ applicationsStatusFilter: filter }),
      setFieldVisibility: (section, field, visible) =>
        set((state) => ({
          fieldVisibility: {
            ...state.fieldVisibility,
            [section]: {
              ...state.fieldVisibility[section],
              [field]: visible,
            },
          },
        })),
      resetPreferences: () => set(defaultPreferences),
    }),
    {
      name: ADMIN_PREFERENCES_KEY,
      storage: createJSONStorage(() => window.localStorage),
      merge: (persisted, current) => ({
        ...current,
        ...(typeof persisted === "object" && persisted !== null ? persisted : {}),
      }),
    },
  ),
);

export function isFieldVisible(fieldVisibility: AdminFieldVisibility, section: string, field: string): boolean {
  const sectionPrefs = fieldVisibility[section];
  if (!sectionPrefs) return true;
  if (field in sectionPrefs) return sectionPrefs[field];
  return true;
}

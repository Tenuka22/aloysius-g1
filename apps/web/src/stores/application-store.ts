import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export interface SavedApplication {
  accessKey: string
  sessionCode: string
  name?: string
  number?: string
}

interface SessionState {
  accessKey: string
  sessionCode: string
  setAccessKey: (key: string) => void
  setSessionCode: (code: string) => void
  clearActive: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessKey: "",
      sessionCode: "",
      setAccessKey: (key) => set({ accessKey: key }),
      setSessionCode: (code) => set({ sessionCode: code }),
      clearActive: () => set({ accessKey: "", sessionCode: "" }),
    }),
    {
      name: "aloysius-g1-application",
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

interface KeysState {
  savedApplications: SavedApplication[]
  setSavedApplications: (apps: SavedApplication[]) => void
  addSavedApplication: (app: SavedApplication) => void
  removeSavedApplication: (accessKey: string) => void
  updateSavedApplication: (accessKey: string, patch: Partial<SavedApplication>) => void
  upsertBySessionCode: (sessionCode: string, patch: Partial<SavedApplication>) => void
}

export const useKeysStore = create<KeysState>()(
  persist(
    (set, get) => ({
      savedApplications: [],
      setSavedApplications: (apps) => set({ savedApplications: apps }),
      addSavedApplication: (app) =>
        set((state) => {
          const exists = state.savedApplications.some((saved) => saved.accessKey === app.accessKey);
          if (exists) {
            return {
              savedApplications: state.savedApplications.map((saved) =>
                saved.accessKey === app.accessKey ? { ...saved, ...app } : saved,
              ),
            };
          }
          return { savedApplications: [...state.savedApplications, app] };
        }),
      removeSavedApplication: (accessKey) =>
        set((state) => ({
          savedApplications: state.savedApplications.filter((app) => app.accessKey !== accessKey),
        })),
      updateSavedApplication: (accessKey, patch) =>
        set((state) => ({
          savedApplications: state.savedApplications.map((app) =>
            app.accessKey === accessKey ? { ...app, ...patch } : app,
          ),
        })),
      upsertBySessionCode: (sessionCode, patch) =>
        set((state) => {
          const existing = state.savedApplications.find((app) => app.sessionCode === sessionCode);
          if (existing) {
            return {
              savedApplications: state.savedApplications.map((app) =>
                app.sessionCode === sessionCode ? { ...app, ...patch } : app,
              ),
            };
          }
          return {
            savedApplications: [...state.savedApplications, { sessionCode, ...patch } as SavedApplication],
          };
        }),
    }),
    {
      name: "aloysius-g1-keys",
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

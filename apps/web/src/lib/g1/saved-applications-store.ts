import { create } from "zustand";
import { getSavedKeys, removeSavedKey, saveKey } from "@/lib/g1/saved-keys";

type SavedApplicationsStore = {
  keys: string[];
  refresh: () => void;
  add: (key: string) => void;
  remove: (key: string) => void;
};

export const useSavedApplicationsStore = create<SavedApplicationsStore>()((set) => ({
  keys: getSavedKeys(),
  refresh: () => set({ keys: getSavedKeys() }),
  add: (key) => {
    saveKey(key);
    set({ keys: getSavedKeys() });
  },
  remove: (key) => {
    removeSavedKey(key);
    set({ keys: getSavedKeys() });
  },
}));

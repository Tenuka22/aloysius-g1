import { create } from "zustand";
import { getSavedKeys, removeSavedKey, saveKey } from "@/lib/g1/saved-keys";

type SavedApplicationsStore = {
  keys: string[];
  refresh: () => void;
  add: (key: string) => void;
  remove: (key: string) => void;
};

export const useSavedApplicationsStore = create<SavedApplicationsStore>()((set) => ({
  // Not getSavedKeys() here: this module is evaluated once per server
  // process (ESM caching), not once per request. Reading the cookie at
  // module scope either crashes - getAppCookie()'s server branch needs an
  // in-flight request's AsyncLocalStorage context, which doesn't exist at
  // import time - or, worse, succeeds once and leaks whichever request
  // happened to trigger that first import into every other request's
  // initial render until its own mount-time refresh() corrects it. Starting
  // empty and relying on the existing useEffect(refresh) on mount (see
  // home-page.tsx) keeps the real read per-request/client-side only, same
  // as __root.tsx's refreshSchoolCoordinateOverrides().
  keys: [],
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

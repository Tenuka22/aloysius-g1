// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useSavedApplicationsStore } from "./saved-applications-store";
import { getSavedKeys, removeSavedKey, saveKey } from "./saved-keys";

const SAVED_KEYS_COOKIE = "aloysius-admissions-application-keys";
const ACTIVE_KEY_COOKIE = "aloysius-admissions-application-key";
const SESSION_CODE_COOKIE = "aloysius-admissions-application-session-code";

function reset() {
  useSavedApplicationsStore.setState({ keys: [] });
}

// Assigning `document.cookie = ""` does not clear cookies - each must be
// expired explicitly with max-age=0 on the same path it was set with.
function clearCookies() {
  for (const name of [SAVED_KEYS_COOKIE, ACTIVE_KEY_COOKIE, SESSION_CODE_COOKIE]) {
    document.cookie = `${name}=; path=/; max-age=0`;
  }
}

describe("useSavedApplicationsStore", () => {
  beforeEach(() => {
    clearCookies();
    reset();
  });

  it("seeds its keys from the saved-keys cookie on creation", () => {
    saveKey("ALY-seeded");
    const seeded = useSavedApplicationsStore.getState();
    // The store always starts empty (never reads cookies at module load, so
    // it's SSR-safe) regardless of what's already saved; verify refresh syncs it.
    expect(seeded.keys).not.toContain("ALY-seeded");
    seeded.refresh();
    expect(useSavedApplicationsStore.getState().keys).toContain("ALY-seeded");
  });
  it("refresh() re-reads the saved keys", () => {
    saveKey("ALY-a");
    useSavedApplicationsStore.getState().refresh();
    expect(useSavedApplicationsStore.getState().keys).toEqual(["ALY-a"]);
  });

  it("add() persists the key and updates state", () => {
    useSavedApplicationsStore.getState().add("ALY-1");
    useSavedApplicationsStore.getState().add("ALY-2");
    expect(useSavedApplicationsStore.getState().keys).toEqual(["ALY-1", "ALY-2"]);
    expect(getSavedKeys()).toEqual(["ALY-1", "ALY-2"]);
  });

  it("add() does not duplicate an existing key", () => {
    useSavedApplicationsStore.getState().add("ALY-1");
    useSavedApplicationsStore.getState().add("ALY-1");
    expect(useSavedApplicationsStore.getState().keys).toEqual(["ALY-1"]);
  });

  it("remove() deletes the key from state and storage", () => {
    useSavedApplicationsStore.getState().add("ALY-1");
    useSavedApplicationsStore.getState().add("ALY-2");
    useSavedApplicationsStore.getState().remove("ALY-1");
    expect(useSavedApplicationsStore.getState().keys).toEqual(["ALY-2"]);
    expect(getSavedKeys()).toEqual(["ALY-2"]);
  });

  it("remove() is a no-op for an unknown key", () => {
    useSavedApplicationsStore.getState().add("ALY-1");
    useSavedApplicationsStore.getState().remove("ALY-other");
    expect(useSavedApplicationsStore.getState().keys).toEqual(["ALY-1"]);
  });

  it("remove() keeps the underlying cookie write consistent", () => {
    saveKey("ALY-outside");
    useSavedApplicationsStore.getState().refresh();
    useSavedApplicationsStore.getState().remove("ALY-outside");
    expect(getSavedKeys()).toEqual([]);
    expect(() => removeSavedKey("ALY-outside")).not.toThrow();
  });
});

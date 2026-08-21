// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { clearActiveKey, getSavedKeys, removeSavedKey, saveKey } from "./saved-keys";

const LEGACY_KEY = "aloysius-g1-application-key";
const SAVED_KEY = "aloysius-g1-application-keys";

describe("getSavedKeys", () => {
  beforeEach(() => localStorage.clear());
  it("returns an empty list when nothing is stored", () => expect(getSavedKeys()).toEqual([]));
  it("reads the saved-keys list", () => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(["a", "b"]));
    expect(getSavedKeys()).toEqual(["a", "b"]);
  });
  it("includes the legacy single key when not in the list", () => {
    localStorage.setItem(LEGACY_KEY, "legacy-key");
    expect(getSavedKeys()).toEqual(["legacy-key"]);
  });
  it("merges and dedupes the legacy key with the list", () => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(["a", "legacy-key"]));
    localStorage.setItem(LEGACY_KEY, "legacy-key");
    expect(getSavedKeys()).toEqual(["a", "legacy-key"]);
  });
  it("ignores non-string entries and invalid JSON", () => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(["a", 42, null, {}]));
    expect(getSavedKeys()).toEqual(["a"]);
    localStorage.setItem(SAVED_KEY, "not-json");
    expect(getSavedKeys()).toEqual([]);
  });
});

describe("saveKey", () => {
  beforeEach(() => localStorage.clear());
  it("appends a key to the list", () => {
    saveKey("key-1");
    saveKey("key-2");
    expect(getSavedKeys()).toEqual(["key-1", "key-2"]);
  });
  it("does not duplicate a key", () => {
    saveKey("key-1");
    saveKey("key-1");
    expect(getSavedKeys()).toEqual(["key-1"]);
  });
});

describe("removeSavedKey", () => {
  beforeEach(() => localStorage.clear());
  it("removes the key from the list and keeps the rest", () => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(["a", "b", "c"]));
    removeSavedKey("b");
    expect(getSavedKeys()).toEqual(["a", "c"]);
  });
  it("removes the legacy key when it matches", () => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(["a"]));
    localStorage.setItem(LEGACY_KEY, "a");
    removeSavedKey("a");
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(getSavedKeys()).toEqual([]);
  });
  it("keeps the legacy key when removing another key", () => {
    localStorage.setItem(SAVED_KEY, JSON.stringify(["a", "b"]));
    localStorage.setItem(LEGACY_KEY, "a");
    removeSavedKey("b");
    expect(localStorage.getItem(LEGACY_KEY)).toBe("a");
    expect(getSavedKeys()).toEqual(["a"]);
  });
});

describe("clearActiveKey", () => {
  beforeEach(() => localStorage.clear());
  it("clears the active key and session code only", () => {
    localStorage.setItem(LEGACY_KEY, "key");
    localStorage.setItem("aloysius-g1-application-session-code", "26ABC123");
    localStorage.setItem(SAVED_KEY, JSON.stringify(["key"]));
    clearActiveKey();
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(localStorage.getItem("aloysius-g1-application-session-code")).toBeNull();
    expect(getSavedKeys()).toEqual(["key"]);
  });
});
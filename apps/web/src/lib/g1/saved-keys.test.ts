// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { clearActiveKey, getSavedKeys, removeSavedKey, saveKey } from "./saved-keys";
import { getAppCookie, removeAppCookie, setAppCookie } from "../cookies";

const LEGACY_KEY = "aloysius-admissions-application-key";
const SAVED_KEY = "aloysius-admissions-application-keys";
const SESSION_CODE_KEY = "aloysius-admissions-application-session-code";

function clearCookies() {
  [LEGACY_KEY, SAVED_KEY, SESSION_CODE_KEY].forEach(removeAppCookie);
}

describe("getSavedKeys", () => {
  beforeEach(clearCookies);
  it("returns an empty list when nothing is stored", () => expect(getSavedKeys()).toEqual([]));
  it("reads the saved-keys list", () => {
    setAppCookie(SAVED_KEY, JSON.stringify(["a", "b"]));
    expect(getSavedKeys()).toEqual(["a", "b"]);
  });
  it("includes the legacy single key when not in the list", () => {
    setAppCookie(LEGACY_KEY, "legacy-key");
    expect(getSavedKeys()).toEqual(["legacy-key"]);
  });
  it("merges and dedupes the legacy key with the list", () => {
    setAppCookie(SAVED_KEY, JSON.stringify(["a", "legacy-key"]));
    setAppCookie(LEGACY_KEY, "legacy-key");
    expect(getSavedKeys()).toEqual(["a", "legacy-key"]);
  });
  it("ignores non-string entries and invalid JSON", () => {
    setAppCookie(SAVED_KEY, JSON.stringify(["a", 42, null, {}]));
    expect(getSavedKeys()).toEqual(["a"]);
    setAppCookie(SAVED_KEY, "not-json");
    expect(getSavedKeys()).toEqual([]);
  });
});

describe("saveKey", () => {
  beforeEach(clearCookies);
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
  beforeEach(clearCookies);
  it("removes the key from the list and keeps the rest", () => {
    setAppCookie(SAVED_KEY, JSON.stringify(["a", "b", "c"]));
    removeSavedKey("b");
    expect(getSavedKeys()).toEqual(["a", "c"]);
  });
  it("removes the legacy key when it matches", () => {
    setAppCookie(SAVED_KEY, JSON.stringify(["a"]));
    setAppCookie(LEGACY_KEY, "a");
    removeSavedKey("a");
    expect(getAppCookie(LEGACY_KEY)).toBeNull();
    expect(getSavedKeys()).toEqual([]);
  });
  it("keeps the legacy key when removing another key", () => {
    setAppCookie(SAVED_KEY, JSON.stringify(["a", "b"]));
    setAppCookie(LEGACY_KEY, "a");
    removeSavedKey("b");
    expect(getAppCookie(LEGACY_KEY)).toBe("a");
    expect(getSavedKeys()).toEqual(["a"]);
  });
});

describe("clearActiveKey", () => {
  beforeEach(clearCookies);
  it("clears the active key and session code only", () => {
    setAppCookie(LEGACY_KEY, "key");
    setAppCookie(SESSION_CODE_KEY, "26ABC123");
    setAppCookie(SAVED_KEY, JSON.stringify(["key"]));
    clearActiveKey();
    expect(getAppCookie(LEGACY_KEY)).toBeNull();
    expect(getAppCookie(SESSION_CODE_KEY)).toBeNull();
    expect(getSavedKeys()).toEqual(["key"]);
  });
});

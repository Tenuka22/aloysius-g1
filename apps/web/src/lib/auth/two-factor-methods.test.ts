// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  isTwoFactorRedirect,
  parseTwoFactorMethods,
  storeTwoFactorMethods,
  readTwoFactorMethods,
  clearTwoFactorMethods,
  TWO_FACTOR_METHODS_STORAGE_KEY,
} from "./two-factor-methods";

describe("isTwoFactorRedirect", () => {
  it("returns true for { twoFactorRedirect: true }", () => {
    expect(isTwoFactorRedirect({ twoFactorRedirect: true })).toBe(true);
  });

  it("returns false for { twoFactorRedirect: false }", () => {
    expect(isTwoFactorRedirect({ twoFactorRedirect: false })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isTwoFactorRedirect(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isTwoFactorRedirect(undefined)).toBe(false);
  });

  it("returns false for a string", () => {
    expect(isTwoFactorRedirect("true")).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isTwoFactorRedirect(1)).toBe(false);
  });

  it("returns true when extra properties are present", () => {
    expect(isTwoFactorRedirect({ twoFactorRedirect: true, other: "data" })).toBe(true);
  });

  it("returns false for empty object", () => {
    expect(isTwoFactorRedirect({})).toBe(false);
  });
});

describe("parseTwoFactorMethods", () => {
  it("returns empty array for undefined", () => {
    expect(parseTwoFactorMethods(undefined)).toEqual([]);
  });

  it("returns empty array for null", () => {
    expect(parseTwoFactorMethods(null)).toEqual([]);
  });

  it("returns empty array for non-array input", () => {
    expect(parseTwoFactorMethods("totp")).toEqual([]);
  });

  it("filters to only supported methods", () => {
    expect(parseTwoFactorMethods(["totp", "otp"])).toEqual(["totp", "otp"]);
  });

  it("ignores unsupported methods", () => {
    expect(parseTwoFactorMethods(["totp", "webauthn", "otp"])).toEqual(["totp", "otp"]);
  });

  it("returns empty array for empty array", () => {
    expect(parseTwoFactorMethods([])).toEqual([]);
  });

  it("returns empty array when no supported methods match", () => {
    expect(parseTwoFactorMethods(["webauthn", "sms"])).toEqual([]);
  });
});

describe("sessionStorage operations", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe("storeTwoFactorMethods", () => {
    it("stores methods to sessionStorage", () => {
      storeTwoFactorMethods(["totp", "otp"]);
      const stored = sessionStorage.getItem(TWO_FACTOR_METHODS_STORAGE_KEY);
      expect(stored).toBe(JSON.stringify(["totp", "otp"]));
    });

    it("stores empty array for unsupported methods", () => {
      storeTwoFactorMethods(["webauthn"]);
      const stored = sessionStorage.getItem(TWO_FACTOR_METHODS_STORAGE_KEY);
      expect(stored).toBe(JSON.stringify([]));
    });

    it("handles undefined input", () => {
      storeTwoFactorMethods(undefined);
      const stored = sessionStorage.getItem(TWO_FACTOR_METHODS_STORAGE_KEY);
      expect(stored).toBe(JSON.stringify([]));
    });
  });

  describe("readTwoFactorMethods", () => {
    it("returns all methods when nothing stored", () => {
      expect(readTwoFactorMethods()).toEqual(["totp", "otp"]);
    });

    it("returns stored methods", () => {
      sessionStorage.setItem(TWO_FACTOR_METHODS_STORAGE_KEY, JSON.stringify(["totp"]));
      expect(readTwoFactorMethods()).toEqual(["totp"]);
    });

    it("returns all methods when stored data is invalid JSON", () => {
      sessionStorage.setItem(TWO_FACTOR_METHODS_STORAGE_KEY, "not-json");
      expect(readTwoFactorMethods()).toEqual(["totp", "otp"]);
    });

    it("returns all methods when stored array is empty", () => {
      sessionStorage.setItem(TWO_FACTOR_METHODS_STORAGE_KEY, JSON.stringify([]));
      expect(readTwoFactorMethods()).toEqual(["totp", "otp"]);
    });

    it("returns all methods when stored data contains only unsupported methods", () => {
      sessionStorage.setItem(TWO_FACTOR_METHODS_STORAGE_KEY, JSON.stringify(["webauthn"]));
      expect(readTwoFactorMethods()).toEqual(["totp", "otp"]);
    });
  });

  describe("clearTwoFactorMethods", () => {
    it("removes stored methods", () => {
      sessionStorage.setItem(TWO_FACTOR_METHODS_STORAGE_KEY, JSON.stringify(["totp"]));
      clearTwoFactorMethods();
      expect(sessionStorage.getItem(TWO_FACTOR_METHODS_STORAGE_KEY)).toBeNull();
    });

    it("does not throw when nothing is stored", () => {
      expect(() => clearTwoFactorMethods()).not.toThrow();
    });
  });
});

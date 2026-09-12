// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
// The root vitest.setup.ts globally mocks this module's isomorphic cookie
// functions (see its comment); sharedCookieDomain/extractAllCookieValues are
// plain, non-isomorphic functions with nothing to mock, so this file tests
// the real implementation directly.
vi.unmock("@/lib/cookies");
import { extractAllCookieValues, sharedCookieDomain } from "./cookies";

describe("sharedCookieDomain", () => {
  it("shares the apex domain with itself", () => {
    expect(sharedCookieDomain("aloysiuscollege.lk")).toBe("aloysiuscollege.lk");
  });
  it("shares the apex domain with the admissions subdomain", () => {
    expect(sharedCookieDomain("admissions.aloysiuscollege.lk")).toBe("aloysiuscollege.lk");
  });
  it("shares the apex domain with any other subdomain", () => {
    expect(sharedCookieDomain("www.aloysiuscollege.lk")).toBe("aloysiuscollege.lk");
  });
  it("ignores a port suffix", () => {
    expect(sharedCookieDomain("admissions.aloysiuscollege.lk:3001")).toBe("aloysiuscollege.lk");
  });
  it("is case-insensitive", () => {
    expect(sharedCookieDomain("ADMISSIONS.ALOYSIUSCOLLEGE.LK")).toBe("aloysiuscollege.lk");
  });
  it("leaves localhost host-only", () => {
    expect(sharedCookieDomain("localhost")).toBeUndefined();
  });
  it("leaves an unrelated domain host-only", () => {
    expect(sharedCookieDomain("example.com")).toBeUndefined();
  });
  it("does not match a domain that merely ends with the same letters", () => {
    expect(sharedCookieDomain("notaloysiuscollege.lk")).toBeUndefined();
  });
});

describe("extractAllCookieValues", () => {
  it("returns nothing when the cookie is absent", () => {
    expect(extractAllCookieValues("other=1", "target")).toEqual([]);
  });
  it("returns the single matching value", () => {
    expect(extractAllCookieValues("a=1; target=hello; b=2", "target")).toEqual(["hello"]);
  });
  it("returns every occurrence when the same name appears twice", () => {
    // What a browser reports when a host-only and a shared-domain cookie of the
    // same name both apply to the current page - the exact transition state
    // getSavedKeys() must merge across instead of picking just one.
    expect(extractAllCookieValues("target=old; target=new", "target")).toEqual(["old", "new"]);
  });
  it("URI-decodes each value", () => {
    expect(extractAllCookieValues(`target=${encodeURIComponent('["a","b"]')}`, "target")).toEqual(['["a","b"]']);
  });
});

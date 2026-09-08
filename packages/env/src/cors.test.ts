import { describe, expect, it } from "vitest";

function getCorsOrigins(envValue: string): string[] {
  return envValue.split(",").map((origin) => origin.trim());
}

function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.includes(origin);
}

describe("getCorsOrigins", () => {
  it("parses a single origin", () => {
    expect(getCorsOrigins("http://localhost:3001")).toEqual(["http://localhost:3001"]);
  });

  it("parses comma-separated origins", () => {
    expect(getCorsOrigins("http://localhost:3001,https://example.com")).toEqual([
      "http://localhost:3001",
      "https://example.com",
    ]);
  });

  it("trims whitespace around origins", () => {
    expect(getCorsOrigins("  http://localhost:3001 , https://example.com  ")).toEqual([
      "http://localhost:3001",
      "https://example.com",
    ]);
  });

  it("handles three or more origins", () => {
    expect(getCorsOrigins("http://a.com,https://b.com,http://c.com")).toEqual([
      "http://a.com",
      "https://b.com",
      "http://c.com",
    ]);
  });
});

describe("isOriginAllowed", () => {
  it("allows an exact match", () => {
    expect(isOriginAllowed("http://localhost:3001", ["http://localhost:3001"])).toBe(true);
  });

  it("rejects a non-matching origin", () => {
    expect(isOriginAllowed("http://evil.com", ["http://localhost:3001"])).toBe(false);
  });

  it("allows any of multiple configured origins", () => {
    const origins = ["http://localhost:3001", "https://example.com"];
    expect(isOriginAllowed("https://example.com", origins)).toBe(true);
  });

  it("rejects when no origins configured", () => {
    expect(isOriginAllowed("http://localhost:3001", [])).toBe(false);
  });

  it("rejects when origin is undefined (empty string)", () => {
    expect(isOriginAllowed("", ["http://localhost:3001"])).toBe(false);
  });
});

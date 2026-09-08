import { describe, expect, it, vi, beforeEach } from "vitest";
import { checkRateLimit } from "./rate-limit";

function makeRequest(ip?: string): Request {
  const headers = new Headers();
  if (ip) headers.set("x-forwarded-for", ip);
  return new Request("http://localhost/api/auth/sign-in", { headers });
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    return () => vi.useRealTimers();
  });

  it("allows the first request", () => {
    const result = checkRateLimit(makeRequest("1.2.3.4"), "auth");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("decrements remaining on each request", () => {
    const req = makeRequest("5.6.7.8");
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(req, "auth");
      expect(result.allowed).toBe(true);
    }
    const result = checkRateLimit(req, "auth");
    expect(result.remaining).toBe(4);
  });

  it("blocks after exceeding max requests", () => {
    const req = makeRequest("10.0.0.1");
    for (let i = 0; i < 10; i++) {
      checkRateLimit(req, "auth");
    }
    const result = checkRateLimit(req, "auth");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after the window expires", () => {
    const req = makeRequest("192.168.1.1");
    for (let i = 0; i < 10; i++) {
      checkRateLimit(req, "auth");
    }
    const blocked = checkRateLimit(req, "auth");
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    const allowed = checkRateLimit(req, "auth");
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(9);
  });

  it("tracks different IPs separately", () => {
    const req1 = makeRequest("1.1.1.1");
    const req2 = makeRequest("2.2.2.2");

    for (let i = 0; i < 10; i++) {
      checkRateLimit(req1, "auth");
    }
    const blocked1 = checkRateLimit(req1, "auth");
    expect(blocked1.allowed).toBe(false);

    const allowed2 = checkRateLimit(req2, "auth");
    expect(allowed2.allowed).toBe(true);
  });

  it("tracks different routes separately", () => {
    const req = makeRequest("3.3.3.3");
    for (let i = 0; i < 10; i++) {
      checkRateLimit(req, "auth");
    }
    const blocked = checkRateLimit(req, "auth");
    expect(blocked.allowed).toBe(false);

    const submissionResult = checkRateLimit(req, "submission");
    expect(submissionResult.allowed).toBe(true);
  });

  it("uses submission config (5 req/min)", () => {
    const req = makeRequest("4.4.4.4");
    for (let i = 0; i < 5; i++) {
      checkRateLimit(req, "submission");
    }
    const blocked = checkRateLimit(req, "submission");
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(60 * 1000 + 1);
    const allowed = checkRateLimit(req, "submission");
    expect(allowed.allowed).toBe(true);
  });

  it("uses default config (100 req/min)", () => {
    const req = makeRequest("6.6.6.6");
    for (let i = 0; i < 100; i++) {
      checkRateLimit(req, "default");
    }
    const blocked = checkRateLimit(req, "default");
    expect(blocked.allowed).toBe(false);
  });

  it("handles missing x-forwarded-for header", () => {
    const req = makeRequest();
    const result = checkRateLimit(req, "auth");
    expect(result.allowed).toBe(true);
  });

  it("returns a resetAt in the future", () => {
    const result = checkRateLimit(makeRequest("7.7.7.7"), "auth");
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });
});

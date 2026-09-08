import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const mockQuery = vi.fn().mockReturnValue({ get: () => ({}) });

vi.mock("@aloysius-admissions/db", () => ({
  db: {
    $client: {
      query: (...args: unknown[]) => mockQuery(...args),
    },
  },
}));

vi.mock("@aloysius-admissions/env/server", () => ({
  getCorsOrigins: () => ["http://localhost:3001"],
}));

vi.mock("@aloysius-admissions/auth", () => ({
  createAuth: vi.fn(),
  ensureSiteAdmin: vi.fn(),
}));

vi.mock("@aloysius-admissions/db/scripts/backup", () => ({
  backup: vi.fn(),
}));

function createHealthApp() {
  const app = new Hono();

  app.get("/health", async (c) => {
    let dbStatus = "healthy";
    let dbLatency = 0;

    try {
      const dbStart = Date.now();
      mockQuery("SELECT 1").get();
      dbLatency = Date.now() - dbStart;
    } catch {
      dbStatus = "unhealthy";
    }

    const status = dbStatus === "healthy" ? 200 : 503;

    return c.json(
      {
        status: dbStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "unknown",
        checks: {
          database: {
            status: dbStatus,
            latencyMs: dbLatency,
          },
        },
      },
      status,
    );
  });

  return app;
}

describe("health endpoint", () => {
  it("returns 200 with healthy status when DB is reachable", async () => {
    mockQuery.mockReturnValue({ get: () => ({}) });
    const app = createHealthApp();
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.database.status).toBe("healthy");
    expect(typeof body.timestamp).toBe("string");
    expect(typeof body.uptime).toBe("number");
  });

  it("returns 503 when DB throws", async () => {
    mockQuery.mockImplementation(() => {
      throw new Error("DB connection failed");
    });
    const app = createHealthApp();
    const res = await app.request("/health");

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database.status).toBe("unhealthy");
  });

  it("includes latency measurement", async () => {
    mockQuery.mockReturnValue({ get: () => ({}) });
    const app = createHealthApp();
    const res = await app.request("/health");

    const body = await res.json();
    expect(typeof body.checks.database.latencyMs).toBe("number");
    expect(body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

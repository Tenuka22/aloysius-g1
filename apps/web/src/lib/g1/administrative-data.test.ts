// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";

const mockDistrictData = [{ name: "Colombo" }, { name: "Gampaha" }];
const mockDsdData = [{ name: "Colombo" }, { name: "Kelaniya" }];
const mockGndData = [{ name: "Colombo Central" }, { name: "Kelaniya North" }];

function mockFetchSuccess() {
  return vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("all-district.json")) return { ok: true, json: async () => mockDistrictData };
    if (url.includes("all-dsd.json")) return { ok: true, json: async () => mockDsdData };
    if (url.includes("all-gnd.json")) return { ok: true, json: async () => mockGndData };
    return { ok: true, json: async () => [] };
  });
}

describe("loadAdministrativeData", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("fetches and returns administrative data", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess());
    const { loadAdministrativeData } = await import("./administrative-data");
    const data = await loadAdministrativeData();
    expect(data.districts).toContain("Colombo");
    expect(data.dsDivisions).toContain("Kelaniya");
    expect(data.gnDivisions).toContain("Colombo Central");
  });

  it("caches result in localStorage", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess());
    const { loadAdministrativeData } = await import("./administrative-data");
    await loadAdministrativeData();
    const cached = localStorage.getItem("aloysius-admissions:lk-administrative-data:v1");
    expect(cached).toBeTruthy();
    const parsed = JSON.parse(cached!);
    expect(parsed.timestamp).toBeTypeOf("number");
    expect(parsed.data.districts).toContain("Colombo");
  });

  it("returns cached data on subsequent calls", async () => {
    const fetchSpy = mockFetchSuccess();
    vi.stubGlobal("fetch", fetchSpy);
    const { loadAdministrativeData } = await import("./administrative-data");
    await loadAdministrativeData();
    const callsAfterFirst = fetchSpy.mock.calls.length;
    await loadAdministrativeData();
    expect(fetchSpy).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it("returns cached data when within TTL", async () => {
    const cached = { timestamp: Date.now(), data: { districts: ["Cached"], dsDivisions: [], gnDivisions: [] } };
    localStorage.setItem("aloysius-admissions:lk-administrative-data:v1", JSON.stringify(cached));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { loadAdministrativeData } = await import("./administrative-data");
    const data = await loadAdministrativeData();
    expect(data.districts).toEqual(["Cached"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("re-fetches when cache is expired", async () => {
    const expired = { timestamp: Date.now() - 25 * 60 * 60 * 1000, data: { districts: ["Old"], dsDivisions: [], gnDivisions: [] } };
    localStorage.setItem("aloysius-admissions:lk-administrative-data:v1", JSON.stringify(expired));
    vi.stubGlobal("fetch", mockFetchSuccess());
    const { loadAdministrativeData } = await import("./administrative-data");
    const data = await loadAdministrativeData();
    expect(data.districts).toContain("Colombo");
  });

  it("deduplicates names", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("all-district.json")) return { ok: true, json: async () => [{ name: "Colombo" }, { name: "Colombo" }, { name: "Gampaha" }] };
      if (url.includes("all-dsd.json")) return { ok: true, json: async () => [{ name: "A" }] };
      if (url.includes("all-gnd.json")) return { ok: true, json: async () => [{ name: "B" }] };
      return { ok: true, json: async () => [] };
    }));
    const { loadAdministrativeData } = await import("./administrative-data");
    const data = await loadAdministrativeData();
    expect(data.districts.filter((d: string) => d === "Colombo")).toHaveLength(1);
  });

  it("throws on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { loadAdministrativeData } = await import("./administrative-data");
    await expect(loadAdministrativeData()).rejects.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  DIVISIONAL_SECRETARIATS,
  ELECTORAL_CONSTITUENCIES,
  FARMERS_SERVICE_CENTERS,
  GN_DIVISIONS,
  LOCAL_GOVT_BODIES,
  MAHAWELI_DIVISIONS,
} from "./divisions";

function expectUniqueIds(items: Array<{ id: string }>) {
  const ids = items.map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
}

function expectBilingualLabels(items: Array<{ id: string; en: string; si: string }>) {
  for (const item of items) {
    expect(item.en.trim(), `${item.id} missing English label`).not.toBe("");
    expect(item.si.trim(), `${item.id} missing Sinhala label`).not.toBe("");
  }
}

describe("divisions catalog", () => {
  it("covers the three Southern Province districts", () => {
    expect(DISTRICTS.map((d) => d.id).sort()).toEqual(["galle", "hambantota", "matara"]);
  });

  it("has unique ids across districts", () => {
    expectUniqueIds(DISTRICTS);
  });

  it("links every divisional secretariat to a known district", () => {
    const districtIds = new Set(DISTRICTS.map((d) => d.id));
    for (const ds of DIVISIONAL_SECRETARIATS) {
      expect(districtIds.has(ds.districtId), `${ds.id} references unknown district ${ds.districtId}`).toBe(true);
    }
  });

  it("has unique ids across divisional secretariats", () => {
    expectUniqueIds(DIVISIONAL_SECRETARIATS);
  });

  it("links every GN division to a known divisional secretariat", () => {
    const dsIds = new Set(DIVISIONAL_SECRETARIATS.map((ds) => ds.id));
    for (const gn of GN_DIVISIONS) {
      expect(dsIds.has(gn.dsId), `${gn.id} references unknown DS ${gn.dsId}`).toBe(true);
    }
  });

  it("has unique ids across GN divisions", () => {
    expectUniqueIds(GN_DIVISIONS);
  });

  it("provides English and Sinhala labels for every location entry", () => {
    expectBilingualLabels(DISTRICTS);
    expectBilingualLabels(DIVISIONAL_SECRETARIATS);
    expectBilingualLabels(GN_DIVISIONS);
    expectBilingualLabels(LOCAL_GOVT_BODIES);
    expectBilingualLabels(ELECTORAL_CONSTITUENCIES);
    expectBilingualLabels(FARMERS_SERVICE_CENTERS);
    expectBilingualLabels(MAHAWELI_DIVISIONS);
  });

  it("has unique ids across every lookup list", () => {
    expectUniqueIds(LOCAL_GOVT_BODIES);
    expectUniqueIds(ELECTORAL_CONSTITUENCIES);
    expectUniqueIds(FARMERS_SERVICE_CENTERS);
    expectUniqueIds(MAHAWELI_DIVISIONS);
  });

  it("is a non-trivial catalog", () => {
    // Guards against an accidental regeneration wiping the data.
    expect(DISTRICTS.length).toBeGreaterThanOrEqual(3);
    expect(DIVISIONAL_SECRETARIATS.length).toBeGreaterThanOrEqual(50);
    expect(GN_DIVISIONS.length).toBeGreaterThan(500);
  });
});

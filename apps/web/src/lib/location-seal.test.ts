import { beforeEach, describe, expect, it } from "vitest";
import {
  capturedSignature,
  extractCaptured,
  isCapturedEntry,
  LOCATION_SEAL_STORAGE_KEY,
  readLocationSeal,
  restoreCapturedLocations,
  toCapturedLocation,
  writeLocationSeal,
  type CapturedLocation,
} from "./location-seal";
import type { LocationDraft } from "./application-store";

function device(
  latitude: number,
  longitude: number,
  label = "Your location",
  address = "12 Lighthouse Street, Galle",
): LocationDraft {
  return { label, address, latitude, longitude, source: "device" };
}

function locationFixture() {
  const fix = device(6.03241, 80.21692);
  return {
    location: { ...fix },
    selectedLocation: { ...fix },
    defaultLocations: [{ ...fix }],
    deviceLocationHistory: [device(6.0302, 80.2146, "Earlier device fix", "18 Church Street, Galle")],
    userLocationHistory: [
      device(6.03241, 80.21692, "Selected location", "12 Lighthouse Street, Galle"),
      { label: "Earlier pin", address: "Galle town", latitude: 6.03704, longitude: 80.22214, source: "map" },
    ],
  };
}

describe("captured location extraction", () => {
  it("keeps only device/network entries with finite coordinates", () => {
    const fixture = locationFixture();
    const extracted = extractCaptured(fixture);
    expect(extracted.location?.source).toBe("device");
    expect(extracted.defaults).toHaveLength(1);
    expect(extracted.device).toHaveLength(1);
    // the map pin in user history is not captured
    expect(extracted.user).toHaveLength(1);
    expect(extracted.user[0]?.address).toBe("12 Lighthouse Street, Galle");

    const mapOnly = extractCaptured({
      location: { label: "", address: "", latitude: 6.1, longitude: 80.2, source: "map" },
    });
    expect(mapOnly.location).toBeNull();

    const pending = extractCaptured({
      location: { label: "", address: "", latitude: null, longitude: null, source: "device" },
    });
    expect(pending.location).toBeNull();
  });

  it("marks a manual map pin as not captured", () => {
    expect(isCapturedEntry({ label: "", address: "", latitude: 6.1, longitude: 80.2, source: "map" })).toBe(false);
    expect(isCapturedEntry(device(6.1, 80.2))).toBe(true);
    expect(toCapturedLocation(null)).toBeNull();
  });
});

describe("location seal", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips captured locations through the encrypted seal", async () => {
    const fixture = locationFixture();
    expect(await writeLocationSeal(fixture)).toBe(true);
    expect(localStorage.getItem(LOCATION_SEAL_STORAGE_KEY)).not.toBeNull();

    const sealed = await readLocationSeal();
    expect(sealed).not.toBeNull();
    expect(sealed!.location).toMatchObject({ latitude: 6.03241, longitude: 80.21692, source: "device" });
    expect(sealed!.defaults).toHaveLength(1);
    expect(sealed!.device).toHaveLength(1);
    expect(sealed!.user).toHaveLength(1);
    // the plaintext must never be stored in the seal key
    expect(localStorage.getItem(LOCATION_SEAL_STORAGE_KEY)).not.toContain("6.03241");
  });

  it("removes the seal when there are no captured locations left", async () => {
    await writeLocationSeal(locationFixture());
    expect(localStorage.getItem(LOCATION_SEAL_STORAGE_KEY)).not.toBeNull();
    await writeLocationSeal({ location: null, defaultLocations: [], deviceLocationHistory: [], userLocationHistory: [] });
    expect(localStorage.getItem(LOCATION_SEAL_STORAGE_KEY)).toBeNull();
    expect(await readLocationSeal()).toBeNull();
  });

  it("signature changes when any captured field changes", () => {
    const fixture = locationFixture();
    const before = capturedSignature(extractCaptured(fixture));
    const tampered = structuredClone(fixture);
    tampered.deviceLocationHistory[0]!.latitude = 5.5;
    const after = capturedSignature(extractCaptured(tampered));
    expect(after).not.toBe(before);
  });

  it("restores captured locations when the plaintext draft was edited", async () => {
    const fixture = locationFixture();
    await writeLocationSeal(fixture);
    const sealed = await readLocationSeal();
    expect(sealed).not.toBeNull();

    // hand-edit the localStorage-backed draft: shift home closer to the school
    const tampered = structuredClone(fixture) as ReturnType<typeof locationFixture>;
    tampered.location = { ...tampered.location!, latitude: 6.031, longitude: 80.215, source: "device" };
    tampered.selectedLocation = { ...tampered.selectedLocation!, latitude: 6.031, longitude: 80.215 };
    tampered.defaultLocations[0] = { ...tampered.defaultLocations[0]!, latitude: 6.031, longitude: 80.215 };
    tampered.deviceLocationHistory[0]!.latitude = 6.035;
    tampered.userLocationHistory[0] = { ...tampered.userLocationHistory[0]!, latitude: 6.031, longitude: 80.215 };

    const patch = restoreCapturedLocations(tampered, sealed);
    expect(patch).not.toBeNull();

    const restored = { ...tampered, ...patch };
    expect(restored.location!.latitude).toBe(6.03241);
    expect(restored.location!.longitude).toBe(80.21692);
    expect(restored.location!.source).toBe("device");
    expect(restored.selectedLocation!.latitude).toBe(6.03241);
    expect(restored.defaultLocations[0]!.latitude).toBe(6.03241);
    expect(restored.deviceLocationHistory[0]!.latitude).toBe(6.0302);
    // map pin untouched
    expect(restored.userLocationHistory[1]).toMatchObject({ latitude: 6.03704, source: "map" });
  });

  it("returns null when the draft already matches the seal", async () => {
    const fixture = locationFixture();
    await writeLocationSeal(fixture);
    const sealed = await readLocationSeal();
    expect(restoreCapturedLocations(structuredClone(fixture), sealed)).toBeNull();
  });

  it("drops forged captured entries and re-appends deleted ones", async () => {
    const fixture = locationFixture();
    await writeLocationSeal(fixture);
    const sealed = await readLocationSeal();
    expect(sealed).not.toBeNull();

    const forged = structuredClone(fixture) as ReturnType<typeof locationFixture>;
    forged.defaultLocations.push(device(6.0, 80.1, "Forged", "Fake Street"));
    const dropped = restoreCapturedLocations(forged, sealed);
    expect(dropped?.defaultLocations).toHaveLength(1);

    const deleted = structuredClone(fixture) as ReturnType<typeof locationFixture>;
    deleted.deviceLocationHistory = [];
    const readded = restoreCapturedLocations(deleted, sealed);
    expect(readded?.deviceLocationHistory).toHaveLength(1);
    expect((readded!.deviceLocationHistory![0] as CapturedLocation).latitude).toBe(6.0302);
  });

  it("keeps a legitimate user-chosen map pin untouched", async () => {
    const fixture = locationFixture();
    const moved = { ...fixture.location!, source: "map" as const, latitude: 6.1, longitude: 80.1 };
    const state = { ...fixture, location: moved, selectedLocation: moved };
    await writeLocationSeal(state);
    const sealed = await readLocationSeal();
    expect(sealed?.location).toBeNull(); // map pin is not captured

    const patch = restoreCapturedLocations(state, sealed);
    expect(patch).toBeNull(); // nothing to restore, nothing to clobber
  });
});

import type { LocationDraft } from "./application-store";

/**
 * Tamper-evident storage for browser-captured home locations.
 *
 * The application auto-saves the whole draft (including the device/network GPS
 * capture) to localStorage so an applicant can continue later. Everything in
 * that draft is editable by design — except the *captured* location, which is
 * recorded by the browser without user input and is used as the trustworthy
 * "true location" (shown to admins as Browser location / Device GPS fix).
 *
 * This module keeps a sealed (AES-GCM encrypted + authenticated) copy of every
 * captured location in a separate localStorage key. When the draft is loaded we
 * compare the plaintext copy against the seal and restore the captured fields
 * from the seal on any mismatch, so hand-editing localStorage cannot silently
 * move the recorded home point.
 *
 * Boundary: the key lives in the client bundle (or a VITE_ env var), so this
 * raises the bar against casual devtools editing rather than against someone
 * who rewrites the app code. It does not protect coordinates edited in memory
 * at submit time.
 */

export const LOCATION_SEAL_STORAGE_KEY = "aloysius-g1-location-seal";

const CAPTURED_SOURCES = new Set(["device", "network"]);

export type CapturedSource = "device" | "network";

export type CapturedLocation = {
  source: CapturedSource;
  latitude: number;
  longitude: number;
  label: string;
  address: string;
};

export type SealedLocations = {
  location: CapturedLocation | null;
  defaults: CapturedLocation[];
  device: CapturedLocation[];
  user: CapturedLocation[];
};

export type CapturedInput = {
  location?: LocationDraft | null;
  selectedLocation?: LocationDraft | null;
  defaultLocations?: LocationDraft[] | null;
  deviceLocationHistory?: LocationDraft[] | null;
  userLocationHistory?: LocationDraft[] | null;
};

/**
 * Fallback used when VITE_LOCATION_SEAL_SECRET is not configured. Set the env
 * var in production so each deployment has its own secret.
 */
const FALLBACK_SECRET =
  "aloysius-g1-location-seal-fallback-2f8a1c4e9b6d7f0a3c5e8b1d4f6a9c2e7b0d3f5a8c1e4b7d9f0a2c5e8b1d4f6a9c3e";

function sealSecret(): string {
  const configured = (
    import.meta as unknown as {
      env?: Record<string, string | undefined>;
    }
  ).env?.VITE_LOCATION_SEAL_SECRET;
  if (typeof configured === "string" && configured.trim().length >= 16) {
    return configured.trim();
  }
  return FALLBACK_SECRET;
}

function webCrypto(): Crypto | null {
  try {
    const cryptoGlobal = globalThis.crypto as Crypto | undefined;
    if (cryptoGlobal && typeof cryptoGlobal.subtle !== "undefined") {
      return cryptoGlobal;
    }
  } catch {
    // fall through
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function isCapturedSource(source: unknown): source is CapturedSource {
  return typeof source === "string" && CAPTURED_SOURCES.has(source);
}

export function toCapturedLocation(
  entry: LocationDraft | null | undefined,
): CapturedLocation | null {
  if (!entry) return null;
  if (!isCapturedSource(entry.source)) return null;
  if (typeof entry.latitude !== "number" || !Number.isFinite(entry.latitude)) {
    return null;
  }
  if (typeof entry.longitude !== "number" || !Number.isFinite(entry.longitude)) {
    return null;
  }
  return {
    source: entry.source,
    latitude: entry.latitude,
    longitude: entry.longitude,
    label: typeof entry.label === "string" ? entry.label : "",
    address: typeof entry.address === "string" ? entry.address : "",
  };
}

export function isCapturedEntry(
  entry: LocationDraft | null | undefined,
): entry is LocationDraft & { source: CapturedSource; latitude: number; longitude: number } {
  return toCapturedLocation(entry) !== null;
}

function capturedList(
  list: LocationDraft[] | null | undefined,
): CapturedLocation[] {
  return (Array.isArray(list) ? list : [])
    .map(toCapturedLocation)
    .filter((entry): entry is CapturedLocation => entry !== null);
}

export function extractCaptured(input: CapturedInput): SealedLocations {
  return {
    location: toCapturedLocation(input.location),
    defaults: capturedList(input.defaultLocations),
    device: capturedList(input.deviceLocationHistory),
    user: capturedList(input.userLocationHistory),
  };
}

function canonical(entry: CapturedLocation): string {
  return JSON.stringify([
    entry.source,
    entry.latitude,
    entry.longitude,
    entry.label,
    entry.address,
  ]);
}

export function capturedLocationsEqual(
  left: CapturedLocation | null | undefined,
  right: CapturedLocation | null | undefined,
): boolean {
  if (!left || !right) return left === right;
  return canonical(left) === canonical(right);
}

export function capturedSignature(sealed: SealedLocations): string {
  return JSON.stringify([
    sealed.location ? canonical(sealed.location) : null,
    sealed.defaults.map(canonical),
    sealed.device.map(canonical),
    sealed.user.map(canonical),
  ]);
}

async function sealKey(): Promise<CryptoKey | null> {
  const cryptoGlobal = webCrypto();
  if (!cryptoGlobal) return null;
  try {
    const digest = await cryptoGlobal.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(sealSecret()),
    );
    return await cryptoGlobal.subtle.importKey(
      "raw",
      digest,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  } catch {
    return null;
  }
}

function normalizeSealedLocations(raw: unknown): SealedLocations | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const readEntry = (value: unknown): CapturedLocation | null => {
    if (typeof value !== "object" || value === null) return null;
    const entry = value as Record<string, unknown>;
    if (!isCapturedSource(entry.source)) return null;
    if (typeof entry.latitude !== "number" || !Number.isFinite(entry.latitude)) return null;
    if (typeof entry.longitude !== "number" || !Number.isFinite(entry.longitude)) return null;
    return {
      source: entry.source,
      latitude: entry.latitude,
      longitude: entry.longitude,
      label: typeof entry.label === "string" ? entry.label : "",
      address: typeof entry.address === "string" ? entry.address : "",
    };
  };
  const readList = (value: unknown): CapturedLocation[] =>
    Array.isArray(value)
      ? value.map(readEntry).filter((entry): entry is CapturedLocation => entry !== null)
      : [];
  return {
    location: readEntry(record.location),
    defaults: readList(record.defaults),
    device: readList(record.device),
    user: readList(record.user),
  };
}

/** Encrypts the current captured locations into localStorage. Returns false when sealing is unavailable. */
export async function writeLocationSeal(input: CapturedInput): Promise<boolean> {
  const cryptoGlobal = webCrypto();
  const key = await sealKey();
  if (!cryptoGlobal || !key) return false;
  const sealed = extractCaptured(input);
  const hasAny =
    sealed.location !== null ||
    sealed.defaults.length > 0 ||
    sealed.device.length > 0 ||
    sealed.user.length > 0;
  try {
    if (!hasAny) {
      localStorage.removeItem(LOCATION_SEAL_STORAGE_KEY);
      return true;
    }
    const iv = cryptoGlobal.getRandomValues(new Uint8Array(12));
    const plaintext = JSON.stringify({ v: 1, ...sealed });
    const ciphertext = await cryptoGlobal.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    );
    localStorage.setItem(
      LOCATION_SEAL_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        iv: bytesToBase64(iv),
        data: bytesToBase64(new Uint8Array(ciphertext)),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Reads and decrypts the seal. Returns null when there is no seal or it cannot be verified. */
export async function readLocationSeal(): Promise<SealedLocations | null> {
  const cryptoGlobal = webCrypto();
  const key = await sealKey();
  if (!cryptoGlobal || !key) return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LOCATION_SEAL_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as { v?: unknown; iv?: unknown; data?: unknown };
    if (envelope.v !== 1 || typeof envelope.iv !== "string" || typeof envelope.data !== "string") {
      return null;
    }
    const iv = base64ToBytes(envelope.iv);
    const data = base64ToBytes(envelope.data);
    if (!iv || !data) return null;
    const plaintext = await cryptoGlobal.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data,
    );
    return normalizeSealedLocations(
      JSON.parse(new TextDecoder().decode(plaintext)),
    );
  } catch {
    return null;
  }
}

function capturedAsDraft(entry: CapturedLocation): LocationDraft {
  return {
    label: entry.label,
    address: entry.address,
    latitude: entry.latitude,
    longitude: entry.longitude,
    source: entry.source,
  };
}

/**
 * Pure restore: rewrites every browser-captured field of `state` from the seal.
 * Returns the patch to apply, or null when the plaintext already matches.
 * Captured entries sit in their original positions; extra forged captured
 * entries are dropped and missing ones are re-appended.
 */
export function restoreCapturedLocations(
  state: CapturedInput,
  sealed: SealedLocations | null,
): Partial<CapturedInput> | null {
  if (!sealed) return null;
  const patch: Partial<CapturedInput> = {};

  if (sealed.location) {
    const current = state.location;
    if (
      isCapturedEntry(current) &&
      !capturedLocationsEqual(toCapturedLocation(current), sealed.location)
    ) {
      patch.location = { ...current, ...capturedAsDraft(sealed.location) };
    }
    const selected = state.selectedLocation;
    if (
      isCapturedEntry(selected) &&
      !capturedLocationsEqual(toCapturedLocation(selected), sealed.location)
    ) {
      patch.selectedLocation = {
        ...selected,
        ...capturedAsDraft(sealed.location),
      };
    }
  }

  const restoreField = (
    plain: LocationDraft[] | null | undefined,
    sealedList: CapturedLocation[],
  ): LocationDraft[] | null => {
    const rebuilt: LocationDraft[] = [];
    let sealIndex = 0;
    for (const entry of Array.isArray(plain) ? plain : []) {
      if (isCapturedEntry(entry)) {
        if (sealIndex >= sealedList.length) continue; // forged extra captured entry
        const replacement = sealedList[sealIndex]!;
        sealIndex += 1;
        rebuilt.push(
          capturedLocationsEqual(toCapturedLocation(entry), replacement)
            ? entry
            : { ...entry, ...capturedAsDraft(replacement) },
        );
      } else {
        rebuilt.push(entry);
      }
    }
    while (sealIndex < sealedList.length) {
      rebuilt.push(capturedAsDraft(sealedList[sealIndex]!));
      sealIndex += 1;
    }
    const unchanged =
      rebuilt.length === (Array.isArray(plain) ? plain.length : 0) &&
      rebuilt.every((entry, index) => {
        const original = Array.isArray(plain) ? plain[index] : undefined;
        if (!original) return false;
        return (
          original.source === entry.source &&
          original.latitude === entry.latitude &&
          original.longitude === entry.longitude &&
          original.label === entry.label &&
          original.address === entry.address
        );
      });
    return unchanged ? null : rebuilt;
  };

  const restoredDefaults = restoreField(state.defaultLocations, sealed.defaults);
  if (restoredDefaults) patch.defaultLocations = restoredDefaults;
  const restoredDevice = restoreField(state.deviceLocationHistory, sealed.device);
  if (restoredDevice) patch.deviceLocationHistory = restoredDevice;
  const restoredUser = restoreField(state.userLocationHistory, sealed.user);
  if (restoredUser) patch.userLocationHistory = restoredUser;

  return Object.keys(patch).length > 0 ? patch : null;
}

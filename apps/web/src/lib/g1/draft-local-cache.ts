import type { ApplicationDraft } from "./application-store";

/**
 * Durable, per-application-key safety net between "the user typed something"
 * and "the server confirmed it saved it".
 *
 * The debounced server sync in application-form.tsx (`saveToServer`, fired
 * ~1.5s after the last edit) is the source of truth once it succeeds - see
 * the "DB is the only source of truth" note in application-store.ts. But
 * that 1.5s window (plus the network round trip itself) is real time during
 * which a closed tab, crashed browser, or dropped connection loses whatever
 * was typed, even though the UI already shows a "Saved locally" checkmark
 * (see `appForm.statusBar.savedLocally`) the moment the in-memory store
 * updates. This module makes that claim true: every draft change is written
 * to localStorage synchronously (effectively instant, well under the 1.5s
 * DB debounce), and the entry is only cleared once the debounced save
 * actually confirms with the server. If a reload finds a leftover entry, it
 * means the last edit never made it to the DB, so the caller re-seeds the
 * store from it and immediately re-triggers a save to catch the DB up.
 */

/**
 * Only the fields an applicant actually edits through the form. Deliberately
 * excludes:
 * - server-authoritative status (`submittedAt`, `submissionLocked`,
 *   `submissionOpensAt`, `submissionClosesAt`) - these arrive from a
 *   *separate* async call (`client.application.status()`) than the draft
 *   data itself, so a snapshot taken between the two calls resolving would
 *   otherwise cache a stale/default status and, on recovery, stomp the
 *   correct value the server just returned.
 * - session identifiers (`accessKey`, `sessionCode`) - recovery always runs
 *   in the context of an already-known access key.
 * - transient UI state (`saveStatus`, `isSubmitting`, dialog-open flags,
 *   the birth-certificate/removal-request form fields, etc.) - none of it
 *   is data loss the applicant would want recovered.
 */
type CachedDraftFields = Pick<
  ApplicationDraft,
  | "currentStep"
  | "maxVisitedStep"
  | "location"
  | "selectedLocation"
  | "applicant"
  | "guardian"
  | "residence"
  | "declaration"
  | "categories"
  | "deviceLocationHistory"
  | "userLocationHistory"
  | "locationStatus"
  | "birthCertificateStatus"
  | "duplicateBirthCertificate"
  | "locationCanProceed"
>;

const CACHED_FIELDS: (keyof CachedDraftFields)[] = [
  "currentStep",
  "maxVisitedStep",
  "location",
  "selectedLocation",
  "applicant",
  "guardian",
  "residence",
  "declaration",
  "categories",
  "deviceLocationHistory",
  "userLocationHistory",
  "locationStatus",
  "birthCertificateStatus",
  "duplicateBirthCertificate",
  "locationCanProceed",
];

const KEY_PREFIX = "aloysius-admissions-g1-draft:";

/** Writes the content fields (see `CachedDraftFields`) of the current draft
 * for `accessKey` to localStorage. Best-effort: a write failure (private
 * browsing, quota exceeded, no `window`) must never block the form, so
 * failures are swallowed. */
export function saveDraftLocally(accessKey: string, draft: ApplicationDraft): void {
  if (!accessKey || typeof window === "undefined") return;
  try {
    const content = {} as CachedDraftFields;
    for (const field of CACHED_FIELDS) (content[field] as unknown) = draft[field];
    window.localStorage.setItem(KEY_PREFIX + accessKey, JSON.stringify(content));
  } catch {
    // Best-effort cache; ignore.
  }
}

/** Clears the local safety-net entry once the debounced server save for
 * `accessKey` has actually confirmed - the DB now has this exact state, so
 * there is nothing left to recover. */
export function clearDraftLocally(accessKey: string): void {
  if (!accessKey || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + accessKey);
  } catch {
    // Best-effort cache; ignore.
  }
}

/** Returns the leftover, never-synced content fields for `accessKey`, or
 * `null` if there is none (the common case: either nothing was ever cached,
 * or the last edit already made it to the DB and the entry was cleared).
 * Its mere presence is the recovery signal - it is only ever written right
 * before a DB save attempt and removed once that attempt confirms. */
export function loadUnsyncedDraft(accessKey: string): Partial<CachedDraftFields> | null {
  if (!accessKey || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + accessKey);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<CachedDraftFields>;
  } catch {
    return null;
  }
}

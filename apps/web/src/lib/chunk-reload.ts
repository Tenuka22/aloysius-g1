// After a deploy, a browser tab that was already open still references the
// *previous* build's chunk filenames (they're content-hashed). Any lazy
// `import()` for a chunk that no longer exists on the server - e.g.
// `SchoolMapPickerMapLazy` in school-map-picker.tsx - then fails and lands in
// the app's error boundary (ErrorState) with a raw "Failed to fetch
// dynamically imported module" message, which looks like a real crash to the
// applicant even though a plain reload (which fetches the new index.html and
// its current chunk manifest) fixes it.
//
// Vite instruments every dynamic `import()` in the production build and
// fires `vite:preloadError` on `window` when one of these stale-chunk fetches
// fails, so we can recover automatically instead of showing an error page.

const RELOAD_GUARD_KEY = "g1-chunk-reload-at";
const RELOAD_COOLDOWN_MS = 10_000;

let guardInstalled = false;

/** Matches the browser-specific wording for a stale/missing JS chunk. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(
    message,
  );
}

/**
 * Reloads the page on a stale-chunk failure, at most once per cooldown
 * window so a genuinely broken deploy or offline tab falls through to the
 * normal ErrorState UI instead of reload-looping forever.
 */
export function installChunkReloadGuard(): void {
  if (typeof window === "undefined" || guardInstalled) return;
  guardInstalled = true;
  window.addEventListener("vite:preloadError", () => {
    const lastReload = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    if (Date.now() - lastReload > RELOAD_COOLDOWN_MS) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
      window.location.reload();
    }
  });
}

/** Called once the app has rendered past the point where a stale chunk would have failed to load. */
export function clearChunkReloadGuard(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RELOAD_GUARD_KEY);
}

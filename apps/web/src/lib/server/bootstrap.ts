import { ensureSiteAdmin, ensureSubAdmins } from "@aloysius-admissions/api/server";

/**
 * One-time server bootstrap: seeds the privileged accounts.
 *
 * The standalone Hono server used to do this at module load, before
 * `Bun.serve`. A TanStack Start app has no equivalent entrypoint, so this runs
 * on the first server request instead and memoises itself — every route
 * handler awaits the same promise, so concurrent first requests cannot seed
 * twice.
 */

let bootstrapPromise: Promise<void> | undefined;

async function runBootstrap(): Promise<void> {
  await ensureSiteAdmin();
  await ensureSubAdmins();
}

export function ensureServerBootstrap(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((error) => {
      // Reset so a transient failure (e.g. a locked database on boot) is
      // retried on the next request rather than leaving the app unseeded.
      bootstrapPromise = undefined;
      throw error;
    });
  }
  return bootstrapPromise;
}

import { backup, ensureSiteAdmin, ensureSubAdmins } from "@aloysius-admissions/api/server";

/**
 * One-time server bootstrap: seeds the privileged accounts and starts the
 * periodic backup.
 *
 * The standalone Hono server used to do this at module load, before
 * `Bun.serve`. A TanStack Start app has no equivalent entrypoint, so this runs
 * on the first server request instead and memoises itself — every route
 * handler awaits the same promise, so concurrent first requests cannot seed
 * twice.
 */

const SIX_HOURS = 6 * 60 * 60 * 1000;

let bootstrapPromise: Promise<void> | undefined;

async function runBootstrap(): Promise<void> {
  await ensureSiteAdmin();
  await ensureSubAdmins();

  // Back up on boot as well as on the timer. The interval is created fresh
  // every start, so on a server that restarts more often than every six hours
  // the timer alone would never fire and no backup would ever be taken.
  // `backup()` hashes the database and skips when nothing changed, so this
  // costs nothing when restarts are frequent.
  await runBackup("startup");

  const interval = setInterval(() => {
    void runBackup("periodic");
  }, SIX_HOURS);
  // Do not hold the process open just for the backup timer.
  interval.unref?.();
  console.log("[backup] scheduled periodic backup every 6 hours");
}

async function runBackup(reason: string): Promise<void> {
  try {
    const created = await backup();
    console.log(
      created
        ? `[backup] ${reason} backup completed`
        : `[backup] ${reason} backup skipped (database unchanged)`,
    );
  } catch (error) {
    console.error(`[backup] ${reason} backup failed:`, error);
  }
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

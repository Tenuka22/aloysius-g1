/**
 * CLI entrypoint for `backup()`.
 *
 * This is deliberately separate from `backup.ts`: that module is imported by
 * the server (to schedule periodic backups), and a top-level `backup()` call
 * there would fire as an import side effect on every boot -- a second, wasted
 * snapshot on top of the one the container's start command already takes.
 * Guarding with `import.meta.main` would not help, because tsdown inlines the
 * module into the server bundle, where it *is* the entrypoint.
 */
import { backup } from "./backup";

await backup();

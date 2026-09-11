import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3001,
    // Fail instead of silently moving to 3002: BETTER_AUTH_URL and the OAuth
    // redirect it derives are pinned to 3001, so a fallback port produces a
    // half-working app rather than an obvious error.
    strictPort: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // Deliberately the default "node-server" preset, not "bun": Nitro's own
    // "bun" preset runtime (srvx's BunServer) never wires an `error` handler
    // into Bun.serve() (see node_modules/nitro/dist/presets/bun/runtime/bun.mjs
    // - `serve({ ..., fetch: _fetch, bun: {...} })` has no `error:` key).
    // Without it, any exception thrown while generating/streaming a response
    // - such as TanStack Router's Seroval serialization occasionally choking
    // mid-stream - becomes a truly uncaught exception that crashes the whole
    // Bun process (not just that one request), matching the observed
    // repeated crash-restart loop in production. Bun's Node-compatible
    // `http` module (used by the "node-server" preset) doesn't have this
    // gap: a handler throwing mid-response aborts only that connection.
    // Bun still runs the process (see apps/web/Dockerfile) - only the HTTP
    // server implementation inside the build changes.
    // Explicitly pinned (not left to auto-detect): the same `bun run build`
    // command otherwise picks a different srvx adapter depending on the
    // host OS (confirmed: node.mjs on Windows, bun.mjs on Linux for this
    // exact command), so leaving it unset is not reliably deterministic.
    //
    // Vercel's own build (apps/web/package.json's "vercel-build" script, which
    // Vercel always runs with process.env.VERCEL set) needs Nitro's "vercel"
    // preset instead - a plain build's serverless-function output, not this
    // long-running HTTP server shape - so the pin only applies outside Vercel.
    nitro({ preset: process.env.VERCEL ? "vercel" : "node-server" }),
    // react's vite plugin must come after start's vite plugin
    react(),
  ],
});

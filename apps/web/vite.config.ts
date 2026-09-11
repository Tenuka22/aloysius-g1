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
    // Explicit "bun" preset (see TanStack Start's hosting docs): without it,
    // the srvx server adapter baked into the build is auto-detected from
    // whichever runtime happens to execute `vite build`, which is not
    // reliably consistent across build environments. Pinning it keeps the
    // Docker image's Bun-run server (see apps/web/Dockerfile) matched to a
    // build that was actually compiled for Bun.
    nitro({ preset: "bun" }),
    // react's vite plugin must come after start's vite plugin
    react(),
  ],
});

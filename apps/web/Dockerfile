# syntax=docker/dockerfile:1

# Base image pinned to the exact Bun version pinned in package.json's
# "packageManager" field, and shared by every stage so a native module built
# in `deps` (glibc, this Bun ABI) is guaranteed compatible with `runner`.
ARG BUN_VERSION=1.4.0

########################################################################
# deps - install every workspace dependency once, from the lockfile only.
#
# Only manifests are copied here, so this layer is cache-invalidated by a
# dependency change, never by editing application source. `builder` and
# `runner` both reuse it verbatim instead of running `bun install` again.
########################################################################
FROM oven/bun:${BUN_VERSION}-slim AS deps
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
COPY packages/config/package.json packages/config/
COPY packages/env/package.json packages/env/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/api/package.json packages/api/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/

RUN bun install --frozen-lockfile

########################################################################
# builder - compile the TanStack Start app to a self-contained Nitro bundle.
#
# The UI and the API are served from one TanStack Start origin, so the
# server bundle pulls in every workspace package below, not just the
# UI-facing ones.
########################################################################
FROM deps AS builder
WORKDIR /app

COPY packages/ packages/
COPY apps/web/ apps/web/

# Build-time env validation would otherwise fail on the placeholder secrets
# below - real ones only ever exist in the running container, injected at
# `docker run`/compose time.
ENV SKIP_ENV_VALIDATION=1 \
    NODE_ENV=production

RUN cd apps/web && bun run build

########################################################################
# runner - the smallest tree that can serve the build and run migrations.
########################################################################
FROM oven/bun:${BUN_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# The Nitro build output targets the "node-server" preset (see
# apps/web/.output/nitro.json) - it was never built for Bun. Serving it
# through Bun's Node-compatibility shim instead of real Node.js hits
# TanStack Start's documented Bun-specific SSR streaming bug: the
# dehydrated router state occasionally arrives truncated/corrupted client
# side, crashing hydration with "Cannot read properties of undefined
# (reading 'manifest')" on direct/hard page loads (see
# https://github.com/TanStack/router/issues/3989). Installing real Node.js
# alongside Bun and using it only to run the built server avoids this
# entirely; Bun still does the install/build/migrate steps everywhere else.
RUN apt-get update && apt-get install -y --no-install-recommends nodejs && rm -rf /var/lib/apt/lists/*

# Every workspace dependency, including drizzle-kit (packages/db's own
# dependency that the migration step below shells out to) - reused as-is
# from `deps` rather than reinstalled.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/bun.lock ./bun.lock

# Only what `bun run db:migrate:deploy` touches at startup: schema, generated
# SQL and the wrapper script. Everything else (auth, api, ui, web source) is
# already inlined into the Nitro bundle copied below, so it never needs to
# exist in this image.
COPY packages/db/ packages/db/
COPY packages/env/ packages/env/

# Flattened to /app/.output (not nested under apps/web/) so its bundled
# chunks resolve @libsql's platform-native binary by walking up to the single
# ./node_modules above.
COPY --from=builder --chown=bun:bun /app/apps/web/.output ./.output

# `bun` (uid 1000) is the non-root user already baked into this base image.
RUN mkdir -p /app/data && chown bun:bun /app/data
USER bun

# Unprivileged: a non-root user cannot bind ports below 1024 anyway, and this
# matches the app's own dev-server port everywhere else in the repo.
ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Apply pending Drizzle migrations against the mounted SQLite file, then
# serve. A failed migration exits non-zero and never starts the server.
CMD ["sh", "-c", "cd packages/db && bun run db:migrate:deploy && cd /app && exec node .output/server/index.mjs"]

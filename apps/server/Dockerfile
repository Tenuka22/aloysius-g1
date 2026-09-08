FROM oven/bun:1 AS builder
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1

COPY package.json bun.lock* ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/api/package.json packages/api/
COPY packages/env/package.json packages/env/
COPY apps/server/package.json apps/server/
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

COPY packages/config/ packages/config/
COPY packages/db/ packages/db/
COPY packages/auth/ packages/auth/
COPY packages/api/ packages/api/
COPY packages/env/ packages/env/
COPY apps/server/ apps/server/

ENV NODE_ENV=production
RUN cd apps/server && bun run build

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser

COPY package.json bun.lock* ./
COPY packages/config/ packages/config/
COPY packages/db/ packages/db/
COPY packages/auth/ packages/auth/
COPY packages/api/ packages/api/
COPY packages/env/ packages/env/
COPY apps/server/package.json apps/server/
COPY --from=builder /app/apps/server/dist apps/server/dist/

RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

USER appuser

EXPOSE 3000

WORKDIR /app/apps/server
CMD ["sh", "-c", "bun /app/packages/db/scripts/backup.ts && bun run drizzle-kit migrate --config /app/packages/db/drizzle.config.ts && bun dist/index.mjs"]

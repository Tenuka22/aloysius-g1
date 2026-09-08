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

COPY --from=builder --chown=appuser:appgroup /app/package.json /app/bun.lock* ./
COPY --from=builder --chown=appuser:appgroup /app/packages/config/package.json packages/config/
COPY --from=builder --chown=appuser:appgroup /app/packages/db/package.json packages/db/
COPY --from=builder --chown=appuser:appgroup /app/packages/db/src/migrations packages/db/src/migrations/
COPY --from=builder --chown=appuser:appgroup /app/packages/db/drizzle.config.ts packages/db/
COPY --from=builder --chown=appuser:appgroup /app/packages/auth/package.json packages/auth/
COPY --from=builder --chown=appuser:appgroup /app/packages/api/package.json packages/api/
COPY --from=builder --chown=appuser:appgroup /app/packages/env/package.json packages/env/
COPY --from=builder --chown=appuser:appgroup /app/apps/server/package.json apps/server/
COPY --from=builder --chown=appuser:appgroup /app/apps/server/dist apps/server/dist/

USER appuser

EXPOSE 3000

WORKDIR /app/apps/server
CMD ["sh", "-c", "bun --cwd /app/packages/db run db:migrate && bun dist/index.mjs"]

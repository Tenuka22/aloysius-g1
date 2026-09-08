FROM oven/bun:1 AS builder
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1

COPY package.json bun.lock* ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/api/package.json packages/api/
COPY packages/ui/package.json packages/ui/
COPY packages/env/package.json packages/env/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

COPY packages/config/ packages/config/
COPY packages/ui/ packages/ui/
COPY packages/env/ packages/env/
COPY apps/web/ apps/web/

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV NODE_ENV=production
RUN cd apps/web && bun run build

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser

COPY --from=builder --chown=appuser:appgroup /app/apps/web/.output ./.output

USER appuser

# Non-root cannot bind privileged ports under Podman/Docker without extra caps.
ENV PORT=3000
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]

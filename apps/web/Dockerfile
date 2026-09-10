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
RUN bun install --frozen-lockfile

# The app serves the UI and the API from one origin, so the server routes pull
# in every workspace package - not just the UI ones.
COPY packages/ packages/
COPY apps/web/ apps/web/

ENV NODE_ENV=production
RUN cd apps/web && bun run build

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production

# Nitro emits a Node server, so the runtime needs Node itself rather than only Bun.
RUN apt-get update \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser

# Migrations run at startup through drizzle-kit, which needs the workspace
# install plus the generated SQL and schema.
COPY package.json bun.lock* ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/api/package.json packages/api/
COPY packages/ui/package.json packages/ui/
COPY packages/env/package.json packages/env/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile
COPY packages/db/ packages/db/
COPY packages/env/ packages/env/

COPY --from=builder --chown=appuser:appgroup /app/apps/web/.output ./.output

RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data
USER appuser

# Non-root cannot bind privileged ports under Podman/Docker without extra caps.
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "cd /app/packages/db && bunx drizzle-kit migrate && cd /app && exec node .output/server/index.mjs"]

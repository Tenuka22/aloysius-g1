FROM node:24-slim AS builder
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV NODE_ENV=production
RUN cd apps/web && bun run build

FROM node:24-slim AS runner
WORKDIR /app
COPY --from=builder /app/apps/web/.output ./.output

ENV NODE_ENV=production
ENV PORT=80
EXPOSE 80
CMD ["node", ".output/server/index.mjs"]

# Aloysius Admissions

Grade 1 admissions portal for **St. Aloysius' College, Galle**.

Guardians open an application with a private access key, fill in applicant,
guardian, residence and marking-scheme details, and submit. Staff score and
manage those applications from an admin console covering applications,
admissions, the school catalog, map view, mark allocation, data extraction and
access/removal requests.

- Public portal and API: <http://localhost:3001>

## Stack

| Layer | Choice |
| --- | --- |
| Runtime / package manager | Bun 1.3 |
| Monorepo orchestration | Nx, Bun workspaces |
| Web | TanStack Start + TanStack Router, React 19, Vite 8 |
| Styling | Tailwind CSS 4, shadcn/Base UI primitives in `packages/ui` |
| API | TanStack Start server routes, same origin as the UI |
| RPC | oRPC (typed RPC plus a generated OpenAPI reference) |
| Auth | Better Auth (admin + multi-session plugins) |
| Database | SQLite via Turso (libSQL), Drizzle ORM + drizzle-kit migrations |
| Lint / format | Biome |
| Tests | Vitest (unit), `bun test` (database integration) |

## Prerequisites

- [Bun](https://bun.sh) 1.3 or newer
- Podman or Docker, only for the container workflows
- [uv](https://docs.astral.sh/uv/), only to run the school-catalog scraper

## Quick start

```bash
bun install
```

Create `apps/web/.env` (see [Environment](#environment)), then create the
database and start everything:

```bash
bun run db:push   # create/refresh the SQLite schema
bun run dev       # UI and API together on :3001
```

On first boot the app ensures a site admin exists:

- Email: `admin@aloysiuscollege.lk`
- Password: whatever `ADMIN_PASSWORD` is set to

## Environment

The app validates its environment at import time and refuses to start when a
variable is missing, so fill these in before running anything.

### `apps/web/.env`

| Variable | Required | Notes |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | yes | A local `file:` path for development (relative values resolve from the repo root, e.g. `file:../../data/local.db`), or a `libsql://<db>.turso.io` URL for a hosted Turso database. |
| `TURSO_AUTH_TOKEN` | only for a remote Turso URL | Auth token for the hosted database. Unused (and unnecessary) for a local `file:` URL. |
| `BETTER_AUTH_SECRET` | yes | At least 32 characters. |
| `BETTER_AUTH_URL` | yes | Public origin of the app, e.g. `http://localhost:3001`. |
| `NODE_ENV` | no | `development` (default), `production` or `test`. |
| `ADMIN_PASSWORD` | no | Site-admin password, min 8 chars. Change it before deploying. |
| `SUB_ADMIN_PASSWORD` | no | Sub-admin password, min 8 chars. |
| `SUB_ADMIN_EMAILS` | no | Comma-separated sub-admin logins seeded on boot. Defaults to `subadmin@aloysiuscollege.lk`. Each is created with `SUB_ADMIN_PASSWORD` if absent, and its `sub-admin` role is reasserted on every start. |

Set `SKIP_ENV_VALIDATION=1` to bypass validation during builds that never read
these values.

## Project layout

```
aloysius-g1/
├── apps/
│   ├── web/           # TanStack Start app: React 19 UI plus the API it serves
│   └── map-scraper/   # Python/uv tool that builds the school catalog
├── packages/
│   ├── api/           # oRPC routers and business logic
│   ├── auth/          # Better Auth configuration and admin bootstrap
│   ├── db/            # Drizzle schema, migrations, seed
│   ├── env/           # Validated environment schema
│   ├── ui/            # Shared shadcn/Base UI components and design tokens
│   └── config/        # Shared TypeScript config
├── data/              # Local SQLite database for development (git-ignored)
└── docker-compose.yml # Docker/Podman Compose stack (apps/web/Dockerfile)
```

## Scripts

### Development

| Command | Description |
| --- | --- |
| `bun run dev` | Start web and server together |
| `bun run dev:web` | Start only the web app |
| `bun run dev:server` | Start only the API |
| `bun run build` | Build every app |
| `bun run check-types` | TypeScript check across the workspace |
| `bun run lint` / `lint:fix` | Biome check, optionally autofixing |
| `bun run format` | Biome formatter |

### Database

| Command | Description |
| --- | --- |
| `bun run db:push` | Push the schema straight to SQLite (development) |
| `bun run db:generate` | Generate a migration from schema changes |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:seed` | Seed reference data |
| `bun run db:auth` | Regenerate the Better Auth Drizzle schema |

### Tests

| Command | Description |
| --- | --- |
| `bun run test` | Vitest unit and component suites |
| `bun run test:integration` | `bun test` suites that hit a real SQLite database |
| `bun run test:all` | Both of the above |

Integration suites are named `*.integration.test.ts` and run under Bun rather
than Vitest, matching the rest of the test:integration setup.

## UI

Shared primitives live in `packages/ui`.

- Design tokens and global styles: `packages/ui/src/styles/globals.css`
- Components: `packages/ui/src/components/*`
- shadcn aliases: `packages/ui/components.json`, `apps/web/components.json`

Add shared primitives from the repo root:

```bash
bunx shadcn@latest add dialog popover sheet table -c packages/ui
```

Import them through the workspace alias:

```tsx
import { Button } from "@aloysius-admissions/ui/components/button";
```

For blocks that only one app needs, run the shadcn CLI from `apps/web` instead.

## School catalog

`apps/web/src/lib/g1/schools.json` holds the 429-school catalog and is
generated, not hand-written. `apps/web/src/lib/g1/schools.ts` only declares the
types and gives that JSON a type once, so application code imports `SCHOOLS`
from the module rather than reaching for the JSON directly.

The data comes from `apps/map-scraper`, which reads
`apps/map-scraper/schools.csv` — the formatted conversion of the
2018 *List of Government Schools* (converted once from the original text
extraction by `convert_schools_csv.py`) — and merges Google Maps coordinates cached
in `map_coordinates.json`.

```bash
cd apps/map-scraper
uv sync
uv run main.py          # parse the listing and regenerate the catalog
uv run python -m src.rescue   # re-scrape coordinates that are still missing
```

Regeneration is idempotent: rerunning `main.py` against an unchanged listing and
cache reproduces the committed catalog byte for byte, so any diff is a real
change worth reviewing. Coordinates already present in the catalog are carried
forward when the scrape cache has nothing newer, so a refresh never silently
drops a location.

Schools that Maps cannot pin down are left without coordinates and are filled in
by an admin through the schools hub; those overrides live in the database, not
in the generated file. The admin hub can also bulk-seed overrides from
`apps/map-scraper/schools_data.json` — the scraper's richer output, which keeps
the source address and Maps URL that the web catalog deliberately omits.

## Deployment

### Vercel + Turso

The app builds through the Nitro Vite plugin already wired into
`apps/web/vite.config.ts`, which Vercel detects with zero extra config.
`apps/web/package.json`'s `vercel-build` script runs pending Drizzle
migrations against `TURSO_DATABASE_URL` before every build, so the schema
never needs a manual push - including the very first deploy, which creates
every table from scratch.

1. **Create the Turso database** (once): [`turso db create`](https://docs.turso.tech/quickstart)
   or the [Turso Cloud dashboard](https://app.turso.tech), then grab its URL and
   an auth token with `turso db show <db> --url` and `turso db tokens create <db>`.
2. **Import the repo into Vercel.** In Project Settings -> General, set
   **Root Directory** to `apps/web` and enable **"Include files outside the
   Root Directory in the Build Step"** - the app depends on sibling workspace
   packages (`packages/*`) that live outside `apps/web`.
3. **Add the Turso Cloud integration** from the
   [Vercel Marketplace](https://vercel.com/marketplace/tursocloud) and attach
   this database, which injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
   automatically - or add them yourself under Project Settings -> Environment
   Variables using the values in `apps/web/.env.production`.
4. **Set the remaining variables** (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
   `ADMIN_PASSWORD`, `SUB_ADMIN_PASSWORD`, `SUB_ADMIN_EMAILS`,
   `VITE_LOCATION_SEAL_SECRET`) for the Production environment. `BETTER_AUTH_URL`
   must be the public HTTPS origin the app is served from (e.g.
   `https://admissions.aloysiuscollege.lk`).
5. **Deploy** by pushing to the connected branch, or `npx vercel deploy --prod`
   from `apps/web`.

Backups are Turso's responsibility once deployed - see
[Turso's built-in point-in-time recovery](https://docs.turso.tech/features/point-in-time-recovery)
or `turso db shell <db> .dump`.

### Podman Compose

Docker/Podman Compose remain available for self-hosting against a local
SQLite file instead of Turso. `docker-compose.yml` at the repo root builds
`apps/web/Dockerfile` and runs the one service - the TanStack Start app
serves the UI and the API from a single origin - published on `3001`.

| Command | Description |
| --- | --- |
| `bun run podman:build` | Build the image |
| `bun run podman:up` | Build and start in the background |
| `bun run podman:logs` | Tail logs |
| `bun run podman:down` | Stop and remove |
| `bun run docker:build` / `docker:up` / `docker:logs` / `docker:down` | Same commands through `docker compose` |

Runtime configuration comes from `apps/web/.env` (copy `apps/web/.env.example`
to start), with `TURSO_DATABASE_URL` and `PORT` overridden in the compose file
so the database always lands in the `db-data` volume and the container always
listens on the port it's published on. The container applies pending Drizzle
migrations before it starts serving; a failed migration exits non-zero rather
than starting a server with a stale schema.

The container runs as the base image's non-root `bun` user. Set `WEB_PORT` to
publish on a different host port, and `BETTER_AUTH_URL` to match - the app
makes same-origin requests back to itself during server rendering, so the two
need to agree.

`db-data` is a named Docker volume, not a bind mount to a host directory:
SQLite needs POSIX file locking that Docker Desktop's bind-mount translation
(Windows/WSL2 and macOS alike) doesn't reliably provide. Back it up with
`docker compose exec web sh -c "sqlite3 /app/data/local.db .dump"`.

### Published image

`docker.io/tenuka22/aloysius-admissions` is the published image, built from
`apps/web/Dockerfile`:

```bash
podman pull docker.io/tenuka22/aloysius-admissions:latest
```

Publishing a new tag:

```bash
podman build -f apps/web/Dockerfile -t docker.io/tenuka22/aloysius-admissions:latest .
SHA=$(git rev-parse --short HEAD)
podman tag docker.io/tenuka22/aloysius-admissions:latest "docker.io/tenuka22/aloysius-admissions:$SHA"
podman push docker.io/tenuka22/aloysius-admissions:latest
podman push "docker.io/tenuka22/aloysius-admissions:$SHA"
```

## Operational notes

- The API resolves each caller's IP from the socket rather than from
  `X-Forwarded-For`, which is caller-controlled while nothing proxies the
  process. If you put a reverse proxy in front, resolve the forwarded chain in
  `packages/auth/src/client-ip-header.ts` — it is the single place that decides.
- No request rate limiting is applied: the server has no limiter of its own and
  better-auth's built-in per-IP limiter is disabled in `packages/auth/src/index.ts`.

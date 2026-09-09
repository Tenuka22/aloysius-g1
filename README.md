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
| Database | SQLite via `bun:sqlite`, Drizzle ORM + drizzle-kit migrations |
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
| `DATABASE_URL` | yes | SQLite path. Relative values resolve from the repo root, e.g. `../../data/local.db`. A `file:` prefix is accepted. |
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
│   ├── db/            # Drizzle schema, migrations, seed, backup/restore
│   ├── env/           # Validated environment schema
│   ├── ui/            # Shared shadcn/Base UI components and design tokens
│   ├── config/        # Shared TypeScript config
│   └── docker/        # Side-by-side Docker Compose stack
├── data/              # SQLite database and backups (git-ignored)
└── docker-compose.yml # Podman Compose stack
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
| `bun run db:migrate` | Back up, then apply pending migrations |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:seed` | Seed reference data |
| `bun run db:auth` | Regenerate the Better Auth Drizzle schema |

Run backup and restore from `packages/db`:

```bash
bun --cwd packages/db run db:backup
bun --cwd packages/db run db:restore            # newest backup
bun --cwd packages/db run db:restore 2026-01-01_12-00-00-000.db
```

Backups land in `data/backups`. A snapshot is taken before every migration and
every six hours while the server runs. Snapshots identical to the previous one
are skipped, so a restart loop cannot churn through the retention window.
Retention keeps everything from the last 30 days, never fewer than 10 backups
and never more than 200.

### Tests

| Command | Description |
| --- | --- |
| `bun run test` | Vitest unit and component suites |
| `bun run test:integration` | `bun test` suites that hit a real SQLite database |
| `bun run test:all` | Both of the above |

Integration suites are named `*.integration.test.ts` and run under Bun rather
than Vitest, because they import `bun:sqlite`.

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

The data comes from `apps/map-scraper`, which parses
`apps/map-scraper/schools.txt` — the layout-preserving text extraction of the
2018 *List of Government Schools* — and merges Google Maps coordinates cached
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

### Podman Compose

`docker-compose.yml` at the repo root builds and runs both apps. Web is
published on `3001`, the API on `3000`.

| Command | Description |
| --- | --- |
| `bun run podman:build` | Build the image |
| `bun run podman:up` | Build and start in the background |
| `bun run podman:logs` | Tail logs |
| `bun run podman:down` | Stop and remove |

Runtime configuration comes from `apps/web/.env`, with the database path and
public origin overridden in the compose file. The container takes a backup and
applies pending Drizzle migrations before it starts serving.

The container runs as a non-root user and therefore listens on an unprivileged
port inside the container; the published host port is unchanged.

### Docker Compose, side by side

`packages/docker/docker-compose.yml` runs the same app on `3101` so it can
coexist with the Podman stack. Both share the repository's `data/` directory
for SQLite.

```bash
bun run docker:up
bun run docker:logs
bun run docker:down
```

### Published images

| Service | Image | Package |
| --- | --- | --- |
| Server | `ghcr.io/tenuka22/aloysius-g1-server` | [aloysius-g1-server](https://github.com/users/Tenuka22/packages/container/package/aloysius-g1-server) |
| Web | `ghcr.io/tenuka22/aloysius-g1-web` | [aloysius-g1-web](https://github.com/users/Tenuka22/packages/container/package/aloysius-g1-web) |

Each image is tagged `latest` plus the short commit SHA it was built from.
Public packages can be pulled anonymously; while a package is private, pulling
needs a token with `read:packages`:

```bash
gh auth token | podman login ghcr.io -u <github-username> --password-stdin
podman pull ghcr.io/tenuka22/aloysius-g1-server:latest
```

Publishing needs `write:packages`
(`gh auth refresh -h github.com -s write:packages`):

```bash
bun run podman:build
SHA=$(git rev-parse --short HEAD)
for svc in server web; do
  podman tag "aloysius-admissions-podman-$svc" "ghcr.io/tenuka22/aloysius-g1-$svc:$SHA"
  podman tag "aloysius-admissions-podman-$svc" "ghcr.io/tenuka22/aloysius-g1-$svc:latest"
  podman push "ghcr.io/tenuka22/aloysius-g1-$svc:$SHA"
  podman push "ghcr.io/tenuka22/aloysius-g1-$svc:latest"
done
```

## Operational notes

- The API resolves each caller's IP from the socket rather than from
  `X-Forwarded-For`, which is caller-controlled while nothing proxies the
  process. If you put a reverse proxy in front, resolve the forwarded chain in
  `packages/auth/src/client-ip-header.ts` — it is the single place that decides.
- No request rate limiting is applied: the server has no limiter of its own and
  better-auth's built-in per-IP limiter is disabled in `packages/auth/src/index.ts`.

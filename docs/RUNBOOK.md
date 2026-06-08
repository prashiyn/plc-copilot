# PLCAutoPilot Runbook

Operational guide for developing and running the app. Updated as each v1.5 phase lands — treat it as the single source of truth for "how do I run / verify this."

## Prerequisites
- Node.js 20+ and npm
- Docker + Docker Compose (for local Postgres)
- An `ANTHROPIC_API_KEY` (for the live AI routes)

## First-time setup
```bash
npm install
cp .env.example .env          # fill in ANTHROPIC_API_KEY; DATABASE_URL default works with Docker
docker compose up -d          # start Postgres 16 (container: plc-copilot-db)
npm run db:migrate            # apply migrations -> creates all tables
npm run dev                   # http://localhost:3000
```

## Core commands
| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (http://localhost:3000) |
| `npm run build` | Production build (note: `ignoreBuildErrors: true` is set) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit -p tsconfig.json` | Real typecheck (build skips type errors) |
| `docker compose up -d` / `down` | Start / stop Postgres |
| `npm run db:generate` | Generate a new migration from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema directly (dev shortcut; prefer generate+migrate) |
| `npm run db:studio` | Open Drizzle Studio to browse data |

## Database
- **Engine:** Postgres 16 (local via Docker; prod = managed/self-hosted, same code).
- **ORM:** Drizzle. Schema: [lib/db/schema.ts](../lib/db/schema.ts). Client: `import { db } from '@/lib/db'`.
- **Connection string:** `DATABASE_URL` in `.env` (default `postgresql://plc:plc@localhost:5432/plc_copilot`).
- **Reset DB (destructive):** `docker compose down -v && docker compose up -d && npm run db:migrate`
- **Inspect tables:** `docker exec plc-copilot-db psql -U plc -d plc_copilot -c '\dt'`

## Conventions
- Schema changes: edit `lib/db/schema.ts` → `npm run db:generate` → review the SQL in `lib/db/migrations/` → `npm run db:migrate`. Commit the migration files.
- Don't commit `.env` (gitignored). Keep `.env.example` in sync when adding vars.
- Keep docs under `docs/` — run `/organize-docs` if stray docs accumulate.

---

## Phase log

### Phase 0 — Local Postgres + Drizzle foundation ✅
- Added Drizzle schema (14 tables), connection, migrations, Docker Postgres, db scripts.
- Removed dead deps (Supabase, Gemini); archived `supabase/` → `archive/supabase/`.
- **Verify:** `docker compose up -d && npm run db:migrate` → 14 tables; `npm run build` passes.

### Phase 1 — Auth & users (Auth.js v5) 🚧
Planned steps (check off as implemented):
- [ ] Install `next-auth@5` (Auth.js v5) + `bcryptjs`.
- [ ] `auth.ts` config with Credentials provider (email + bcrypt-verified password) backed by the `users` table.
- [ ] JWT session strategy carrying `userId`, `role`, `organizationId`.
- [ ] `app/api/auth/[...nextauth]/route.ts` handler + `AUTH_SECRET` in `.env`/`.env.example`.
- [ ] Sign-up route/action: create org + user (bcrypt hash), seed first user as `superadmin`.
- [ ] Replace the localStorage demo-login in `app/login` with real Auth.js sign-in; keep a dev "Continue as Demo User" seed path.
- [ ] `middleware.ts` protecting `(features)/*`; redirect unauthenticated → `/login`.
- [ ] Surface session (name/role) in the app shell; wire sign-out.
- **Verify:** sign up → row in `users`; protected route redirects when logged out; session persists across reload; role available server-side.

### Phase 2 — Persistence for core features ⏳
- CRUD for `projects`, `generated_programs`, `usage_analytics`; real dashboard counts.

### Phase 3 — Make mock routes real ⏳
- `recommend-plc` / `recommend-solution` (model DB + Claude), `rectify-error` (Claude), decide `sap/*`.

### Phase 4 — Platform integrations ⏳
- Real Siemens / Rockwell / Mitsubishi / CODESYS export.

### Phase 5 — Billing/Stripe (deferred to v1.6) ⏳

---

## Troubleshooting
- **`DATABASE_URL is not set`** → create `.env` from `.env.example`.
- **Migration can't connect** → is the container up? `docker compose ps`; healthy? `docker inspect -f '{{.State.Health.Status}}' plc-copilot-db`.
- **Port 5432 in use** → another Postgres is running; stop it or change the host port in `docker-compose.yml`.

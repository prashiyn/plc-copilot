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

### Phase 1 — Auth & users (Auth.js v5) ✅
- [x] `next-auth@5` (Auth.js v5) + `bcryptjs` installed.
- [x] Split config: `auth.config.ts` (edge-safe, used by middleware) + `auth.ts` (Node, Credentials provider with bcrypt against `users`).
- [x] JWT session strategy carrying `id`, `role`, `organizationId` (types in `next-auth.d.ts`).
- [x] `app/api/auth/[...nextauth]/route.ts` handler + `AUTH_SECRET` in `.env`/`.env.example`.
- [x] `app/api/register` (creates org + user, bcrypt hash, first user = `superadmin` else `admin`) + `app/signup` page.
- [x] Real Auth.js sign-in in `app/login`; "Continue as Demo User" signs in the seeded demo account.
- [x] `middleware.ts` protects the `(features)` route group; unauthenticated → `/login?callbackUrl=...`.
- [x] Session + sign-out surfaced in `Sidebar`; `(features)/layout` wraps children in `SessionProvider`.

**Auth runbook:**
- Seed the dev demo user: `npm run db:seed` → **demo@plcai.com / demo1234** (superadmin).
- `AUTH_SECRET` is required (`openssl rand -base64 33`); already set in local `.env`.
- **Verified (curl):** middleware redirects unauthenticated `/dashboard` → `/login` (307); CSRF + credentials sign-in sets a session; `/api/auth/session` returns `role`/`organizationId`; protected route then returns 200; wrong password yields no session; `/api/register` creates an `admin` user.

### Phase 2 — Persistence for core features ✅
- `lib/db/queries.ts`: auth-scoped data access (by organization, falls back to user).
- API: `/api/projects` (GET/POST), `/api/projects/[id]` (PATCH/DELETE), `/api/dashboard/stats` (GET), `/api/programs` (GET/POST). All 401 without a session.
- Pages on real data: `projects/active` (create/complete/delete), `projects/completed` (reopen/delete), `dashboard` (real counts + recent projects).
- `usage_analytics` logged on `project_created` / `program_generated`.
- **Verify:** sign in (demo) → add a project on `/projects/active` → it shows on the dashboard and counts increment → "Mark Complete" moves it to `/projects/completed`.
- **Remaining (folds into Phase 3):** wire the generator UI to POST to `/api/programs` so generated code persists automatically.

### Phase 3 — Make mock routes real ✅
- `lib/ai-recommend.ts`: flattens the PLC model DB into a catalog + a Claude JSON helper (`askClaudeJson`). Throws without `ANTHROPIC_API_KEY` so callers fall back.
- `recommend-plc`: Claude grounded by the catalog → existing `RecommendedPLC` shape; deterministic scorer as fallback (`source: 'ai' | 'fallback'`).
- `recommend-solution`: Claude generates the rich `Solution[]`, fed into the existing ranking/comparison; deterministic generator as fallback.
- `rectify-error`: Claude analysis + corrected code; pattern matcher as fallback.
- Generator output auto-persists: `generate-plc` and `generate-plc-ai` save to `generated_programs` for signed-in users (never blocks generation).
- `sap/*`: kept **simulated** for v1.5 — response carries `simulated: true` and an amber banner on the export page. Live SAP RFC/OData is post-v1.5.
- **AI path needs `ANTHROPIC_API_KEY` in `.env`.** Without it, all routes use their fallbacks (verified). Model: `CLAUDE_MODEL` (default `claude-3-haiku-20240307`).
- **Verify:** with a key set, `POST /api/recommend-plc` returns `source: 'ai'`; without it, `source: 'fallback'`. Generator persistence verified (programsGenerated increments for signed-in users).

### Phase 4 — Platform integrations ⏳
- Real Siemens / Rockwell / Mitsubishi / CODESYS export.

### Phase 5 — Billing/Stripe (deferred to v1.6) ⏳

---

## Troubleshooting
- **`DATABASE_URL is not set`** → create `.env` from `.env.example`.
- **Migration can't connect** → is the container up? `docker compose ps`; healthy? `docker inspect -f '{{.State.Health.Status}}' plc-copilot-db`.
- **Port 5432 in use** → another Postgres is running; stop it or change the host port in `docker-compose.yml`.

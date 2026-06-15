# PLCAutoPilot Runbook

Operational guide for developing and running the app. Updated as each v1.5 phase lands — treat it as the single source of truth for "how do I run / verify this."

**Current engineering focus:** v1.5 **shipped** (§7.0 through **4b′**). Phase 5 work → [PHASE_5_IMPLEMENTATION.md](architecture/PHASE_5_IMPLEMENTATION.md). **Billing / Stripe is out of scope** — UI pages may exist but are not being implemented.

## Prerequisites
- Node.js 20+ and npm
- Docker + Docker Compose (Postgres, Redis, automation-api, automation-worker)
- An `ANTHROPIC_API_KEY` (for the automation worker — all Claude calls run in Python)

## First-time setup
```bash
npm install
cp .env.example .env          # fill in ANTHROPIC_API_KEY, AUTOMATION_API_KEY
docker compose up -d          # Postgres + Redis + automation-api + worker
npm run db:migrate            # apply migrations -> creates all tables
npm run dev                   # http://localhost:3000
```

Automation API docs (when Compose is up): http://localhost:8000/docs

## Core commands
| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (http://localhost:3000) |
| `npm run build` | Production build (note: `ignoreBuildErrors: true` is set) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit -p tsconfig.json` | Real typecheck (build skips type errors) |
| `docker compose up -d` / `down` | Start / stop Postgres, Redis, automation-api, worker |
| `npm run db:generate` | Generate a new migration from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:push` | Push schema directly (dev shortcut; prefer generate+migrate) |
| `npm run db:studio` | Open Drizzle Studio to browse data |

| Command | What it does |
|---|---|
| `cd automation && uv sync` | Install Python deps (creates `.venv`, uses `uv.lock`) |
| `cd automation && uv sync --extra desktop` | Include PyAutoGUI deps for local desktop scripts |
| `cd automation && uv run uvicorn api.main:app --reload --port 8000` | Run automation API locally |
| `cd automation && uv run python -m api.worker` | Run job worker locally |
| `curl http://localhost:8000/health` | Automation API liveness |
| `curl -H "Authorization: Bearer $AUTOMATION_API_KEY" http://localhost:8000/v1/formats` | List supported PLC formats |

## Automation service
- **API:** FastAPI at `AUTOMATION_API_URL` (default http://localhost:8000). OpenAPI at `/docs`.
- **Worker:** `automation-worker` container consumes Redis job queue (sketch analysis, Claude AI, generation).
- **Next.js:** All `app/api/*` AI and sketch routes call `lib/automation-client.ts` — no `python3` spawn.
- **Auth:** Next.js sends `Authorization: Bearer ${AUTOMATION_API_KEY}`; key must match on both sides.
- **Local dev (without Docker):** `cd automation && uv sync` then `uv run uvicorn api.main:app --reload` and `uv run python -m api.worker` (requires Redis: `docker compose up -d redis`).

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
- **AI path needs automation stack running.** `docker compose up -d` starts Redis + `automation-api` + `automation-worker`. Set `ANTHROPIC_API_KEY` in `.env` (passed to worker). Next.js uses `AUTOMATION_API_URL` + `AUTOMATION_API_KEY`.
- **Verify:** `curl http://localhost:8000/health` → `{"status":"ok"}`; with key set, `POST /api/recommend-plc` returns `source: 'ai'`.

### Automation API — FastAPI + Redis jobs ✅ (Phase 0–1)
- FastAPI service: `automation/api/` — health, formats, sketches, AI, job status.
- Redis job queue + `automation-worker` container; no `spawn('python3')` in Next.js.
- Python deps managed with **uv** (`automation/pyproject.toml`, `uv.lock`).
- All Anthropic calls moved to Python (`/v1/ai/chat`, `/v1/ai/json`, `/v1/ai/m221/generate`).
- Next.js client: `lib/automation-client.ts`; sketch routes + all `app/api/ai-*` migrated.
- **Design:** [architecture/FASTAPI_AUTOMATION_SERVICE.md](architecture/FASTAPI_AUTOMATION_SERVICE.md)
- **Verify:** `docker compose up -d && curl http://localhost:8000/ready`; enqueue via `/docs`; sketch analyze from UI.

### Automation API — Program generation ✅ (Phase 2)
- Endpoints: `POST /v1/programs/generate`, `/v1/programs/plcopen`, `/v1/programs/parse` (async jobs).
- Patterns: `motor_startstop`, `sequential_lights` (Schneider + Rockwell); PLCopen export via `PLCAutomation`.
- Client helpers: `generateProgram`, `generateProgramFromDescription`, `exportPlcopen`, `parseProgram` in `lib/automation-client.ts`.
- Tests: `cd automation && uv sync --extra dev && uv run pytest api/tests`.

### Next.js generator consolidation ✅ (Phase 3 + 4f-3)
- `POST /api/generate-plc` → `lib/plc-generation.ts` → FastAPI (`/v1/programs/generate` or `/v1/programs/plcopen`).
- Tier-2 vendors: Siemens → `.scl`, Mitsubishi → IL/ST/CSV ZIP via `resolveTier2Platform()` (no PLCopen fallback for motor).
- `POST /api/download-program` → regenerates via FastAPI (no TS template wrappers).
- TS generators under `app/api/generate-plc/generators/` deprecated; logic in `lib/plc-generation.ts`.
- Tests: `npm run test:plc` (pattern detection, tier-2 routing, preview helpers).
- **Verify:** `/generator` — Schneider/Rockwell native files; Siemens `.scl`; Mitsubishi `.zip`; Tier-2 disclaimer shown.

### M221 AI generation ✅ (Phase 4 + 4e-3)
- `POST /api/generate-plc-ai` → `/v1/programs/m221/generate` (`ClaudeIrService` → `m221_adapter` → Calaos `.smbp`).
- Builder: `automation/api/services/m221_smbp_builder.py` (template: `samples/tankcontrol.smbp`).
- Client: `generateM221Program()`, `buildM221Program()` in `lib/automation-client.ts`; AI responses include `ir` for persistence.
- Tests: `cd automation && uv run pytest api/tests/test_m221.py api/tests/test_m221_api.py`.
- **Verify:** `/m221-generator` and `/ai-generator` download Calaos/Case 2.0 `.smbp` files.

### Phase 5 — IR + validation ✅
- Pydantic IR schema: `automation/api/schemas/ir.py` (`PlcProgram`, `LogicNode`, patterns).
- Pattern library: `automation/api/ir/patterns.py` (`motor_startstop`, `sequential_lights`).
- Validator + serializer + round-trip: `automation/api/ir/{validator,serializer,roundtrip}.py`.
- Endpoints: `GET /v1/ir/patterns`, `POST /v1/ir/validate`, `/serialize`, `/roundtrip`, `/patterns/{name}`.
- Program generation routes through IR (`ProgramService` → `IrService`); `metadata.ir` returned on generate.
- TS types: `lib/plc-ir/types.ts`; client: `listIrPatterns`, `getIrPattern`, `validateIrProgram`, `serializeIrProgram`, `roundtripIrProgram`.
- `generationParameters.ir` persisted from `/api/generate-plc`; M221 AI persists `programData`.
- Round-trip CI: `uv run pytest api/tests/test_ir.py api/tests/test_ir_api.py` (export → parse → symbol match).
- **Verify:** `cd automation && uv run pytest api/tests -v`; `npm run test:plc && npm run build`.

### Phase 4e-1 — IR schema extensions ✅
- `TimerNode`, `CounterNode`, `PlcMeta.requireEstop`; extended validator (timer/counter kind checks, optional E-stop rules).
- JSON Schema export: `automation/api/ir/schema_export.py`; `GET /v1/ir/schema`.
- TS mirror: `lib/plc-ir/types.ts`; client: `getIrJsonSchema()`.
- **Verify:** `uv run pytest api/tests/test_ir.py api/tests/test_ir_api.py -v`; `npm run build`.

### Phase 4e-2 — Claude → IR service ✅
- `ClaudeIrService`: Claude JSON → `validate_program()` with up to 2 retries on validation errors.
- Pattern fallback via `ir/pattern_match.py` → `build_pattern()` when Claude fails.
- Job: `program.claude_ir`; endpoint: `POST /v1/ir/generate-from-description`.
- **Verify:** `uv run pytest api/tests/test_claude_ir.py -v`.

### Phase 4e-3 — Program API + M221 alignment ✅
- `ClaudeIrSource` on `POST /v1/programs/generate`; `ProgramService` calls `ClaudeIrService` and returns `metadata.ir`.
- M221 AI: `ClaudeIrService` → `ir/m221_adapter.py` → `M221SmbpBuilder` (Calaos `.smbp` preserved).
- BFF: `generationParameters.ir` from `/api/generate-plc-ai`; client: `generateProgramFromDescription()`.
- **Verify:** `uv run pytest api/tests -v` (59 tests); `npm run test:plc && npm run build`.

### Phase 4f-1 — Siemens SCL serializer ✅
- `ir/serializers/siemens_scl.py`: motor start/stop IR → importable `.scl` with `%I`/`%Q` addresses via `PlatformConverter`.
- `IrSerializer` routes `vendor == "siemens"`; metadata `format: scl`, `tier: 2`.
- `SiemensParser` parses generated `.scl` for symbol round-trip; `platform: siemens` on `/v1/programs/generate`.
- **Verify:** `uv run pytest api/tests/test_siemens_scl.py api/tests -k siemens -v`.

### Phase 4f-2 — Mitsubishi IL/ST + CSV Tier-2 export ✅
- `ir/serializers/mitsubishi.py`: motor IR → ZIP with `.il`, `.st`, and `_device_comments.csv` (addresses via `schneider_to_mitsubishi`).
- `IrSerializer` routes `vendor == "mitsubishi"`; metadata includes `limitations[]`, `formats: [il, st, csv]`, `tier: 2`.
- `MitsubishiParser` parses Tier-2 `.zip`/`.il`/`.csv` for symbol round-trip.
- **Verify:** `uv run pytest api/tests/test_mitsubishi.py api/tests -k mitsubishi -v` (83 tests total).

### Phase 4f-3 — Tier-2 BFF + generator download ✅
- `resolveTier2Platform()` / `resolveGenerationPath()` in `lib/plc-generation.ts`; motor logic calls `/v1/programs/generate` for Siemens/Mitsubishi.
- `PlcDownloadParams` extended with `exportTier`, `tier2Platform`; persisted in `generationParameters`.
- `/generator` shows Tier-2 source-import disclaimer + API `limitations`.
- **Verify:** `npm run test:plc && npm run build` (14 tests); manual `/generator` with Siemens or Mitsubishi + motor logic.

### Phase 4d′ — Schneider Calaos unification ✅
- Shared builder: `ir/serializers/schneider_calaos.py` (template: `samples/tankcontrol.smbp`).
- `IrSerializer._serialize_schneider()` and sequential Schneider path → IR → `m221_adapter` → Calaos XML.
- `M221SmbpBuilder` delegates to the same builder (AI + JSON build path unchanged externally).
- **Verify:** `uv run pytest api/tests/test_schneider_calaos.py api/tests/test_ir.py api/tests/test_m221.py -v` (92 tests total).

### Phase 4h — Validation hardening ✅
- Golden IR JSON: `api/tests/fixtures/ir/*.json` checked by `test_golden_ir.py`.
- Golden export SHA-256 manifest: `api/tests/fixtures/exports/manifest.json` checked by `test_golden_exports.py` (Schneider Calaos, Rockwell L5X, Siemens SCL, Mitsubishi ZIP, PLCopen).
- L5X well-formedness + parser checks: `test_l5x_schema.py`.
- PLCopen structural diff vs `samples/MotorControl_Universal.xml`: `test_plcopen_golden.py`.
- **Update golden fixtures after intentional serializer changes:**
  ```bash
  cd automation && uv run python api/tests/update_golden_fixtures.py
  uv run pytest api/tests/test_golden_ir.py api/tests/test_golden_exports.py api/tests/test_l5x_schema.py api/tests/test_plcopen_golden.py -v
  ```
- **Full CI:** `uv run pytest api/tests -v` (108 tests).

### Phase 4j — Pattern library expansion ✅
- Four new patterns: `estop_motor`, `tank_level`, `conveyor_startstop`, `traffic_lights` in `ir/patterns.py`.
- Pattern-specific validation in `ir/validator.py`; NL fallback in `pattern_match.py`.
- BFF detection in `lib/plc-generation.ts` (`detectPatternFromLogic`).
- Siemens/Mitsubishi Tier-2 expanded to motor-like patterns (`estop_motor`, `conveyor_startstop`).
- **Verify:** `uv run pytest api/tests/test_patterns_4j.py api/tests/test_ir.py -v` and `npm run test:plc`.

### Phase 4i — Sketch analysis → IR ✅
- Adapter: `ir/sketch_adapter.py` converts SketchAnalyzer JSON → validated `PlcProgram`.
- `ProgramService._generate_from_sketch_analysis()` and `SketchService.generate_from_sketch()` use `IrService.serialize()` (Schneider Calaos + Rockwell L5X).
- Sketch generate returns `metadata.ir` and `metadata.sketchConfidence`.
- Fixture: `api/tests/fixtures/sketch/motor_startstop_analysis.json`.
- **Verify:** `uv run pytest api/tests/test_sketch_ir.py -v`.

### Phase 4b′ — Provider registry refactor ✅
- Registry: `ir/registry.py` (`PlatformProvider`, `register_provider`, `get_provider`, `list_providers`).
- Providers: `ir/providers/{schneider_calaos,rockwell,siemens_scl,mitsubishi,plcopen}.py`.
- `IrSerializer` is a thin delegate — no vendor if/else chain.
- Shared helpers: `ir/serialize_helpers.py` (`file_result`, Rockwell element flattening).
- **Verify:** `uv run pytest api/tests/test_ir_registry.py api/tests -v` (156 tests total).

### Platform integrations sprint — complete ✅
All §7.0 phases through **4b′** are implemented. Phase 5 items (IDE sign-off, XSD hardening, export expansion) → [PHASE_5_IMPLEMENTATION.md](architecture/PHASE_5_IMPLEMENTATION.md).
- **Not in scope now:** billing (backlog §5 frozen), SAP, OAuth.

### v1.5 polish — complete ✅ (2026-06-14)
- **CLI `--from-sketch` / `--from-json`:** IR pipeline via `ProgramService` (Schneider + Rockwell).
- **BFF sketch metadata:** `POST /api/generate-from-sketch?include_metadata=true` → JSON with `ir`.
- **Tests:** `lib/sketch-generate-response.test.ts` (20 BFF tests total); `test_cli_json.py`.
- **Deprecated:** `plc_automation/create_*_smbp.py` + `plc_automation/README.md`.
- **Docs:** `FASTAPI_AUTOMATION_SERVICE.md` as-built; [PHASE_5_IMPLEMENTATION.md](architecture/PHASE_5_IMPLEMENTATION.md) renamed from backlog.
- **Verify:** `uv run pytest api/tests -v && npm run test:plc && npm run build`

### Phase 5 P0 — IDE import sign-off ✅ (automated gates)

Automated pre-import validation + lab export bundle for manual IDE testing.

| Command | Purpose |
|---------|---------|
| `cd automation && uv run python -m api.ide_signoff run` | Run automated gates; update `manifest.json` |
| `uv run python -m api.ide_signoff bundle` | Refresh lab exports under `api/tests/fixtures/ide_signoff/exports/` |
| `uv run python -m api.ide_signoff status` | Show automated/manual status per case |
| `uv run python -m api.ide_signoff record --case signoff_schneider_motor --status passed --tested-by "Name" --ide-version "1.2.0.5" --compiles true` | Record manual lab result |

**Automated gates (CI):** serialize → IR validate → round-trip parse → format structure → golden hash.  
**Tests:** `uv run pytest api/tests/test_ide_signoff.py -v`

**Manual lab (Windows with vendor IDEs):**

1. Open each file in `automation/api/tests/fixtures/ide_signoff/exports/`.
2. Follow `manualSteps` in `api/tests/fixtures/ide_signoff/manifest.json` for that case.
3. Record result with `ide_signoff record` (or edit manifest `manual` block).
4. Phase 5 P0 is **complete** when all seven cases show `manual.status=passed`.

| Export file | IDE |
|-------------|-----|
| `signoff_schneider_motor.smbp` | EcoStruxure Machine Expert - Basic |
| `signoff_schneider_sequential.smbp` | EcoStruxure Machine Expert - Basic |
| `signoff_rockwell_motor.L5X` | Studio 5000 Logix Designer |
| `signoff_rockwell_sequential.L5X` | Studio 5000 Logix Designer |
| `signoff_siemens_motor.scl` | TIA Portal (source import) |
| `signoff_mitsubishi_motor.zip` | GX Works3 (source import) |
| `signoff_codesys_motor.xml` | CODESYS (PLCopen XML) |

### Phase 5 P1 — CI hardening ✅ (2026-06-15)

| Command | Purpose |
|---------|---------|
| `uv run pytest api/tests/test_l5x_schema.py api/tests/test_calaos_schema.py -v` | XSD validation for Rockwell + Schneider exports |
| `uv run pytest api/tests/test_golden_exports.py -v` | Golden SHA-256 regression (19 export cases) |
| `uv run python api/tests/update_golden_fixtures.py` | Regenerate manifest after intentional serializer changes |

**Artifacts:** `api/validation/schemas/l5x-v32.xsd`, `calaos-case-2.0-subset.xsd`, `manifest.json`  
**Rockwell fix:** `.L5X` generator emits XSD-compliant text (no fake `<CData>` elements; no invalid `Use` on Program/Routine).

### Phase 5 P2 — Export scope expansion ✅ (2026-06-15)

| Command | Purpose |
|---------|---------|
| `uv run pytest api/tests/test_p2_export_scope.py -v` | All 6 patterns × Siemens/Mitsubishi/PLCopen + sketch Tier-2 |

**Delivered:** Tier-2 serializers accept all 6 IR patterns; PLCopen via `plcopen_from_ir.py`; sketch generate for `siemens` + `mitsubishi`; 31 golden export hashes.

**Updating schemas / older IDE versions:** [VENDOR_SCHEMA_MAINTENANCE.md](architecture/VENDOR_SCHEMA_MAINTENANCE.md)

| Command | Purpose |
|---------|---------|
| `uv run pytest api/tests/test_schema_registry.py -v` | Manifest load + L5X version resolution |

---

## Troubleshooting
- **`DATABASE_URL is not set`** → create `.env` from `.env.example`.
- **Migration can't connect** → is the container up? `docker compose ps`; healthy? `docker inspect -f '{{.State.Health.Status}}' plc-copilot-db`.
- **Port 5432 in use** → another Postgres is running; stop it or change the host port in `docker-compose.yml`.

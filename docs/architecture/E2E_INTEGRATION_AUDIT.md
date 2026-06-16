# End-to-End Integration Audit

**Date:** 2026-06-16 (v1.6 refresh)  
**Scope:** Phase 4 (platform export) + Phase 5 (P0–P4) + **v1.6** (HMI, usage metering, UI remediation, PID) — UI → Next.js BFF → FastAPI → Python services.  
**Goal:** Verify each path is implemented (not dummy), request/response shapes align, and features are reachable from the UI.

**Verify after fixes:**
```bash
cd automation && uv run pytest api/tests -q    # 403
npm run test:plc                               # 90
npm run build
```

---

## 1. Executive summary

| Tier | Count | Meaning |
|------|-------|---------|
| **A — Fully wired** | 28+ | UI → BFF → FastAPI/DB; shapes aligned |
| **B — API only (no UI)** | 1 | Backend complete; no dedicated page |
| **C — UI mock / placeholder** | 12+ | Frozen (SAP, Stripe checkout) or intentional static marketing |
| **D — Bugs found** | 8 | Fixed — see §8 remediation log |

**Phase 4/5/6 core PLC paths (generator, M221 AI, recommend, rectify, download, HMI, usage) are real** — they call `lib/automation-client.ts` and the Redis job worker. No TS template generators on live paths.

**Frozen / intentional mocks (do not treat as gaps):** SAP export/config, billing payment/checkout/invoices, subscription checkout — see [PHASE_5 §5](PHASE_5_IMPLEMENTATION.md#5-frozen-tracks-auth-integrations-billing) and [V1_6 §9](V1_6_IMPLEMENTATION.md#9-explicitly-out-of-scope--frozen-do-not-implement-in-v16).

> **v1.6 delivered:** HMI generator, dashboard/billing usage meters, settings, support, resources, project templates — see [V1_6_IMPLEMENTATION.md §2](V1_6_IMPLEMENTATION.md#2-ui-gap-assessment-mock-vs-real-backend).

---

## 2. Tier A — Fully wired paths

### 2.1 Multi-vendor PLC generator

| Layer | Path |
|-------|------|
| UI | `app/generator/page.tsx` |
| BFF | `POST /api/generate-plc`, `POST /api/download-program` |
| Orchestration | `lib/plc-generation.ts` (pattern detect, platform routing) |
| FastAPI | `/v1/programs/generate`, `/v1/programs/plcopen`, `/v1/sketches/analyze` |
| Jobs | `program.generate`, `program.plcopen`, `sketch.analyze` |

**Request (generate):** `FormData` — `logic`, `modelId`, `manufacturer`, `series`, `modelName`, optional `image`.  
**Response:** `{ content, filename, extension, downloadParams, generationPath?, tier2Disclaimer?, limitations? }` — **aligned**.

**Download:** `PlcDownloadParams` JSON → binary attachment — **aligned**.

### 2.2 M221 AI generator

| Layer | Path |
|-------|------|
| UI | `app/m221-generator/page.tsx`, `app/ai-generator/page.tsx` |
| BFF | `POST /api/generate-plc-ai` |
| FastAPI | `POST /v1/programs/m221/generate` |
| Job | `program.m221.generate` → `ClaudeIrService` → `IrService.serialize` → Calaos `.smbp` |

**Request:** `{ description, plcModel, manufacturer?, projectName? }`  
**Response:** `{ success, content, filename, extension, model, programData, ir?, aiGenerated }` — **aligned**.

### 2.3 PLC recommend (wizard)

| Layer | Path |
|-------|------|
| UI | `app/(features)/plc-selector/page.tsx` (wizard mode) |
| BFF | `POST /api/recommend-plc` |
| FastAPI | `POST /v1/ai/recommend-plc` |
| Job | `ai.recommend.plc` → `RecommendService` + `recommend_fallback` |

**Request:** `ProjectRequirements` (camelCase JSON) — matches Pydantic `extra="allow"`.  
**Response:** `{ recommendations: RecommendedPLC[], source: 'ai'|'fallback' }` — UI reads `recommendations`; `source` optional in UI.

### 2.4 Solution recommend

| Layer | Path |
|-------|------|
| UI | `app/(features)/solutions/recommend/page.tsx` |
| BFF | `POST /api/recommend-solution` |
| FastAPI | `POST /v1/ai/recommend-solution` |
| Job | `ai.recommend.solution` |

**Request:** `{ projectDescription, criteria, constraints? }` — **aligned**.  
**Response:** `{ recommended, alternatives, comparison, source }` — **aligned** with UI `RecommendationResponse`.

### 2.5 Error rectification

| Layer | Path |
|-------|------|
| UI | `app/(features)/rectify-error/page.tsx` |
| BFF | `POST /api/rectify-error` |
| FastAPI | `POST /v1/ai/rectify-error` |
| Job | `ai.rectify.error` |

**Request:** `{ programCode, platform, errorMessage, plcModel, errorScreenshot? }`  
**Response:** `{ success, analysis, solutions[], recommendations[], source }` — **aligned**.

### 2.6 AI assistant features (Claude via FastAPI)

| UI page | BFF route | FastAPI |
|---------|-----------|---------|
| `ai-copilot` | `/api/ai-chat` | `/v1/ai/chat` |
| `engineer-chat` | `/api/ai-engineer-chat` | `/v1/ai/chat` |
| `ai-application-generator` | `/api/ai-generate-application` | `/v1/ai/json` |
| `ai-code-optimizer` | `/api/ai-optimize-code` | `/v1/ai/json` |
| `ai-library-manager` (AI search) | `/api/ai-library-search` | `/v1/ai/json` |

Prompt assembly stays in BFF; inference is always Python — **by design**.

### 2.7 Projects & dashboard (PostgreSQL)

| UI | BFF | Backend |
|----|-----|---------|
| `projects/active`, `projects/completed` | `/api/projects`, `/api/projects/[id]` | Drizzle `lib/db/queries.ts` |
| `dashboard` | `/api/dashboard/stats`, `/api/projects`, `/api/usage` | Real counts + usage meters from `usage_events` |
| `programs` | `GET /api/programs` | Saved generated programs list |
| `billing/usage`, `billing/plan` | `GET /api/usage` | Plan limits + event aggregation (read-only) |

### 2.8 HMI generator (v1.6)

| Layer | Path |
|-------|------|
| UI | `app/(features)/hmi-generator/page.tsx` |
| BFF | `POST /api/hmi-generate` (`?download=true` for zip) |
| FastAPI | `POST /v1/ai/hmi/generate` |
| Job | `ai.hmi.generate` → `HmiService` |

**Request:** `{ vendor, projectName, tags[], optional programId for IR tag prefill }`  
**Response:** `{ script, tagsCsv, filename }` or zip attachment — **aligned**.

### 2.9 Settings, support, resources (v1.6)

| UI | BFF | Backend |
|----|-----|---------|
| `settings/*` | `/api/settings/{profile,preferences,notifications,password,api-keys}` | `users.preferences` jsonb via `lib/db/settings.ts` |
| `support/contact` | `POST /api/support/contact` | `support_messages` table |
| `support/ticket` | `/api/support/tickets`, `/api/support/tickets/[id]` | `support_tickets` table |
| `resources/docs` | `/api/resources/docs`, `/api/resources/docs/[slug]` | `content/docs/*.md` |
| `resources/tutorials` | `/api/resources/tutorials` | `lib/content/tutorials.ts` |
| `resources/forum` | `/api/forum/threads` | `forum_threads` / `forum_posts` tables |
| `projects/templates` | `GET /api/templates` | `lib/templates.ts` (10 patterns incl. `pid_loop`) |

### 2.10 Auth

| UI | BFF |
|----|-----|
| `signup` | `POST /api/register` |
| `login` | NextAuth `/api/auth/[...nextauth]` |

---

## 3. Tier B — API without dedicated UI

| API | FastAPI | Notes |
|-----|---------|-------|
| `POST /api/analyze-sketch` | `/v1/sketches/analyze` | Used **indirectly** when generator uploads sketch image |

> **v1.5 follow-ups now have UI:** `GET/POST /api/programs` → `/programs`; `POST /api/generate-from-sketch` → `/sketch-generator`.

---

## 4. Tier C — Mock / placeholder UI (expected — frozen or static)

| Feature | Page | Status |
|---------|------|--------|
| SAP Export | `sap/export` | `simulated: true`; hardcoded project list (**v1.7+**) |
| SAP Config | `sap/config` | Hardcoded profiles (**v1.7+**) |
| Billing Payment / Invoices / Upgrade | `billing/payment`, `billing/invoices`, `billing/upgrade` | Mock UI (**Stripe v1.7+**) |
| Subscription checkout | `subscription/*` | Mock plans/checkout (**Stripe v1.7+**) |
| PLC Selector browse mode | `plc-selector` | Local `plc-models-database.ts` (catalog, not API) |
| Support Help | `support/help` | Static FAQ (intentional) |
| Solutions Calculator | `solutions/calculator` | Client-side math (intentional) |
| Marketing / blog / platform landings | various | Static content (intentional) |

---

## 5. Data structure alignment matrix

| Feature | UI type location | BFF returns | FastAPI job result | Match |
|---------|------------------|-------------|-------------------|-------|
| Generate PLC | `generator/page.tsx` + `PlcDownloadParams` | `generate-plc/route.ts` | `program.generate` metadata | ✅ |
| M221 AI | `GeneratedProgram` in m221 page | `generate-plc-ai/route.ts` | `program.m221.generate` | ✅ |
| Recommend PLC | `RecommendedPLC` in plc-selector | passthrough | `recommendations[]` | ✅ |
| Recommend solution | `Solution`, `RecommendationResponse` | passthrough | same keys | ✅ |
| Rectify error | `rectify-error/page.tsx` | passthrough | `analysis`, `solutions` | ✅ |
| Code optimizer | `AnalysisData` | `{ success, analysis }` | `ai.json` → `data` unwrapped | ✅ |
| Library AI search | `SearchResults` | `{ success, results }` | `ai.json` | ✅ (fixed UI to read `results`) |
| App generator | `GeneratedApplication` | `{ success, application }` | `ai.json` | ✅ |

---

## 6. Duplicate / legacy API routes

Removed (2026-06-16): orphan routes that duplicated canonical BFF handlers — no UI referenced them.

| Removed | Use instead |
|---------|-------------|
| `/api/ai-copilot` | `/api/ai-chat` |
| `/api/ai-application-generator` | `/api/ai-generate-application` |
| `/api/ai-library-manager` | `/api/ai-library-search` |
| `/api/ai-code-optimizer` | `/api/ai-optimize-code` |

---

## 7. Navigation vs capabilities

| Sidebar item | Wired to real API? |
|--------------|-------------------|
| PLC Generator | ✅ |
| M221 Generator | ✅ |
| Sketch Generator | ✅ `/api/generate-from-sketch` |
| Programs | ✅ `GET /api/programs` |
| PLC Selector (wizard) | ✅ |
| Solution Finder → Recommend | ✅ |
| Solution Finder → Compare | ✅ catalog API |
| AI Co-Pilot subtree | ✅ (chat, app gen, optimizer, library search) |
| Error Rectification | ✅ (page + sidebar link) |
| HMI Generator | ✅ `/api/hmi-generate` |
| Settings / Support / Resources | ✅ v1.6 BFF routes |
| SAP Integration | ⚠️ simulated (v1.7+) |
| Billing usage/plan meters | ✅ `/api/usage` (payments frozen) |

---

## 8. Remediation log (this audit)

| ID | Issue | Action |
|----|-------|--------|
| E2E-1 | Library search UI read `data.libraries`; API returns `data.results` | Fixed `ai-library-manager/page.tsx` |
| E2E-2 | `/api/rectify-error` had no UI | Added `rectify-error/page.tsx` + sidebar |
| E2E-3 | Recommend routes ignored HTTP errors | Added `response.ok` checks + error surfacing |
| E2E-4 | `source` field not shown | Badge on recommend/rectify results |
| E2E-5 | BFF blocked Tier-2 / PLCopen for non-motor patterns | `lib/plc-patterns.ts` + `resolveGenerationPath` in `plc-generation.ts` — see [P5_GAPS_IMPLEMENTATION.md](P5_GAPS_IMPLEMENTATION.md) G1–G4 |
| E2E-6 | `exportPlcopen` hardcoded `motor_startstop` | Pass detected pattern + timing |
| E2E-7 | `synthesisMode` / Claude IR not in UI | Generator advanced panel → `claude_ir` path |
| E2E-8 | Sketch analyze only for native vendors | Tier-2 platforms use sketch analysis before export |

---

## 9. Recommended follow-ups

| # | Item | Status |
|---|------|--------|
| 1 | **Programs list UI** — `GET /api/programs` | ✅ `/programs` |
| 2 | **Dedicated sketch flow** — `/api/generate-from-sketch` | ✅ `/sketch-generator` |
| 3 | **Solution compare** — catalog-backed | ✅ `/api/plc-catalog` + compare page |
| 4 | **Consolidate duplicate BFF routes** | ✅ removed orphans (§6) |
| 5 | **Move AI prompts to Python** | ✅ `api/services/ai_prompts.py` + dedicated `/v1/ai/*` routes |
| 6 | **Dashboard usage** | ✅ `/api/usage` (v1.6) |

---

## 10. Cross-references

- [PHASE_4_PLATFORM_INTEGRATIONS.md](PHASE_4_PLATFORM_INTEGRATIONS.md) — export pipeline as-built
- [PHASE_5_IMPLEMENTATION.md](PHASE_5_IMPLEMENTATION.md) — P0–P4 deliverables
- [V1_6_IMPLEMENTATION.md](V1_6_IMPLEMENTATION.md) — v1.6 deliverables (HMI, usage, PID, UI remediation)
- [FASTAPI_AUTOMATION_SERVICE.md](FASTAPI_AUTOMATION_SERVICE.md) — BFF route table
- [RUNBOOK.md](../RUNBOOK.md) — verify commands

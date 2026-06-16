# End-to-End Integration Audit

**Date:** 2026-06-14  
**Scope:** Phase 4 (platform export) + Phase 5 (P0–P4) features — UI → Next.js BFF → FastAPI → Python services.  
**Goal:** Verify each path is implemented (not dummy), request/response shapes align, and features are reachable from the UI.

**Verify after fixes:**
```bash
cd automation && uv run pytest api/tests -q    # 339+
npm run test:plc
```

---

## 1. Executive summary

| Tier | Count | Meaning |
|------|-------|---------|
| **A — Fully wired** | 12 | UI → BFF → FastAPI/DB; shapes aligned |
| **B — API only (no UI)** | 3 | Backend complete; no page or orphan route |
| **C — UI mock / placeholder** | 8+ | Documented as simulated or marketing shell |
| **D — Bugs found** | 8 | Fixed — see §8 remediation log |

**Phase 4/5 core PLC paths (generator, M221 AI, recommend, rectify, download) are real** — they call `lib/automation-client.ts` and the Redis job worker. No TS template generators on live paths.

**Frozen / intentional mocks (do not treat as gaps):** SAP export, billing/subscription UI, HMI generator, resources forum, dashboard usage meters — see [PHASE_5 §5](PHASE_5_IMPLEMENTATION.md#5-frozen-tracks-auth-integrations-billing).

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
| `dashboard` | `/api/dashboard/stats`, `/api/projects` | Real counts; usage meters are placeholder UI |

### 2.8 Auth

| UI | BFF |
|----|-----|
| `signup` | `POST /api/register` |
| `login` | NextAuth `/api/auth/[...nextauth]` |

---

## 3. Tier B — API without dedicated UI

| API | FastAPI | Notes |
|-----|---------|-------|
| `POST /api/analyze-sketch` | `/v1/sketches/analyze` | Used **indirectly** when generator uploads sketch image |
| `POST /api/generate-from-sketch` | `/v1/sketches/generate` | No standalone page; could power future sketch-only flow |
| `GET/POST /api/programs` | — (DB only) | Persists on generate; no “My Programs” list UI |

---

## 4. Tier C — Mock / placeholder UI (expected)

| Feature | Page | Status |
|---------|------|--------|
| HMI Generator | `hmi-generator` | Client-side `setTimeout` + template strings |
| Solution Compare | `solutions/compare` | Hardcoded `plcDatabase` |
| SAP Export | `sap/export` | `simulated: true`; hardcoded project list |
| SAP Config | `sap/config` | Hardcoded profiles |
| Billing / Subscription | `billing/*`, `subscription/*` | Hardcoded plans (frozen) |
| Dashboard usage | `dashboard` | Hardcoded API/storage meters |
| Resources / Support forms | `resources/*`, `support/*` | Static content |
| PLC Selector browse mode | `plc-selector` | Local `plc-models-database.ts` (catalog, not API) |

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
| PLC Selector (wizard) | ✅ |
| Solution Finder → Recommend | ✅ |
| Solution Finder → Compare | ✅ catalog API |
| AI Co-Pilot subtree | ✅ (chat, app gen, optimizer, library search) |
| Error Rectification | ✅ (page + sidebar link) |
| SAP Integration | ⚠️ simulated |
| HMI Generator | ❌ mock |

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
| 5 | **Move AI prompts to Python** | Deferred (optional) |
| 6 | **Dashboard usage** | Deferred (billing phase) |

---

## 10. Cross-references

- [PHASE_4_PLATFORM_INTEGRATIONS.md](PHASE_4_PLATFORM_INTEGRATIONS.md) — export pipeline as-built
- [PHASE_5_IMPLEMENTATION.md](PHASE_5_IMPLEMENTATION.md) — P0–P4 deliverables
- [FASTAPI_AUTOMATION_SERVICE.md](FASTAPI_AUTOMATION_SERVICE.md) — BFF route table
- [RUNBOOK.md](../RUNBOOK.md) — verify commands

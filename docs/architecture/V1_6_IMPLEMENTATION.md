# v1.6 — Implementation Plan

**Status: ✅ DELIVERED (2026-06-16)** — Phases A–E complete. Release gate: 403 pytest, 90 `test:plc`, clean `npm run build`.

Execution plan for the **v1.6** release: finish the two incomplete feature tracks (HMI generator, dashboard usage metering), close the remaining **P3 logic-depth** gaps, and wire up the UI screens that still render mock/dummy data. **Mobile app (React Native) is deferred to v1.7+.**

> **For humans:** read §1 (scope), §2 (UI gap assessment), then the phase you own (§4–§8).
> **For Cursor agents:** work phases in order **A → B → C → D → E**. Within D: **D4 before D3**. Each gap row has explicit files, acceptance criteria, and a verify command. Do **not** implement frozen items in §9. Do **not** start a phase whose dependencies are unmet.

**Baseline:** v1.5.0 (2026-06-16) — FastAPI automation service, multi-vendor export, AI prompts in Python. See [PHASE_5_IMPLEMENTATION.md](PHASE_5_IMPLEMENTATION.md), [E2E_INTEGRATION_AUDIT.md](E2E_INTEGRATION_AUDIT.md).

---

## 1. Scope

### In scope (v1.6)

| Track | Summary | Phase |
|-------|---------|-------|
| **HMI generator** | Replace the client-side template mock with a real AI-backed generator (FastAPI service + prompts in Python), vendor-aware output, file download, tag linkage to generated PLC IR | [§5 Phase B](#5-phase-b--hmi-generator-real) |
| **Dashboard usage meters** | Real usage metering: broaden event logging, plan/limit resolver, `/api/usage`, wire dashboard + billing-usage pages (no payment processing) | [§6 Phase C](#6-phase-c--usage-metering-real-no-payments) |
| **P3 logic-depth gaps** | Ship the unshipped **PID / analog** pattern (P3 item 10 promised "PID, interlocks, …"; only interlock/staging/timed shipped), analog IR support, arbitrary-synthesis hardening | [§4 Phase A](#4-phase-a--p3-logic-depth-completion) |
| **Remaining follow-ups + UI mock remediation** | Verify the 4 already-delivered follow-ups; wire the remaining mock-UI screens (settings, support, resources, project templates) | [§7 Phase D](#7-phase-d--ui-mock-remediation) |
| **Docs + release** | Verify deltas, update CHANGELOG/docs, version bump | [§8 Phase E](#8-phase-e--verification--release) |

### Already delivered in v1.5 (the four "follow-ups" — verify only, do not rebuild)

The query listed these as "documented, not implemented." **They were delivered in v1.5.** Phase E verifies them; no new build work.

| Follow-up | v1.5 status | Evidence |
|-----------|-------------|----------|
| Programs list UI (`GET /api/programs`) | ✅ Delivered | `app/(features)/programs/page.tsx`; sidebar link `app/components/Sidebar.tsx:149` |
| Dedicated sketch page | ✅ Delivered | `app/(features)/sketch-generator/page.tsx`; sidebar link `Sidebar.tsx:82`; calls `/api/generate-from-sketch` |
| Duplicate BFF routes removed | ✅ Done | `ai-copilot`, `ai-application-generator`, `ai-library-manager`, `ai-code-optimizer` routes deleted in v1.5 |
| Solution compare on real data | ✅ Delivered | `app/(features)/solutions/compare/page.tsx` → `GET /api/plc-catalog` |

> The substantive remaining UI work is the **35 mock-UI screens** catalogued in §2, handled in Phase D.

### Deferred to v1.7+ (out of scope, §9 has rationale)

Mobile app (React Native), Stripe payment processing & checkout, **all SAP screens/wiring** (`/sap/export`, `/sap/config`) and real SAP RFC/OData, native vendor IDE deep integrations (TIA Openness / Studio 5000 SDK / GX Works), multi-language (i18n), interactive simulator HMI preview.

---

## 2. UI gap assessment (mock vs real backend)

Audit of all 56 `page.tsx` files. **20 real, 1 partial, 35 mock-UI.** Core PLC/AI/projects/auth are real. The table below drives Phase D; rows marked **frozen** stay mock for v1.6 (see §9).

### Real today (no work needed)

`/dashboard` (stat cards + recent projects), `/projects/active`, `/projects/completed`, `/programs`, `/generator`, `/ai-generator`, `/m221-generator`, `/sketch-generator`, `/plc-selector`, `/rectify-error`, `/solutions/compare`, `/solutions/recommend`, `/ai-copilot`, `/ai-application-generator`, `/ai-code-optimizer`, `/ai-library-manager`, `/engineer-chat`, `/login`, `/signup`. Backed by DB or the automation service.

### Mock-UI / partial → addressed in v1.6 ✅

| Page | Route | Status (post-v1.6) | v1.6 action | Phase |
|------|-------|-------------------|-------------|-------|
| HMI Generator | `/hmi-generator` | ✅ real (`/api/hmi-generate` → FastAPI) | Real AI backend + export | B |
| Dashboard Usage Summary | `/dashboard` (lower panel) | ✅ `/api/usage` | Wire to `/api/usage` | C |
| Billing Usage | `/billing/usage` | ✅ `/api/usage` | Wire to `/api/usage` (read-only meters) | C |
| Billing Plan | `/billing/plan` | ✅ plan + usage from `/api/usage` | Wire plan + usage (read-only; no checkout) | C |
| Settings Profile | `/settings/profile` | ✅ `/api/settings/profile` | `/api/settings/profile` (DB) | D1 |
| Settings Preferences | `/settings/preferences` | ✅ `/api/settings/preferences` | `/api/settings/preferences` (DB) | D1 |
| Settings Notifications | `/settings/notifications` | ✅ `/api/settings/notifications` | `/api/settings/notifications` (DB) | D1 |
| Settings Security | `/settings/security` | ✅ password change; session list noted v1.7 | password change + session list (DB/Auth.js) | D1 |
| Settings API Keys | `/settings/api` | ✅ `/api/settings/api-keys` | `/api/settings/api-keys` (DB `apiKeys`) | D1 |
| Support Contact | `/support/contact` | ✅ `/api/support/contact` | `/api/support/contact` (DB) | D2 |
| Support Ticket | `/support/ticket` | ✅ `/api/support/tickets` CRUD | `/api/support/tickets` CRUD (DB) | D2 |
| Support Help | `/support/help` | static FAQ (intentional) | keep static (no backend) — note only | D2 |
| Resources Docs | `/resources/docs` | ✅ content API + `[slug]` | content backend + `[slug]` page | D3 |
| Resources Tutorials | `/resources/tutorials` | ✅ content API | content backend | D3 |
| Resources Examples | `/resources/examples` | ✅ templates + generator URLs | content backend (reuse project templates) | D3 |
| Resources Forum | `/resources/forum` | ✅ `/api/forum/threads` | DB-backed threads/posts (read+create) | D3 |
| Project Templates | `/projects/templates` | ✅ `/api/templates` | `/api/templates` + "create from template" | D4 |
| Solutions Calculator | `/solutions/calculator` | client-only (noted) | keep client-side — note only | D5 |
| SAP Export | `/sap/export` | partial (sim API + hardcoded projects) | **frozen** (deferred to v1.7) | §9 |
| SAP Config | `/sap/config` | mock (local profiles) | **frozen** (deferred to v1.7) | §9 |
| Billing Payment/Upgrade/Invoices | `/billing/*` | mock | **frozen** (Stripe) | §9 |
| Subscription * (plans/manage/addons/team) | `/subscription/*` | mock | **frozen** (Stripe/checkout); `team` optional D-stretch | §9 |
| Blog, platform landing, home CTA | various | static marketing | leave static (intentional) | — |

---

## 3. Architecture principles (keep)

1. **Prompts and AI logic live in Python** (`automation/api/services/ai_prompts.py`, `*_service.py`). BFF routes are thin proxies. (v1.5 final established this — HMI must follow the same pattern.)
2. **No `child_process` / `spawn` from Next.js.** All automation goes through `lib/automation-client.ts` → FastAPI jobs.
3. **DB access only in `lib/db/queries.ts`** behind `requireUser()`; routes stay thin.
4. **Every generator produces a real, inspectable artifact** (file/IR), not just a preview string.
5. **No TODOs / stubs on shipped paths.** Each gap is fully implemented + tested.

---

## 4. Phase A — P3 logic-depth completion ✅

**Goal:** ship the analog/PID capability promised in P3 item 10 and harden arbitrary synthesis. **Backend-first** (unblocks generator + HMI tag linkage).

**Context:** Pattern catalog (`automation/api/ir/patterns.py`) has 9 boolean patterns. IR (`automation/api/schemas/ir.py`) supports `REAL/INT/DINT` data types but node types are boolean-only (`Contact/Coil/And/Or/Not/Timer`). PID needs an IR extension for analog compare + a PID function-block representation.

| ID | Gap | Files | Approach | Acceptance |
|----|-----|-------|----------|------------|
| **A1** | IR has no analog/FB nodes | `automation/api/schemas/ir.py`, `automation/api/ir/validator.py` | Add `CompareNode` (operands, op ∈ `GT/GE/LT/LE/EQ`) and `FbCallNode` (e.g. `kind: "PID"`, in/out var refs). Extend `validate_program()` for analog dataType pairing (REAL/INT) and FB var cross-refs | New node types validate; existing patterns still pass |
| **A2** | No PID pattern | `automation/api/ir/patterns.py`, `automation/api/schemas/ir.py` (`PatternName`) | Add `pid_loop` to `PATTERN_CATALOG` + builder: analog input (PV), setpoint, PID FB, analog output (CV), enable contact. Vendors that support analog: schneider, rockwell, siemens, codesys, generic | `build_pattern("pid_loop")` returns valid IR; golden IR fixture added |
| **A3** | PID not detected from NL | `automation/api/ir/pattern_match.py` | Add keyword/regex match (`pid`, `setpoint`, `closed loop`, `temperature control`) → `pid_loop`; extract setpoint if present | `test_p3_logic_depth.py` cases map PID descriptions |
| **A4** | Export coverage for PID | `automation/api/ir/serializers/*`, `automation/api/ir/providers/plcopen.py`, `siemens_scl.py`, `mitsubishi.py` | Serialize PID to each vendor where analog is supported; **document permanent limits** where a vendor can't (e.g. emit ST/FB stub + disclaimer). Add golden export cases | Golden export hash cases for `pid_loop`; Tier-2 disclaimer where applicable |
| **A5** | Arbitrary synthesis under-tested for multi-network analog IR | `automation/api/tests/test_p3_logic_depth.py`, `test_claude_ir.py` | Add tests: arbitrary mode produces multi-network IR with analog nodes passing `validate_program()`; constrained mode falls back to `pid_loop` when close | Tests green; `IrSynthesisError` path covered |
| **A6** | BFF/UI pattern unions miss `pid_loop` | `lib/plc-patterns.ts`, `lib/automation-client.ts`, generator UI | Add `pid_loop` to `PlcPattern`/`EXPORT_PATTERNS`; surface in detection + generator advanced timing (setpoint field) | `lib/plc-generation.test.ts` + `plc-patterns.test.ts` cover PID |

**Verify (Phase A):**
```bash
cd automation && uv run pytest api/tests/test_p3_logic_depth.py api/tests/test_patterns_v2.py api/tests/test_claude_ir.py api/tests/test_golden_exports.py api/tests/test_ir.py -q
npm run test:plc
```

**Decision (locked):** PID is modeled as an `FbCallNode` referencing a standard PID FB per vendor (emit FB instance + parameter assignments), **not** a from-scratch PID algorithm in ladder. This keeps the IR vendor-portable and import-correct. Where a vendor lacks an analog/PID FB, emit a Tier-2 ST/FB stub + disclaimer (A4). Document this in [ARBITRARY_LOGIC_SYNTHESIS.md](ARBITRARY_LOGIC_SYNTHESIS.md) §6.

---

## 5. Phase B — HMI generator (real) ✅

**Goal:** turn `/hmi-generator` from a client-side mock into a real generator that calls the automation service, returns a downloadable artifact, and (optionally) seeds tags from a generated PLC program. Mirrors the v1.5 "AI prompts in Python" architecture.

**Current state:** `app/(features)/hmi-generator/page.tsx` (1448 lines) uses `setTimeout(2000)` + in-file template functions. No BFF route, no FastAPI service, no download. `abb-800xa` and `wonderware` fall through to a generic template.

**Output strategy (decision):** Vendor HMI **native project binaries are not writable from cloud** (same constraint as PLC `.acd/.zap`). v1.6 ships **importable text artifacts + a tag table**, consistent with the PLC Tier-2 approach:
- Per-vendor screen script (WinCC VBScript, FactoryTalk VBA, Vijeo JS, Ignition Jython, CODESYS visu ST, generic) — generated by Claude with Python-owned prompts.
- A **tag CSV** (name, address, type, comment) usable across vendors.
- A short **import guide** string per vendor.
- Bundled as a `.zip` (script + tags.csv + README), like the Mitsubishi IL/ST/CSV bundle.

| ID | Gap | Files | Approach | Acceptance |
|----|-----|-------|----------|------------|
| **B1** | No HMI prompts in Python | `automation/api/services/ai_prompts.py` | Add `HMI_SYSTEM` + `build_hmi_user_prompt(vendor, screen_type, description, tags)`; vendor output-language guidance. Cover all 8 listed vendors incl. ABB/Wonderware | Prompt unit tests assert vendor + screen type appear |
| **B2** | No HMI service | `automation/api/services/hmi_service.py` (new) | `HmiService.generate(vendor, screen_type, description, project_name, tags?)` → `{ files: [...], tagsCsv, importGuide }`; reuse `ClaudeService.ask_json`/`chat` | Returns structured artifact; unit tested with fake Claude |
| **B3** | No job type | `automation/api/jobs/tasks.py`, `automation/api/routers/ai.py` | Add `ai.hmi.generate` job + `POST /v1/ai/hmi/generate` (typed request, alias camelCase) | API test enqueues + completes |
| **B4** | No BFF route | `app/api/hmi-generate/route.ts` (new), `lib/automation-client.ts` | `generateHmi()` client + thin route; returns JSON (scripts + tagsCsv) or `?download=true` → zip (reuse base64 pattern) | BFF prompt-free test passes |
| **B5** | UI is a mock | `app/(features)/hmi-generator/page.tsx` | Replace `generateHMICode` + all in-file template fns with a single `fetch('/api/hmi-generate')`; add download button; keep platform/screen selectors; show tag table | No `setTimeout`/template fns remain; real download works |
| **B6** | No PLC→HMI tag linkage | `app/(features)/hmi-generator/page.tsx`, `lib/db/queries.ts` | Optional: prefill tags from a selected saved program (`generation_parameters.ir` symbols) for signed-in users | Tags auto-populate from a chosen program (graceful if none) |
| **B7** | No tests | `automation/api/tests/test_hmi_service.py`, `test_ai_copilot_api.py`, `lib/ai-copilot-client.test.ts` | Python service + API + BFF prompt-free assertions; golden fixture per vendor | All green |

**Verify (Phase B):**
```bash
cd automation && uv run pytest api/tests/test_hmi_service.py api/tests/test_ai_copilot_api.py -q
npm run test:plc && npm run build
```

---

## 6. Phase C — Usage metering (real, no payments) ✅

**Goal:** make dashboard + billing-usage **meters** reflect real activity. **Payment processing (Stripe) stays frozen (§9)** — this phase is metering and limits display only.

**Current state:** `logUsage` is called only for `project_created` and `program_generated`. Dashboard "API Calls 342 / 1000", "Storage 2.4 GB / 10 GB", "Professional Plan" are hardcoded. `organizations.subscriptionTier/maxProjects/maxUsers` exist but are never read. No `/api/usage` route. Schema: `usage_analytics`, `subscription_history`, `billing_transactions` exist.

| ID | Gap | Files | Approach | Acceptance |
|----|-----|-------|----------|------------|
| **C1** | Sparse event logging | `lib/db/queries.ts`, all AI/generation routes (`app/api/ai-*`, `generate-plc*`, `recommend-*`, `rectify-error`, `generate-from-sketch`, `hmi-generate`) | Add a small `recordUsage(eventType)` helper; call on each AI/generation request (best-effort, never throws). Event types: `ai_chat`, `ai_application`, `ai_optimize`, `ai_library`, `engineer_chat`, `recommend_plc`, `recommend_solution`, `rectify_error`, `sketch_generate`, `hmi_generate` | Each feature logs one event per call (verified in tests) |
| **C2** | No plan/limit resolver | `lib/billing/plan-limits.ts` (new) | Map `subscriptionTier` → `{ programsPerMonth, aiRequestsPerMonth, storageGb, teamSeats }`. Single source of truth (replaces per-page hardcoded 50/100/500) | Limits resolve from tier; unit test |
| **C3** | No usage API | `app/api/usage/route.ts` (new), `lib/db/queries.ts` (`getUsageSummary`) | Return `{ period, limits, used: { programs, aiRequests, storageGb, events }, breakdownByType }` for current billing window from `usage_analytics.createdAt` + `file_operations.fileSize` | Returns real counts within month window |
| **C4** | Dashboard meters hardcoded | `app/(features)/dashboard/page.tsx` | Replace hardcoded API/storage/plan with `/api/usage`; show `usageEvents` (currently fetched, unused) | No hardcoded meter values remain |
| **C5** | Billing usage/plan mock | `app/(features)/billing/usage/page.tsx`, `billing/plan/page.tsx` | Wire to `/api/usage`; remove `Math.random()`; read-only (no checkout) | Meters reflect DB; period selector queries window |
| **C6** | No storage metering | `lib/db/queries.ts` | Aggregate `file_operations.fileSize` (and/or `generated_programs.fileSize`) per user/org | Storage value is real |
| **C7** | Soft quota warnings | `createProject`, `createProgram`, `/api/usage` | Compute `overLimit` per metric vs tier limits; surface `overLimit` flags in `/api/usage` and a non-blocking warning banner on dashboard + billing-usage. **No hard enforcement / no blocked actions** in v1.6 | `overLimit` flags returned; UI banner shows when over a limit; actions still succeed |
| **C8** | Tests | `automation` n/a; `lib/usage.test.ts` (new), route tests | Unit-test limit resolver + summary aggregation | Green |

**Verify (Phase C):**
```bash
npm run test:plc   # includes lib/usage.test.ts
npm run build
# manual: sign in, generate, confirm dashboard counts increment
```

---

## 7. Phase D — UI mock remediation ✅

**Goal:** wire the remaining mock screens to real backends. Group by subsystem; each sub-phase is independent and can be parallelized after Phase C's `recordUsage` helper lands (D reuses DB patterns, not usage).

### D1 — Settings (DB-backed)

| Page | New API | DB | Notes |
|------|---------|-----|-------|
| `/settings/profile` | `GET/PUT /api/settings/profile` | `users` (name, company, avatar) | Reuse `requireUser()` |
| `/settings/preferences` | `GET/PUT /api/settings/preferences` | `users.settings` jsonb or new column | theme, default platform, language pref (no i18n yet) |
| `/settings/notifications` | `GET/PUT /api/settings/notifications` | `users.settings.notifications` | toggles persist |
| `/settings/security` | `POST /api/settings/password` | Auth.js + `users` | password change; session list from sessions if available |
| `/settings/api` | `GET/POST/DELETE /api/settings/api-keys` | `apiKeys` table (exists) | real key create/revoke; `lastUsedAt` |

**Acceptance:** each settings page reads initial state from API and persists on save (no `alert`-only flows). **Verify:** manual round-trip + `lib` query unit tests.

### D2 — Support (DB-backed)

| Page | New API | DB |
|------|---------|-----|
| `/support/contact` | `POST /api/support/contact` | new `support_messages` table |
| `/support/ticket` | `GET/POST/PATCH /api/support/tickets` | new `support_tickets` table (status, priority, body) |
| `/support/help` | — | keep static FAQ (note in doc) |

**Acceptance:** contact form persists + confirms; tickets list/create/update from DB. **Verify:** route tests + manual.

### D3 — Resources (content backend)

| Page | Approach |
|------|----------|
| `/resources/docs` + `/resources/docs/[slug]` | Back with MDX/markdown files in `content/docs/**` or a `docs_articles` table; **fix broken detail links** by adding the `[slug]` route |
| `/resources/tutorials` | Content list from same backend |
| `/resources/examples` | Reuse project-template catalog (D4) — examples are templates with sample IR |
| `/resources/forum` | DB-backed `forum_threads` + `forum_posts` (read + authenticated create); minimal, no moderation |

**Acceptance:** no hardcoded arrays; detail pages resolve. **Verify:** route tests + manual nav (no 404 on detail links).

### D4 — Project templates

- `GET /api/templates` (catalog: name, description, pattern, default platform, sample IR) sourced from a `lib/templates.ts` registry (reuse pattern library + `pid_loop`).
- "Use template" → prefill `/generator` (or create a project) with the template's pattern/logic.
- **Acceptance:** templates load from API; "use" navigates to generator prefilled. **Verify:** `lib` unit test + manual.

### D5 — Solutions calculator

- Pure client-side TCO math; **no backend needed**. Action: add a doc note that this is intentional, ensure inputs/outputs are correct. No API.

> **SAP screens (`/sap/export`, `/sap/config`) are out of scope for v1.6** — deferred to v1.7 (§9). They keep their current mock/simulated behavior; do not wire them.

---

## 8. Phase E — Verification & release ✅

| ID | Task | Status |
|----|------|--------|
| **E1** | Verify the 4 v1.5 follow-ups still wired (`/programs`, `/sketch-generator`, compare→catalog, no orphan AI routes) | ✅ `lib/phase-d.test.ts` smoke tests |
| **E2** | Full test sweep | ✅ 403 pytest, 90 `test:plc`, clean build |
| **E3** | CHANGELOG v1.6 section; mobile app on v1.7+ list; `package.json` `1.6.0` | ✅ |
| **E4** | Update docs (this file, E2E audit, FEATURE_NAV, FASTAPI route table) | ✅ |
| **E5** | Update PHASE_5 P3 row: PID delivered | ✅ |

**Release gate:** all tests green, `npm run build` clean, no `setTimeout`-as-backend or hardcoded meter values on §2 v1.6 rows, no new TODOs on shipped paths.

---

## 9. Explicitly out of scope / frozen (do not implement in v1.6)

| Item | Reason | Target |
|------|--------|--------|
| **Mobile app (React Native)** | Per request, deferred | v1.7+ |
| **Stripe payment processing / checkout / invoices** | Frozen track (PHASE_5 §5); v1.6 does metering display only, not payments | v1.7+ |
| Subscription checkout / plan changes / paid add-ons | Depends on Stripe | v1.7+ |
| **All SAP screens + wiring** (`/sap/export`, `/sap/config`) and real SAP RFC/OData client | Per scope decision: deferred whole. Screens stay mock/simulated; do not wire | v1.7+ |
| Native vendor IDE binaries (`.acd`, `.zap*`, `.gxw`) & HMI native project binaries (`.mer`, `.fwl`, `.gtx`) | Not writable from cloud (same as PLC export constraint) | n/a |
| TIA Openness / Studio 5000 SDK / GX Works deep integration | Windows toolchain | v1.7+ |
| Multi-language (i18n) | Large cross-cutting change | v1.7+ |
| Simulator HMI preview / live PLC simulator | Digital-twin track (`lib/simulation/` has open `PLCRuntime` TODO) | v1.7+ |
| P0 manual IDE import sign-off (Windows lab) | Carried from Phase 5; user verifies on Windows | ongoing |

> **Agent note:** "usage metering" (Phase C) is **not** billing. Build event logging, limit display, and the `/api/usage` read path. Do **not** add Stripe SDK, checkout, or write to `billing_transactions`.

---

## 10. Dependency order & parallelization

### Cross-phase graph

```
                    ┌── C1 (recordUsage helper) ─────────────────────────────┐
                    │         │                                              │
A (P3 logic depth)  │    C2→C3→C6→C7→C4/C5→C8 (usage metering)              │
  A1→A2→A3/A4→A5→A6│         │ (independent of A/B; can run in parallel)     │
       │            │         └─ retrofits B4 + all AI routes when C lands    │
       ├─ unblocks A6 (BFF pid_loop)                                         │
       └─ unblocks D4 (templates include pid_loop)                            │
                                                                              │
B (HMI generator)   B1→B2→B3→B4→B5→B7  (no A dependency)                      │
                  B6 optional tag-linkage (soft; any saved IR works)        │
                                                                              │
D (UI mock)       D1 ‖ D2 ‖ D4  →  D3  (examples in D3 reuse D4 catalog)   │
                  D4 requires A complete (pid_loop in template registry)       │
                                                                              │
E (verify + release)  ── last; gates on all in-scope phases                  │
```

### Phase-internal order (strict)

| Phase | Sub-order | Notes |
|-------|-----------|-------|
| **A** | **A1 → A2 → {A3 ∥ A4} → A5 → A6** | A1 (IR nodes) blocks everything else in A; A3 and A4 can run in parallel after A2 |
| **B** | **B1 → B2 → B3 → {B4 ∥ B5} → B6 → B7** | B1–B5 need no Phase A work; B6 is optional polish after B5 |
| **C** | **C1 → C2 → C3 → C6 → C7 → {C4 ∥ C5} → C8** | C1 is a thin `recordUsage()` wrapper over existing `logUsage`; C3 needs C2+C6 |
| **D** | **D1 ∥ D2 ∥ D4 → D3 → D5(note)** | **D4 before D3** — `/resources/examples` consumes `/api/templates` from D4 |
| **E** | E1→E2→E3→E4→E5 | After all build phases |

### C1 ↔ B4 note

`hmi-generate` (B4) should call `recordUsage('hmi_generate')` (C1). If B ships before C, B4 lands without metering; **C1 retrofits all routes** including `hmi-generate`. Alternatively, land **C1 alone first** (~30 min) as a micro-prerequisite — then B4 logs on day one. Either path is valid; single-thread order below uses the retrofit approach.

### Recommended execution orders

**Single-thread (safest, one agent):**
**A → B → C → D1 → D2 → D4 → D3 → E**

**Parallel teams (3 tracks, converge at E):**
- Track 1 (Python PLC): A
- Track 2 (full-stack HMI): B (start immediately; no A blocker for B1–B5)
- Track 3 (BFF metering): C (start immediately; independent)
- Then D: D1+D2+D4 in parallel → D3 → E

D5 (calculator doc note) and SAP remain out of scope.

---

## 11. Test matrix (additions)

| Area | New/updated tests |
|------|-------------------|
| P3 PID/analog | `api/tests/test_p3_logic_depth.py`, `test_ir.py`, `test_patterns_v2.py`, `test_golden_exports.py`; `lib/plc-generation.test.ts`, `lib/plc-patterns.test.ts` |
| HMI | `api/tests/test_hmi_service.py`, `api/tests/test_ai_copilot_api.py`; `lib/ai-copilot-client.test.ts` |
| Usage | `lib/usage.test.ts`; route smoke tests |
| Settings/Support/Resources/Templates | route + `lib/db/queries` unit tests |

**Global gate:**
```bash
cd automation && uv run pytest api/tests -q     # 403
npm run test:plc && npm run build             # 90 passed
```

---

## 12. Version history

| Date | Notes |
|------|-------|
| 2026-06-16 | v1.6 plan created — HMI generator, usage metering, P3 PID/analog, UI mock remediation; mobile deferred to v1.7+ |
| 2026-06-16 | Scope locked — PID via `FbCallNode` (confirmed); HMI = scripts + tag CSV zip; full usage metering; soft quota warnings in scope; **SAP screens deferred to v1.7** (Phase D = settings + support + resources + templates only) |
| 2026-06-16 | Dependency graph refined — D4 before D3 (examples→templates); phase-internal sub-orders documented; C1↔B4 retrofit note |
| 2026-06-16 | **v1.6 delivered** — Phases A–E complete; `1.6.0` release |

---

## 13. Post-delivery gap analysis (Phase E)

| Area | Status | Notes |
|------|--------|-------|
| P3 PID / analog | ✅ Complete | `pid_loop`, `CompareNode`, `FbCallNode`, export + UI |
| HMI generator | ✅ Complete | FastAPI + BFF + zip download + IR tag prefill |
| Usage metering | ✅ Complete | All AI/generation routes log events; dashboard + billing wired |
| Settings / support / resources / templates | ✅ Complete | DB-backed APIs; migration `0001_phase_d_support_forum.sql` |
| v1.5 follow-ups | ✅ Verified | `/programs`, `/sketch-generator`, compare→catalog, no orphan AI routes |
| **SAP screens** | ⏸ Frozen (v1.7+) | Intentional — `setTimeout` sim API remains |
| **Stripe / checkout / invoices** | ⏸ Frozen (v1.7+) | Payment pages still mock `alert()` UI |
| **Session list / 2FA** | ⏸ v1.7+ | Security page documents limitation |
| **Simulator / PLCRuntime** | ⏸ v1.7+ | `lib/simulation/PLCRuntime.ts` compile TODO |
| **DB migration** | ⚠️ Ops step | Run `docker compose up -d && npm run db:migrate` locally for support/forum tables |

No blocking gaps remain for the v1.6 release gate. Remaining items are explicitly deferred in §9.

---

**v1.6 Implementation Plan | PLCAutoPilot**

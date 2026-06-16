# Phase 5 — Gaps Implementation Plan

Closes **post-delivery gaps** identified in the [E2E Integration Audit](E2E_INTEGRATION_AUDIT.md) and Phase 5 completion review. **P0 manual IDE sign-off is excluded** (requires Windows lab).

**Status:** Delivered (2026-06-14). P0 manual IDE sign-off remains user-verified on Windows.

---

## Verify

```bash
cd automation && uv run pytest api/tests -q          # 339+
npm run test:plc                                      # 31 BFF tests
npm run build                                         # Next.js compiles
```

---

## Gap register

| ID | Gap | Priority | Fix | Verify |
|----|-----|----------|-----|--------|
| **G1** | BFF `resolveGenerationPath` blocks Tier-2 / PLCopen for non-motor patterns | P0 | `lib/plc-generation.ts` — all 9 `EXPORT_PATTERNS` route to tier2/plcopen | `plc-generation.test.ts` |
| **G2** | `exportPlcopen()` hardcoded `motor_startstop` | P0 | Pass detected pattern + timing params | `plc-generation.test.ts` |
| **G3** | Tier-2 path downgraded non-motor patterns to motor | P0 | Pass full `buildPatternSource()` | `plc-generation.test.ts` |
| **G4** | `PlcPattern` / `detectPatternFromLogic` missing v2 patterns | P0 | `lib/plc-patterns.ts` + parity with Python `pattern_match.py` | `plc-generation.test.ts` |
| **G5** | `automation-client` pattern unions too narrow | P0 | Align `generateProgram` / `exportPlcopen` types with Python schema | TypeScript build |
| **G6** | `synthesisMode` not exposed in BFF/UI | P1 | Generator advanced option → `claude_ir` source | `plc-generation.test.ts` + manual |
| **G7** | Sketch upload only analyzed for native vendors | P1 | Analyze sketch for Tier-2 platforms too | `plc-generation` + existing P2 tests |
| **G8** | Library search UI read wrong response field | P1 | `data.results` not `data.libraries` | `ai-library-manager` page |
| **G9** | Rectify-error API had no UI | P1 | `/rectify-error` page + sidebar | Manual + E2E audit |
| **G10** | Recommend routes missing error/`source` handling | P2 | `response.ok` checks + source badges | UI |
| **G11** | `PHASE_5` §1.5 stale (pre-P2/P3 limits) | P2 | Update scope table + golden counts (37) | Doc review |
| **G12** | `PlcopenGenerateRequest` missing `runSeconds` | P2 | `schemas/programs.py` | Python tests |

### Explicitly out of scope (this pass)

| Item | Reason |
|------|--------|
| P0 manual IDE sign-off | User will verify on Windows |
| Programs list UI (`GET /api/programs`) | Product feature; not Phase 5 deliverable |
| Solution compare static data | Marketing page; separate initiative |
| Duplicate orphan BFF routes (`ai-copilot`, etc.) | Low risk; delete in cleanup PR |
| PID pattern | Never promised in P3 delivery (interlock/staging/timed only) |

---

## Implementation map

| Layer | Files |
|-------|-------|
| Shared types | `lib/plc-patterns.ts` |
| BFF orchestration | `lib/plc-generation.ts`, `lib/automation-client.ts` |
| API route | `app/api/generate-plc/route.ts` |
| UI | `app/generator/page.tsx`, `rectify-error/page.tsx`, recommend pages, `Sidebar.tsx` |
| Python schema | `automation/api/schemas/programs.py` |
| Tests | `lib/plc-generation.test.ts`, `lib/plc-patterns.test.ts` |
| Docs | This file, `PHASE_5_IMPLEMENTATION.md` §1.5, `docs/README.md` |

---

## Delivery checklist

- [x] G1–G7 BFF + generator wired
- [x] G8–G10 E2E UI fixes
- [x] G11–G12 docs + schema
- [x] All tests green
- [x] No TODOs / stub functions in changed paths

---

**Phase 5 Gaps | PLCAutoPilot**

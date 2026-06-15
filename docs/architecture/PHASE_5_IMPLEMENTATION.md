# Phase 5 — Implementation Plan

Execution plan for **post–v1.5** work: known limits of the v1.5 ship, prioritized Phase 5 deliverables, optional parallel tracks, and frozen product areas.

**v1.5 status:** [PHASE_4 §7.0](PHASE_4_PLATFORM_INTEGRATIONS.md#70-roadmap-at-a-glance) is **complete** (through **4b′**, 2026-06-14).

**Verify v1.5 release:**
```bash
cd automation && uv run pytest api/tests -v   # 159 tests
npm run test:plc && npm run build             # 20 BFF tests
```

---

## How to use this document

| Question | Read |
|----------|------|
| What shipped in v1.5? | [PHASE_4 §2b](PHASE_4_PLATFORM_INTEGRATIONS.md#2b-current-as-built-after-fastapi-phases-05) + §1 below |
| What are the **known limits** of v1.5? | [§1.5 scope boundaries](#15-v15-scope-boundaries-known-limits) |
| What should we build in Phase 5? | [§2 recommended work](#2-phase-5-recommended-work-priority-order) |
| What must **not** be pulled in accidentally? | [§5 Frozen tracks](#5-frozen-tracks-auth-integrations-billing) |
| FastAPI / IR architecture | [PHASE_4_PLATFORM_INTEGRATIONS.md](PHASE_4_PLATFORM_INTEGRATIONS.md), [FASTAPI_AUTOMATION_SERVICE.md](FASTAPI_AUTOMATION_SERVICE.md) |

**For Cursor agents:** Do **not** start Phase 5 items unless the user explicitly requests them. Do **not** implement §5 frozen tracks during PLC export work.

---

## 1. v1.5 delivered (reference)

| Item | Phase | Where it lives |
|------|-------|----------------|
| FastAPI automation service (no `spawn('python3')` from app) | 0–5 | `automation/api/`, `lib/automation-client.ts` |
| IR schema + validator + 6 patterns | **4a**, **4j** | `schemas/ir.py`, `ir/patterns.py`, `ir/validator.py` |
| Rockwell `.L5X` | **4b** | `ir/providers/rockwell.py` |
| PLCopen export | **4c** | `ir/providers/plcopen.py` |
| Schneider Calaos unification | **4d′** | `ir/serializers/schneider_calaos.py` |
| Claude → IR + fallback | **4e-1…4e-3** | `claude_ir_service.py`, `pattern_match.py` |
| Siemens SCL Tier-2 | **4f-1** | `ir/serializers/siemens_scl.py` |
| Mitsubishi IL/ST/CSV ZIP | **4f-2** | `ir/serializers/mitsubishi.py` |
| Tier-2 BFF + `/generator` | **4f-3** | `lib/plc-generation.ts` |
| Golden IR + export hash CI | **4h** | `api/tests/fixtures/`, `test_golden_*.py` |
| Sketch → IR | **4i** | `ir/sketch_adapter.py`, CLI `--from-sketch` |
| Provider registry | **4b′** | `ir/registry.py`, `ir/providers/*` |
| BFF routes + IR persistence | **4g** | `generation_parameters.ir`, `downloadParams` |
| M221 AI + IR metadata | **4e-3** | `m221_program_service.py`, `generate-plc-ai/route.ts` |
| v1.5 polish (2026-06-14) | — | BFF sketch metadata test; CLI `--from-json` → IR; deprecated offline scripts; FASTAPI as-built doc |

---

## 1.5 v1.5 scope boundaries (known limits)

These are **not bugs** — they define what v1.5 promises vs what Phase 5 must add.

### Export coverage by pattern

| Pattern | Schneider / Rockwell | Siemens / Mitsubishi Tier-2 | PLCopen (generic) |
|---------|----------------------|-------------------------------|-------------------|
| `motor_startstop` | ✅ | ✅ | ✅ |
| `estop_motor`, `conveyor_startstop` | ✅ | ✅ | ❌ (motor-only PLCopen path) |
| `sequential_lights`, `tank_level`, `traffic_lights` | ✅ | ❌ | ❌ |
| Sketch → IR (arbitrary ladder) | ✅ | ❌ (Schneider/Rockwell only) | ❌ |
| Claude free-form (non-pattern) | Fallback to nearest pattern | Same | Same |

### Logic generation

| Capability | v1.5 | Phase 5 |
|------------|------|---------|
| Deterministic patterns (6) | ✅ | Extend library |
| Claude → validated IR | ✅ with retry + pattern fallback | Broader NL coverage |
| Arbitrary NL → any program | ❌ | Design pass required |
| M221 path | Claude→IR→adapter→Calaos | Optional: direct IR→Calaos polish |

### Validation bar

| Check | v1.5 | Phase 5 |
|-------|------|---------|
| IR schema + `validate_program()` | ✅ | — |
| Round-trip parse in CI | ✅ all patterns + sketch | — |
| Golden export SHA-256 (7 baseline cases) | ✅ | Extend to 4j pattern exports |
| L5X well-formed + parser | ✅ `test_l5x_schema.py` | Full **XSD** schema validation |
| Calaos structural + parser | ✅ | Optional XSD if artifact available |
| PLCopen golden structure | ✅ | — |
| **Real IDE import (zero errors)** | ❌ | **Manual lab gate** — primary Phase 5 milestone |

### Format scope (unchanged)

| Platform | v1.5 ships | Never in v1.5 |
|----------|------------|---------------|
| Rockwell | `.L5X` source | `.acd` binary |
| Schneider | Calaos `.smbp` XML | Legacy ZIP / `<ProjectDescriptor>` on live paths |
| Siemens | `.scl` source import | TIA `.ap*` / `.zap*` |
| Mitsubishi | IL/ST/CSV ZIP | `.gxw` / `.gx3` |
| CODESYS | PLCopen `.xml` | `.project` binary |

---

## 2. Phase 5 recommended work (priority order)

Implement in this order unless the user reprioritizes. Each item includes **why** and **verify**.

### P0 — Quality gate (product)

| # | Item | Why | Verify |
|---|------|-----|--------|
| 1 | **Real IDE import sign-off** | §1 acceptance criteria (1)–(2) not met in CI | Manual: Studio 5000, EcoStruxure Machine Expert, TIA Portal, GX Works — document results in RUNBOOK |
| 2 | **IDE issue backlog from sign-off** | Fix export issues found in lab | Re-import until zero errors per platform |

### P1 — CI hardening (engineering)

| # | Item | Why | Verify |
|---|------|-----|--------|
| 3 | **Full L5X XSD validation** | Structural tests ≠ schema compliance | Add XSD artifact + pytest; fail on schema violations |
| 4 | **Golden export hashes for 4j patterns** | Baseline manifest only covers original 4 patterns + tier-2 motor | Extend `golden_utils.EXPORT_CASES`; run `update_golden_fixtures.py` |
| 5 | **Calaos XSD** (if schema available) | Same as L5X | Optional pytest against XSD |

### P2 — Export scope expansion

| # | Item | Why | Verify |
|---|------|-----|--------|
| 6 | **Tier-2 serializers for all 6 patterns** | Siemens/Mitsubishi reject tank/traffic/sequential today | Extend `siemens_scl.py` / `mitsubishi.py` or document permanent limits |
| 7 | **PLCopen for patterns beyond motor** | `PlcopenProvider` raises on non-motor | IR walk or template expansion + golden tests |
| 8 | **Sketch export for Tier-2 vendors** | Sketch path Schneider/Rockwell only | sketch_adapter + provider routing |

### P3 — Logic depth

| # | Item | Why | Verify |
|---|------|-----|--------|
| 9 | **General arbitrary-logic synthesis** | Reliability bar higher than constrained 4e | Separate design doc; not pattern fallback |
| 10 | **Pattern library v2** | More industrial templates (PID, interlocks, …) | Same pattern as 4j: IR + validator + round-trip rows |
| 11 | **M221 direct IR→Calaos** (optional) | Remove adapter hop; cosmetic architecture | Regression: `test_m221*.py` |

### P4 — Parallel polish (non-blocking)

| # | Item | Why | Verify |
|---|------|-----|--------|
| 12 | **Activate recommend/rectify Claude routes** | Infra exists post 4e-2 | E2E with `ANTHROPIC_API_KEY`; see §3 Track B |

---

## 3. Track B — optional parallel (does not block P0–P2)

| Item | Depends on | Notes |
|------|------------|-------|
| Activate `/api/recommend-plc`, `/api/recommend-solution`, `/api/recommend-error` | 4e-2 Claude infra | Config + E2E only — not a serializer change |

Do **not** treat Track B as a substitute for program generate from description (**4e-3** — already delivered).

---

## 4. Explicitly out of scope for PLC export releases

| Item | Reason |
|------|--------|
| Native binary formats (`.acd`, `.zap*`, `.gxw`) | Not writable from cloud |
| Siemens TIA Openness full project | Proprietary Windows toolchain |
| Mitsubishi native `.gxw` project | Binary; GX Works required |
| FBD graphical layout fidelity | LD/IR correctness first |
| Live download-to-PLC | Desktop PyAutoGUI track |
| Billing / Stripe | Separate product phase |
| Real OAuth (Google/GitHub) | Separate auth initiative |
| Real SAP (RFC/OData) | Simulated today |

---

## 5. Frozen tracks (auth, integrations, billing)

**Do not implement** during PLC export work unless the user explicitly requests.

### Auth
- Real OAuth on login — UI exists; credentials auth ships today.

### Integrations
- Real SAP — `sap/*` simulated (`simulated: true`). See `app/api/sap/export/route.ts`.

### Billing & monetization
- Stripe checkout, webhooks, tier enforcement — UI-only pages exist.
- See [FEATURE_NAVIGATION_GUIDE.md](../product/FEATURE_NAVIGATION_GUIDE.md) § Billing.

---

## 6. Mapping to PHASE_4

| This doc section | PHASE_4 |
|------------------|---------|
| §1 Delivered | §7.0 roadmap (all ✅) |
| §1.5 Scope boundaries | §1 acceptance vs v1.5 CI bar; §5 platform tables |
| §2 Phase 5 P0–P4 | Deferred items from Phase 4 audit |
| §3 Track B | §7.16 Track B |
| §5 Frozen | §7.16 frozen / §7.14 billing untouched |

---

## 7. Version history

| Date | Notes |
|------|-------|
| 2026-06-14 | Initial backlog from Phase 4 planning |
| 2026-06-14 | FastAPI Phases 0–5 + §7 sprint complete |
| 2026-06-14 | Renamed to **PHASE_5_IMPLEMENTATION.md**; v1.5 polish items closed |

---

**Phase 5 Implementation Plan | PLCAutoPilot**

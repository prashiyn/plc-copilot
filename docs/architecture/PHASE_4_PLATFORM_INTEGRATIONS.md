# Phase 4 — Platform Integrations (Planning Document)

> Status: **DRAFT for review** — no implementation until approved.
> Scope: real, importable PLC program export per vendor, and the logic-generation
> pipeline that feeds it. This is the critical piece of v1.5.

---

## 1. Goal & definition of "done"

Today the app *generates text that looks like* PLC programs. The goal of Phase 4 is
that a user can generate a program and **open the downloaded file directly in the
vendor's IDE without errors**.

**Acceptance criteria (per platform):**
1. The exported file opens/imports in the target IDE with **zero import errors**.
2. The program **compiles** in that IDE.
3. I/O, timers, counters, and the core logic match the user's request.
4. Safety scaffolding (E-stop, seal-in) is present where applicable.
5. A round-trip parse (export → parse back) reproduces the same logical structure.

If a platform cannot meet (1)–(2) with an open format, we say so explicitly and
ship the best *importable source* we can (see feasibility tiers below).

---

## 2. Current state (honest audit)

There are **two parallel, unmerged export stacks**:

### 2a. Next.js generators (what the live app actually uses)
- `app/api/generate-plc/generators/{schneider,siemens,rockwell,generic}.ts`
  - Regex-parse the description (defaults assume a "sequential lights" example),
    then fill string templates. Largely **placeholder**.
  - `rockwell.ts` → comment/`;`-prefixed **text**, not L5X XML → **won't import**.
  - `siemens.ts` → SCL-ish **comment text** → not an importable unit.
  - `generic.ts` → IEC 61131-3 Structured Text (reasonable as plain ST).
  - `schneider.ts` → XML using a **fabricated `<ProjectDescriptor>` schema**.
- `app/api/generate-plc-ai/route.ts` `generateSmbpXml()` → another `.smbp` approximation.
- `app/api/download-program/route.ts` (410 lines) → per-platform branches that emit
  **approximations** (text/near-XML), not validated importable files.

**Critical mismatch:** the generated `.smbp` uses `<ProjectDescriptor>`, but a real
EcoStruxure file (`automation/samples/tankcontrol.smbp`) uses
`<Project xmlns="http://www.schneider-electric.com/Calaos/Case/2.0">` with
`FileHeader` / `ContentHeader` / `Workspace` / `POU` / PLCopen-style `interface`/
`localVars`. **The app's `.smbp` will not load in EcoStruxure.**

### 2b. Python `automation/plc_file_handler/` (the real, but offline, capability)
- `generators/`: `schneider_generator.py` (valid `.smbp` XML), `rockwell_generator.py`
  (valid `.L5X` XML via ElementTree). **Only Schneider + Rockwell.**
- `parsers/`: `schneider`, `rockwell`, `siemens`, `mitsubishi` (read/inspect).
- `converters/`: `platform_converter.py` (schneider↔rockwell, schneider→siemens/
  mitsubishi tag mapping), `sketch_analyzer.py`.
- `automation/plc_automation/plcopen_xml.py` → PLCopen TC6 XML
  (`automation/samples/MotorControl_Universal.xml` is valid `tc6_0201`).
- Reached today only by `generate-from-sketch` / `analyze-sketch` via `python3`
  shell-out.

### 2c. Declared format support (`utils/format_detector.py`)
| Platform | Extensions detected |
|---|---|
| schneider | `.smbp`, `.xml` |
| siemens | `.ap15–19`, `.zap15–17`, `.scl` |
| rockwell | `.acd`, `.l5x`, `.l5k` |
| mitsubishi | `.gxw`, `.gx2`, `.gx3` |
| codesys | `.project`, `.export` |
| generic | `.st`, `.ld`, `.xml` |

---

## 3. Vendor format feasibility (the hard reality)

Not every vendor has an open, writable interchange format. This drives scope.

| Platform | Open importable format | Native project | Verdict |
|---|---|---|---|
| **Rockwell** | **`.L5X` (documented XML)** — imports into Studio 5000 | `.acd` (binary) | ✅ **Tier 1** — fully feasible in TS |
| **CODESYS / "universal"** | **PLCopen TC6 `.xml`** | `.project` (binary) | ✅ **Tier 1** — feasible (also covers many CODESYS-OEM brands) |
| **Schneider** | **`.smbp` (Calaos/Case XML)** — opens in EcoStruxure Basic | — | ✅ **Tier 1** — feasible (we have a valid reference sample) |
| **Siemens** | `.scl` source import; PLCopen import is partial | `.ap*/.zap*` (proprietary, TIA Openness only) | ⚠️ **Tier 2** — ship SCL + PLCopen; no full project |
| **Mitsubishi** | IL/ST text + device-comment CSV import | `.gxw/.gx*` (binary) | ⚠️ **Tier 2** — ship IL/CSV; no native project |

> Native binaries (`.acd`, `.zap`, `.gxw`) require the vendor toolchain on Windows
> and are **out of scope** for v1.5. We target the open/importable formats above.

---

## 4. Proposed architecture

### Decision D1 — A platform-neutral Intermediate Representation (IR)
Generate the **logic once** into a vendor-neutral IR, then **serialize** the IR to
each vendor format. This avoids N independent generators drifting out of sync and is
the single most important design choice.

```ts
// lib/plc-ir/types.ts (proposed)
interface PlcProgram {
  name: string;
  target: { vendor: 'schneider'|'rockwell'|'siemens'|'mitsubishi'|'codesys'|'generic'; model: string };
  vars: PlcVar[];                 // typed, addressed I/O + memory
  pous: Pou[];                    // program organization units
  meta: { author: string; description: string; createdAt: string };
}
interface PlcVar {
  symbol: string; address?: string;            // e.g. %I0.0 / Local:1:I.Data.0
  dataType: 'BOOL'|'INT'|'DINT'|'REAL'|'TIME'|'TON'|'TOF'|'CTU'|'CTD';
  kind: 'input'|'output'|'memory'|'timer'|'counter';
  initial?: string; comment?: string;
}
interface Pou {
  name: string; language: 'LD'|'ST'|'IL'|'FBD';
  networks: Network[];            // rungs
}
interface Network {
  label?: string; comment?: string;
  // Logic is held in a small expression tree so each serializer can render
  // LD contacts/coils, ST assignments, or IL instructions from the same source.
  logic: LogicNode;               // AND/OR/NOT/contact/coil/timer/counter/assign
}
```

The IR is rich enough to render **LD, ST, and IL** deterministically per vendor.

### Decision D2 — TS-native serializers (NOT runtime Python) — **DECIDED**
Target is **cloud deployment** (not necessarily Vercel). To stay portable across any
cloud host — and avoid a runtime Python dependency in serverless environments — the
serializers are implemented in **TypeScript**:
- All target formats are XML/text — straightforward with `fast-xml-parser` or manual
  XML building.
- Treat the **Python generators as the reference spec** to port from (especially
  `schneider_generator.py` and `rockwell_generator.py`, which already emit valid files).
- Keep Python only for offline/CLI use and as a **round-trip validator in CI** (its
  parsers can re-read what TS produced).

### Decision D1b — Extensible provider registry (add platforms without touching core) — **DECIDED**
Adding a new vendor must be a drop-in, not a refactor. Every serializer implements one
interface and self-registers; the rest of the app only knows the registry.

```ts
// lib/plc-ir/provider.ts (proposed)
interface PlatformProvider {
  id: 'rockwell'|'schneider'|'codesys'|'siemens'|'mitsubishi'|'generic' | string;
  label: string;
  fileExtension: string;          // '.L5X', '.smbp', '.xml', '.scl', ...
  tier: 1 | 2;                    // 1 = importable project; 2 = importable source
  supports(model: string): boolean;
  serialize(program: PlcProgram): { content: string; fileName: string; mimeType: string };
  validate?(content: string): { ok: boolean; errors: string[] };  // XSD / round-trip
}

// lib/plc-ir/registry.ts
const providers = new Map<string, PlatformProvider>();
export function registerProvider(p: PlatformProvider) { providers.set(p.id, p); }
export function getProvider(id: string): PlatformProvider | undefined { return providers.get(id); }
export function listProviders(): PlatformProvider[] { return [...providers.values()]; }
```

- **Adding a platform = create `lib/plc-ir/serializers/<vendor>.ts` implementing
  `PlatformProvider` + one `registerProvider(...)` call.** No edits to routes, IR, or
  the logic pipeline.
- `download-program` and the generator-save path resolve the provider by `id` from the
  registry — so new vendors light up everywhere automatically (download, model picker,
  re-export).
- The PLC model database (`lib/plc-models-database.ts`) maps each model → provider `id`.

### Decision D3 — Logic generation pipeline (the "logic" half)
```
user request (NL + I/O + model)
      │
      ▼
[1] Pattern library (deterministic)  ── motor start/stop, seal-in, sequential,
      │                                  conveyor, traffic, tank level, e-stop
      ▼ (if no exact pattern)
[2] Claude → IR (grounded)           ── prompt returns IR JSON, validated against
      │                                  a JSON schema; retries on invalid
      ▼
[3] IR validation + safety pass      ── address allocation, type checks, ensure
      │                                  E-stop/seal-in present where required
      ▼
[4] Vendor serializer (D1/D2)        ── IR → .L5X / .smbp / PLCopen / SCL / IL
      │
      ▼
[5] Format validation                ── XSD/well-formedness + round-trip parse
```
- **Deterministic-first (v1.5 scope = reliable & workable):** common patterns come
  from a vetted template library (correct, testable, no LLM variance). Claude handles
  the rest by emitting **IR** (not raw vendor text), and that IR must validate against
  the schema + safety pass or we reject it and fall back to the closest pattern.
- **Deferred to next version:** general arbitrary-logic synthesis (free-form programs
  beyond the pattern library). v1.5 favors correctness over coverage — we ship a
  bounded, dependable set and scale breadth later. (Tracked in the next-version backlog.)
- This builds directly on Phase 3's `askClaudeJson` + fallback approach.

### Decision D4 — Validation & verification — **DECIDED**
- **Definition of "done" for v1.5 = schema validation + round-trip parse.**
  - **Schema validation:** validate `.L5X` and PLCopen against their XSDs; validate
    `.smbp` against the Calaos sample's structure.
  - **Round-trip:** export → parse with the Python parsers → assert structure matches
    the IR. Run in CI (Python allowed there) on a fixture matrix.
- **Deferred to next version:** real **IDE import sign-off** per platform (opening each
  file in Studio 5000 / EcoStruxure / TIA / GX Works). We don't have the IDEs to test
  now, so v1.5 relies on schema + round-trip; IDE sign-off is a next-version gate.
  (Tracked in the next-version backlog.)

---

## 5. Per-platform plan

### 5.1 Rockwell `.L5X` — Tier 1, do first
- Port `rockwell_generator.py` → `lib/plc-ir/serializers/rockwell-l5x.ts`.
- Emit `RSLogix5000Content` → `Controller` → `Programs/Routines/RLLContent` with
  rungs as neutral-text logic; `Tags` from IR vars.
- **Verify:** import into Studio 5000 (or validate against L5X XSD if no IDE).

### 5.2 CODESYS / generic PLCopen `.xml` — Tier 1
- Port `plcopen_xml.py` → `lib/plc-ir/serializers/plcopen.ts` (`tc6_0201`).
- Covers CODESYS import and many OEM-rebranded CODESYS PLCs.

### 5.3 Schneider `.smbp` — Tier 1 (fix the schema)
- Replace the fabricated `<ProjectDescriptor>` with the real **`Calaos/Case/2.0`**
  structure (port `schneider_generator.py`; match `samples/tankcontrol.smbp`).
- **Verify:** open in EcoStruxure Machine Expert Basic.

### 5.4 Siemens — Tier 2 (importable source for v1.5)
- Emit **SCL** (`.scl`, importable as an external source) from IR ST, plus a
  **PLCopen `.xml`** option. Clearly label "source import, not a full project".
- **Deferred to next version:** full TIA project / TIA Openness export.

### 5.5 Mitsubishi — Tier 2 (importable source for v1.5)
- Emit **IL/ST text** + **device-comment CSV** for GX Works import. Label limitations.
- **Deferred to next version:** native GX Works project export.

### 5.6 Wire-up
- Route everything through one place: `download-program` (and the generator save in
  Phase 3) call the IR serializers; deprecate the placeholder
  `generate-plc/generators/*` once parity is reached.
- Persist the IR alongside the code in `generated_programs.generation_parameters`
  so re-export to another vendor needs no regeneration.

---

## 6. Suggested implementation sub-phases (each independently shippable + verified)

| Sub-phase | Deliverable | Verify |
|---|---|---|
| **4a** | `lib/plc-ir` types + pattern library (motor start/stop, sequential, e-stop) + IR validator | unit tests: pattern → IR |
| **4b** | Rockwell `.L5X` serializer | L5X XSD validation + import test |
| **4c** | PLCopen serializer (CODESYS/generic) | PLCopen XSD + round-trip parse |
| **4d** | Schneider `.smbp` serializer (correct schema) | open in EcoStruxure |
| **4e** | Claude→IR path (novel logic) + JSON-schema validation + fallback to patterns | golden tests; invalid-IR retry |
| **4f** | Siemens SCL/PLCopen + Mitsubishi IL/CSV (Tier 2) | compile SCL; GX import |
| **4g** | Route consolidation: `download-program` + generators → IR; persist IR | e2e: generate→download→import |

Recommended order: **4a → 4b → 4c → 4d → 4e → 4f → 4g.** 4b first proves the IR
end-to-end against the most tractable real format.

---

## 7. Testing & data
- **Fixtures:** a handful of canonical programs (motor start/stop, 4-light sequence,
  tank level) as IR → exported to every format → checked in under `test/fixtures/`.
- **CI:** TS serializer unit tests + Python round-trip parse (Python is fine in CI).
- **`generated_programs`:** already stores `programCode`, `programFormat`,
  `generationParameters` — add the IR JSON to `generationParameters` (no schema change).

## 8. Out of scope for v1.5
All deferred items are tracked in [NEXT_VERSION_BACKLOG.md](NEXT_VERSION_BACKLOG.md):
- Native binary projects (`.acd`, `.zap*`, `.gxw`); Siemens TIA Openness; full
  Siemens/Mitsubishi project export.
- Real IDE import sign-off per platform; general arbitrary-logic synthesis.
- FBD graphical layout fidelity.
- Live download-to-PLC (that's the desktop `automation/` scripts, separate track).

---

## 9. Decisions (resolved 2026-06-14)
1. **Deploy target:** cloud, **not Vercel-specific** → TS-native serializers (D2) for
   portability; no runtime Python.
2. **Platform priority:** **Rockwell → Schneider → CODESYS** (confirmed), plus an
   **extensible provider registry** (D1b) so new vendors are drop-in.
3. **Logic depth (v1.5):** **reliable & workable first** — pattern library + Claude→IR
   constrained to validated structures. General arbitrary-logic synthesis → next version.
4. **Validation bar (v1.5 "done"):** **schema validation + round-trip parse.** Real
   IDE import sign-off → next version (no IDEs available to test now).
5. **Tier-2 (Siemens/Mitsubishi):** **importable source (SCL/IL/CSV) is acceptable**
   for v1.5. Full project export → next version.

> Deferred items are tracked in
> [NEXT_VERSION_BACKLOG.md](NEXT_VERSION_BACKLOG.md) so nothing is lost.

---
name: mitsubishi
description: Expert Mitsubishi MELSEC PLC programming via GX Works2/GX Works3. Use for Mitsubishi, MELSEC, FX5U, iQ-R, Q series, GX Works, .gx3, .gxw, or Asia-Pacific Mitsubishi automation tasks.
---

# Mitsubishi PLC Programming (stub)

> Full skill reference not yet written in `.claude/skills/`. Use this workflow plus `plc-file-handler` and PLCopen XML until a dedicated `.claude/skills/mitsubishi.md` lands.

## Before generating Mitsubishi programs

1. Read `.claude/skills/plc-file-handler.md` — Mitsubishi section (`.gxw`, `.gx2`, `.gx3`, OLE2 compound format)
2. Confirm controller family: FX (compact), Q/L (modular), iQ-R (high-performance)
3. Confirm software: GX Works2 vs GX Works3

## Critical facts

- Project files use **Microsoft Compound File Binary Format (OLE2/CFBF)** — not plain XML
- Primary languages: Ladder Diagram (LD), Structured Text (ST), SFC
- Parser stub: `automation/plc_file_handler/parsers/mitsubishi_parser.py`

## Preferred generation paths (current)

1. **PLCopen XML** (recommended): `automation/plc_automation/` with `Platform.MITSUBISHI` → export XML → import in GX Works
2. **Web API generator**: check `app/api/generate-plc/generators/` for Mitsubishi support
3. **Direct `.gx3` manipulation**: via `plc_file_handler` when parser/generator is extended

## Workflow

1. Define I/O list, device assignments, and safety interlocks (E-stop)
2. Generate LD/ST logic per IEC 61131-3
3. Export via PLCopen XML or platform converter
4. Document GX Works import steps for target controller
5. Flag safety-critical logic for certified engineer review

## Planned (v2.0)

- `.claude/skills/mitsubishi.md` — addressing, device memory, timer/counter conventions
- Python templates analogous to M221 `create_sequential_*.py`
- Full `.gx3` read/write via OLE2 parser

## Additional reference

- `docs/architecture/PHASE_4_PLATFORM_INTEGRATIONS.md` — per-vendor export pipeline
- `automation/plc_automation/plcopen_xml.py` — universal interchange format
- Market context: ~15% global share, strong in Asia — see `.claude/skills/README.md`

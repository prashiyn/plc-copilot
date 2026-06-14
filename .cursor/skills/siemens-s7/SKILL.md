---
name: siemens-s7
description: Expert Siemens S7-1200/S7-1500 PLC programming via TIA Portal. Use for Siemens, S7-1200, S7-1500, TIA Portal, PROFINET, LAD, SCL, .ap15–.ap19, or European Siemens automation tasks.
---

# Siemens S7 PLC Programming

## Before generating Siemens programs

1. Read `.claude/skills/siemens-s7.md` (full skill reference)
2. Confirm target controller (S7-1200 vs S7-1500) and TIA Portal version

## Critical differences from Schneider

- `.apXX` files are **proprietary compressed archives** — direct XML editing is not viable
- Uses IEC timer/counter function blocks (TON, TOF, TP, CTU, CTD) in data blocks
- Object-oriented: function blocks, data blocks, organization blocks
- Addressing: `%I0.0`, `%Q0.0`, `%M0.0`, `%MW0` (similar notation, different tooling)

## Preferred generation paths

1. **PLCopen XML** (universal, no SDK): `automation/plc_automation/` with `Platform.SIEMENS` → export XML → import in TIA Portal
2. **Web API generator**: `app/api/generate-plc/generators/siemens.ts`
3. **TIA Openness SDK** (when available): for direct `.apXX` manipulation

## Workflow

1. Define I/O list, safety interlocks (E-stop), and control sequence
2. Generate ladder/SCL logic following IEC 61131-3
3. Export via PLCopen XML or platform-specific generator
4. Document import steps for TIA Portal
5. Flag sections requiring certified engineer review (IEC 61508)

## Additional reference

- `docs/architecture/PHASE_4_PLATFORM_INTEGRATIONS.md` — per-vendor export pipeline
- `automation/plc_file_handler/parsers/siemens_parser.py` — file parsing
- Web platform page: `app/(platforms)/siemens/page.tsx`

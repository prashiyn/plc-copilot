---
name: codesys
description: Universal CODESYS V3 PLC programming for 500+ IEC 61131-3 brands (ABB, WAGO, Festo, Eaton, and many Schneider deployments). Use for CODESYS, .project, .export, multi-brand PLC, or vendor-agnostic IEC 61131-3 generation.
---

# CODESYS Universal PLC Programming (stub)

> Full skill reference not yet written in `.claude/skills/`. CODESYS is the primary path to 500+ PLC brands from one IEC 61131-3 toolchain.

## Before generating CODESYS programs

1. Read `.claude/skills/plc-file-handler.md` — CODESYS section (`.project`, `.export`, XML schema)
2. Confirm target runtime/device profile (vendor-specific CODESYS device description)
3. Confirm languages needed: LD, FBD, ST, SFC, IL (all IEC 61131-3 supported)

## Critical facts

- `.project` / `.export` files are **XML-based** — most approachable multi-vendor format
- One CODESYS project can target many brands via device profiles and libraries
- No vendor SDK required for XML-level generation (unlike TIA Openness or FactoryTalk)

## Preferred generation paths (current)

1. **PLCopen XML** (recommended interchange): `automation/plc_automation/plcopen_xml.py` → import into CODESYS
2. **Platform converter**: `automation/plc_file_handler/converters/platform_converter.py`
3. **Direct CODESYS XML**: extend generators when `.claude/skills/codesys.md` is added

## Workflow

1. Define application structure: POUs, tasks, global variables, I/O mapping
2. Implement logic in LD/ST (or FBD for analog/PID-heavy apps)
3. Export PLCopen XML or CODESYS `.export`
4. Document device profile and compile/download steps for target hardware
5. Flag safety logic for certified engineer review (IEC 61508)

## Supported brand examples (via CODESYS runtime)

Schneider (some lines), ABB AC500, WAGO PFC, Festo, Eaton, Phoenix Contact PLCnext (partial), and 500+ others — verify device support before committing to a profile.

## Planned (v2.0)

- `.claude/skills/codesys.md` — POUs, task config, library references, device catalog patterns
- Python templates for common patterns (motor start/stop, sequential control)
- Validation against CODESYS XML schema

## Additional reference

- `docs/architecture/PHASE_4_PLATFORM_INTEGRATIONS.md` — logic IR and multi-vendor export
- `automation/samples/MotorControl_Universal.xml` — sample PLCopen output
- `.claude/skills/README.md` — roadmap entry for CODESYS universal skill

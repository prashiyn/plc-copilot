---
name: codesys
description: Universal CODESYS V3 PLC programming for 500+ IEC 61131-3 brands (ABB, WAGO, Festo, Eaton, and many Schneider deployments). Use for CODESYS, .project, .export, multi-brand PLC, or vendor-agnostic IEC 61131-3 generation.
---

# CODESYS Universal PLC Programming

## Before generating CODESYS programs

1. Read `.claude/skills/codesys.md` (full skill reference)
2. Confirm target **device profile** in CODESYS device catalog (vendor + model)
3. Confirm languages: LD, ST, FBD, SFC, IL

## Critical facts

- `.project` and `.export` are **XML-based** — easiest multi-vendor native format
- Structure: Device → PlcLogic/Application → POUs, GVLs, Tasks
- **Preferred path**: PLCopen XML → CODESYS import

## Template / API path

```python
from plc_automation import PLCAutomation, Platform

automation = PLCAutomation(Platform.CODESYS)
automation.create_project("MotorControl", "CODESYS Control Win V3")
automation.add_motor_startstop()
automation.export_xml("MotorControl_Codesys.xml")
```

Sample: `automation/samples/MotorControl_Universal.xml`

## Workflow

1. Select device profile; define GVL symbols and I/O mapping
2. Implement logic in LD/ST (IEC FBs: TON, TOF, CTU)
3. Export PLCopen XML or build `.project` XML
4. Import in CODESYS → map I/O → build → download or export `.export`
5. Engineer review required for safety-critical logic (IEC 61508)

## Additional reference

- `automation/plc_automation/plcopen_xml.py` — XML generator
- `automation/plc_file_handler/converters/platform_converter.py`
- `docs/architecture/PHASE_4_PLATFORM_INTEGRATIONS.md`

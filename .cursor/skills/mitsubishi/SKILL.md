---
name: mitsubishi
description: Expert Mitsubishi MELSEC PLC programming via GX Works2/GX Works3. Use for Mitsubishi, MELSEC, FX5U, iQ-R, Q series, GX Works, .gx3, .gxw, or Asia-Pacific Mitsubishi automation tasks.
---

# Mitsubishi PLC Programming

## Before generating Mitsubishi programs

1. Read `.claude/skills/mitsubishi.md` (full skill reference)
2. Confirm controller family: FX5U (compact), Q/L (modular), iQ-R (high-performance)
3. Confirm software: GX Works2 vs GX Works3

## Critical facts

- Native `.gxw`/`.gx2`/`.gx3` = **OLE2 compound files** — not plain XML
- Device addressing: **X** (inputs), **Y** (outputs), **M** (internal), **T** (timers), **C** (counters), **D** (data)
- **Preferred path**: PLCopen XML → import in GX Works

## Template / API path

```python
from plc_automation import PLCAutomation, Platform

automation = PLCAutomation(Platform.MITSUBISHI)
automation.create_project("MotorControl", "FX5U")
automation.add_motor_startstop()
automation.export_xml("MotorControl_Mitsubishi.xml")
```

Sample: `automation/samples/MotorControl_Universal.xml`

## Workflow

1. Define I/O device map (X/Y/M) and safety interlocks (E-stop, overload)
2. Generate LD/ST logic per IEC 61131-3
3. Export PLCopen XML via `automation/plc_automation/`
4. Import in GX Works → rebind `%I/%Q` to X/Y if needed
5. Simulate (GX Simulator) before download; engineer review required

## Additional reference

- `.claude/skills/plc-file-handler.md` — OLE2 format details
- `automation/plc_file_handler/parsers/mitsubishi_parser.py` — parser stub
- `docs/architecture/PHASE_4_PLATFORM_INTEGRATIONS.md`

---
name: rockwell-allen-bradley
description: Expert Rockwell/Allen-Bradley ControlLogix and CompactLogix programming via Studio 5000. Use for ControlLogix, CompactLogix, Rockwell, Studio 5000, RSLogix, .ACD, .L5X, EtherNet/IP, or North American tag-based PLC tasks.
---

# Rockwell / Allen-Bradley PLC Programming

## Before generating Rockwell programs

1. Read `.claude/skills/rockwell-allen-bradley.md` (full skill reference)
2. Confirm controller family (ControlLogix vs CompactLogix) and Studio 5000 version

## Critical differences

- **Tag-based addressing** — not direct `%I/%Q` addresses like Schneider
- `.ACD` = proprietary binary; prefer **`.L5X` XML** for read/write
- Timers/counters are tag-based (TON, TOF, RTO instruction blocks)
- EtherNet/IP is the primary industrial network protocol

## Tag naming example

```
Start_PB (BOOL)     - Start pushbutton
Stop_PB (BOOL)      - Stop pushbutton
Motor_Run (BOOL)    - Motor running seal-in
Motor_Speed (INT)   - Speed setpoint
```

## Preferred generation paths

1. **PLCopen XML**: `automation/plc_automation/` with `Platform.ROCKWELL` → import via Studio 5000
2. **Web API generator**: `app/api/generate-plc/generators/rockwell.ts`
3. **L5X direct**: `automation/plc_file_handler/generators/rockwell_generator.py`

## Workflow

1. Define controller tags (inputs, outputs, internal coils, timers)
2. Implement ladder with seal-in, E-stop interlocks, overload protection
3. Export as `.L5X` or PLCopen XML
4. Document Studio 5000 import procedure
5. Flag safety-critical sections for engineer review

## Additional reference

- `automation/plc_file_handler/parsers/rockwell_parser.py`
- `docs/architecture/PHASE_4_PLATFORM_INTEGRATIONS.md`
- Sample universal XML: `automation/samples/MotorControl_Universal.xml`

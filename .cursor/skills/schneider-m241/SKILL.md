---
name: schneider-m241
description: Expert Schneider M241/M251/M258 PLC programming with Ethernet, Modbus TCP, and PID. Use for M241, M251, M258, TM241, Modbus TCP, PID control, or mid-range Schneider Modicon tasks (not M221).
---

# Schneider M241/M251/M258 PLC Programming

## Before generating M241+ programs

1. Read `.claude/skills/schneider-m241.md` (full skill reference)
2. Confirm this is **not** an M221 task (M221 uses single XML; M241+ uses ZIP `.smbp`)

## M241 vs M221

| Feature | M221 | M241/M251/M258 |
|---------|------|----------------|
| `.smbp` format | Single XML | ZIP archive |
| Memory bits | %M0–%M511 | %M0–%M2047 |
| Timers | 255 | 512 |
| Ethernet/Modbus | No | Yes |
| PID | No | Built-in |

## ZIP archive structure

```
Project.smbp (ZIP)
├── ProjectInfo.xml
├── Application/Program.xml, Tasks.xml, Variables.xml
├── Hardware/Configuration.xml, IOMapping.xml
└── Libraries/References.xml
```

## Preferred generation paths

1. **PLCopen XML**: `automation/plc_automation/` with appropriate platform enum → import in Machine Expert
2. **File handler**: `automation/plc_file_handler/generators/schneider_generator.py`
3. **EcoStruxure API**: `automation/plc_automation/ecostruxure_api.py` (when IDE is available)

## Workflow

1. Define hardware config, I/O mapping, and communication requirements (Modbus TCP if needed)
2. Generate program logic (LD preferred; ST for complex math/PID)
3. Package as ZIP `.smbp` or export PLCopen XML
4. Validate archive structure and I/O limits for target controller
5. Document import and commissioning steps

## Additional reference

- `.claude/skills/schneider.md` — shared Schneider patterns (sections for M241+)
- `docs/automation/EcoStruxure_Machine_Expert_Basic_Programming_Guide.md`

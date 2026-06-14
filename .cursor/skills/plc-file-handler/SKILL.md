---
name: plc-file-handler
description: Read, parse, generate, and convert native PLC project files (.smbp, .apXX, .ACD, .L5X, CODESYS). Use when handling PLC file formats, converting between platforms, parsing vendor projects, or generating production-ready project files from specs or sketches.
---

# PLC File Handler

## Before any file operation

1. Read `.claude/skills/plc-file-handler.md` (full format reference)
2. Identify platform from extension and file magic bytes
3. Use the Python package at `automation/plc_file_handler/` for programmatic work

## Format quick reference

| Platform | Extension | Structure | Preferred approach |
|----------|-----------|-----------|-------------------|
| Schneider M221 | `.smbp` | Single XML | Generate XML directly (see `schneider-m221` skill) |
| Schneider M241+ | `.smbp` | ZIP archive | Extract/edit XML components |
| Siemens | `.ap15`–`.ap19` | Proprietary ZIP | PLCopen XML export or TIA Openness API |
| Rockwell | `.ACD` / `.L5X` | Binary / XML | Prefer `.L5X` XML for read/write |
| Mitsubishi | `.gx3` | OLE2 compound | Parser in `plc_file_handler/parsers/` |
| Universal | `.xml` | PLCopen IEC 61131-3 | `automation/plc_automation/plcopen_xml.py` |

## Python package layout

```
automation/plc_file_handler/
├── cli.py                          # CLI entry point
├── parsers/                        # schneider, siemens, rockwell, mitsubishi
├── generators/                     # schneider, rockwell generators
├── converters/                     # platform_converter, sketch_analyzer
└── examples/                       # example_generate_motor_control.py
```

## Workflow

1. **Read**: detect format → parse → summarize ladder logic, tags, I/O config
2. **Generate**: pick generator for target platform → use templates/patterns → validate structure
3. **Convert**: use `converters/platform_converter.py` or PLCopen XML as interchange format
4. **Validate**: check against platform-specific checklist in `.claude/skills/plc-file-handler.md`

## Docs

- `automation/plc_file_handler/README.md` — API reference
- `automation/plc_file_handler/USAGE_GUIDE.md` — usage examples
- `docs/automation/PLC_SKILL_INTEGRATION.md` — skill integration notes

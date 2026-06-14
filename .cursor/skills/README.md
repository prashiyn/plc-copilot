# PLCAutoPilot Cursor Skills

Cursor agent workflows for this repo. Each skill is a concise entry point; full platform reference lives in `.claude/skills/`.

| Skill | Use when |
|-------|----------|
| [organize-docs](organize-docs/SKILL.md) | Tidying stray documentation into `docs/` |
| [schneider-m221](schneider-m221/SKILL.md) | M221/TM221 `.smbp` generation, sequential control |
| [schneider-m241](schneider-m241/SKILL.md) | M241/M251/M258, Modbus TCP, PID |
| [siemens-s7](siemens-s7/SKILL.md) | S7-1200/1500, TIA Portal |
| [rockwell-allen-bradley](rockwell-allen-bradley/SKILL.md) | ControlLogix/CompactLogix, Studio 5000 |
| [plc-file-handler](plc-file-handler/SKILL.md) | Parse/convert/generate any vendor PLC file |
| [mitsubishi](mitsubishi/SKILL.md) | FX5U, iQ-R, Q series, GX Works |
| [codesys](codesys/SKILL.md) | CODESYS V3, 500+ brands, IEC 61131-3 |

## Full reference library (`.claude/skills/`)

| File | Contents |
|------|----------|
| `schneider.md` | Complete Schneider skill (1100+ lines) |
| `m221-knowledge-base.md` | M221 XML schemas and patterns |
| `M221-AGENT-ACTIVATION.md` | Template auto-loading rules |
| `tm221-complete-reference.md` | TM221 hardware reference |
| `plc-file-handler.md` | All vendor file formats |
| `siemens-s7.md` | Siemens addressing and patterns |
| `rockwell-allen-bradley.md` | Tag-based Rockwell patterns |
| `schneider-m241.md` | M241+ ZIP archive structure |
| `mitsubishi.md` | MELSEC addressing, GX Works, PLCopen import |
| `codesys.md` | CODESYS project structure, multi-brand deployment |

See also `.claude/skills/README.md` for the complete index.

## Cursor rules (`.cursor/rules/`)

| Rule | Scope |
|------|-------|
| `plc-copilot-core.mdc` | Always — repo layout, safety, conventions |
| `plc-autonomy.mdc` | Always — delivery workflow from `.claude/AUTONOMY.md` |
| `plc-m221-generation.mdc` | `automation/**`, `*.smbp` |
| `nextjs-webapp.mdc` | `app/**`, `lib/**` |

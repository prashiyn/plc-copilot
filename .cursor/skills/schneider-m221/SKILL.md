---
name: schneider-m221
description: Expert Schneider M221 (TM221) PLC programming — .smbp XML generation, ladder/IL, timers, sequential control. Use for M221, TM221, TM221CE24T, .smbp, Machine Expert Basic, SoMachine Basic, sequential lights, seal-in circuits, or Schneider Modicon M221 tasks.
---

# Schneider M221 PLC Programming

## Before generating any M221 program

1. Read `.claude/skills/schneider.md` (full skill reference)
2. Read `.claude/skills/m221-knowledge-base.md` (XML schemas, grid layout, timer patterns)
3. Read `.claude/skills/M221-AGENT-ACTIVATION.md` (template selection rules)
4. Load the matching Python template (see below)

## M221 critical facts

- `.smbp` = **single XML file** (not ZIP — that is M241+)
- 10-column ladder grid: columns 0–9 logic, column 10 outputs only
- Dual representation per rung: `<LadderElements>` + `<InstructionLines>`
- Addressing: `%I0.x` inputs, `%Q0.x` outputs, `%M` memory, `%TM` timers, `%C` counters

## Template selection

| Task | Template |
|------|----------|
| Ladder diagram (LD) | `automation/create_sequential_4lights_LD.py` |
| Instruction list, 4 lights | `automation/create_sequential_4lights_IL.py` |
| Instruction list, simple | `automation/create_sequential_lights_IL.py` |
| Motor start/stop | `automation/plc_automation/create_motor_startstop_smbp.py` |
| Fast unified API | `automation/plc_automation/` (`PLCAutomation`, `Platform.SCHNEIDER`) |

## Workflow

1. Identify controller model (e.g. TM221CE24T) and I/O requirements
2. Copy structure from the closest template — do not invent XML from scratch
3. Modify rungs, timers, and I/O mapping per user spec
4. Validate: single XML, both LD+IL per rung, column-10 outputs, IEC 61131-3 syntax
5. Output `.smbp` file; note that human engineer review is required before production

## Additional reference

- `.claude/skills/tm221-complete-reference.md` — hardware and I/O reference
- `docs/automation/PLC_PROGRAM_GENERATION_MASTER_GUIDE.md` — end-to-end generation guide
- Sample files: `automation/samples/*.smbp`

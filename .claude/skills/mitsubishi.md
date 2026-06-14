# Mitsubishi MELSEC PLC Programming Skill
## Expert Agent for FX, Q/L, and iQ-R Controllers

---

## Overview

**Target Controllers**: FX5U/FX5UC (compact), Q/L series (modular), iQ-R (high-performance), MELSEC-F (legacy)
**Software**: GX Works2 (FX/Q/L), GX Works3 (iQ-R, FX5U)
**File Format**: .gxw (GX Works2 workspace), .gx2, .gx3 (GX Works3 project)
**Programming Languages**: Ladder Diagram (LD), Structured Text (ST), Sequential Function Chart (SFC), Function Block Diagram (FBD)
**Standards**: IEC 61131-3, IEC 61508 (with safety PLC variants)

**Market Share**: ~15% global, 40%+ in Asia-Pacific

---

## CRITICAL: Mitsubishi vs Schneider/Siemens Differences

### File Structure
**Mitsubishi**: Project files use **Microsoft OLE2 Compound File Binary Format (CFBF)**
- Magic bytes: `D0 CF 11 E0 A1 B1 1A E1`
- Not plain XML — requires `olefile` or proprietary SDK to read/write natively
- **Preferred path in PLCAutoPilot**: generate **PLCopen XML** → import in GX Works

### Addressing Philosophy
| Element | Mitsubishi (MELSEC) | Schneider M221 | Siemens S7 |
|---------|---------------------|----------------|------------|
| Digital inputs | X (device) | %I0.x | %I0.0 |
| Digital outputs | Y (device) | %Q0.x | %Q0.0 |
| Internal relay | M | %M | %M0.0 |
| Timer | T | %TM | TON instance DB |
| Counter | C | %C | CTU instance DB |
| Data register | D | %MW | %MW |

**KEY DIFFERENCE**: Mitsubishi uses **device notation** (X, Y, M, T, C, D) with octal numbering for X/Y on many FX CPUs.

---

## Device Addressing Reference

### FX Series (GX Works2 / FX5U)

```
Digital Inputs:   X0, X1, X2 ... (octal on FX3U and earlier: X0-X7, X10-X17)
Digital Outputs:  Y0, Y1, Y2 ... (octal on legacy FX)
Internal relays:  M0, M100, M8000 (special relays M8000+)
Timers:           T0-T255 (100ms base) or T256+ (10ms base) — check CPU manual
Counters:         C0-C255
Data registers:   D0-D7999 (varies by CPU)
```

**FX5U example I/O map:**
```
X0  - Start pushbutton (DI)
X1  - Stop pushbutton (NC, DI)
X2  - Motor overload contact (DI)
Y0  - Motor contactor (DO)
Y1  - Run indicator lamp (DO)
M0  - Motor run seal-in
T0  - Start delay timer (K30 = 3.0s at 100ms base)
```

### Q/L Series (GX Works2)

```
Inputs:   X0-X1FFF (hex device numbers possible on modules)
Outputs:  Y0-Y1FFF
Internal: M0-M8191, L0-L8191 (latch), B0-B7FFF (link relay)
Timers:   T0-T511 (low speed), ST0-ST4095 (retentive)
Counters: C0-C1023
Data:     D0-D12287, W0-W8191 (link register)
```

### iQ-R Series (GX Works3)

```
Uses label-based programming (recommended) with device assignment:

Start_PB    (BOOL) AT X0
Stop_PB     (BOOL) AT X1
Motor_Run   (BOOL) AT Y0
Timer_1     (TIMER) AT T0

Device types: X, Y, M, L, B, SM, SD, W, SW, F, V, Z, R, T, ST, C, D
File format: .gx3 (OLE2 compound, GX Works3)
```

---

## Timers and Counters (MELSEC)

### Timer (OUT T instruction — Ladder)
```
|--[ M0 ]--[ OUT T0 K30 ]--|     ; T0 = 3.0 seconds (K30 × 100ms)

Use timer contact:
|--[ T0 ]--[ OUT Y1 ]--|         ; Output when timer done
```

### Timer types
| Type | Instruction | Behavior |
|------|-------------|----------|
| On-delay | OUT T | Delays output after input ON |
| Retentive | OUT ST | Retains elapsed value when input OFF |
| Pulse | PLS / PLF | Single-scan pulse on edge |

### Counter (OUT C instruction)
```
|--[ X0 ]--[ OUT C0 K100 ]--|    ; Count up to 100

|--[ C0 ]--[ OUT Y2 ]--|         ; Output when count reached
```

### Structured Text (GX Works3)
```
IF Start_PB AND NOT Stop_PB THEN
    Motor_Run := TRUE;
END_IF;

IF Stop_PB THEN
    Motor_Run := FALSE;
END_IF;

Y0 := Motor_Run;

Timer_1(IN := Motor_Run, PT := T#3S);
Y1 := Timer_1.Q;
```

---

## MANDATORY Templates

### Primary Path (Recommended — PLCopen XML)
**Location**: `automation/plc_automation/unified_interface.py`

```python
from plc_automation import PLCAutomation, Platform

automation = PLCAutomation(Platform.MITSUBISHI)
automation.create_project("MotorControl", "FX5U")
automation.add_motor_startstop()
automation.export_xml("MotorControl_Mitsubishi.xml")
# Import XML in GX Works3: Project → Import → PLCopen XML
```

**Sample output**: `automation/samples/MotorControl_Universal.xml`

### Secondary Path (Native .gx3 — To Be Implemented)
**Location**: `automation/plc_file_handler/parsers/mitsubishi_parser.py` (placeholder)

```python
# Requires: pip install olefile
import olefile

def inspect_mitsubishi_project(file_path: str) -> list:
    """List streams inside OLE2 compound file."""
    if not olefile.isOleFile(file_path):
        raise ValueError("Not a valid Mitsubishi OLE2 project")
    ole = olefile.OleFileIO(file_path)
    return ole.listdir()
```

**Planned template**: `automation/plc_automation/create_sequential_mitsubishi_fx5u.py`

---

## Ladder Logic Patterns (MELSEC LD)

### Pattern 1: Seal-in Circuit (Motor Start/Stop)
```
Rung 0: Motor Control
|--[ X0 Start ]--+--[ /X1 Stop ]--( Y0 Motor )--|
|                |                              |
|--[ Y0 Motor ]--+                              |
```

### Pattern 2: Timer Delay
```
Rung 1: Delayed Output
|--[ M0 Enable ]--[ OUT T0 K30 ]--|

Rung 2: Timer Done
|--[ T0 ]--( Y1 Light2 )--|
```

### Pattern 3: Sequential Lights (3-step)
```
Rung 0: Sequence enable (Start/Stop seal-in on M0)
Rung 1: Light1 immediate     M0 → Y0
Rung 2: Timer T0             M0 → OUT T0 K30
Rung 3: Light2 after T0      T0 → Y1
Rung 4: Timer T1             T0 → OUT T1 K30
Rung 5: Light3 after T1      T1 → Y2
```

---

## Communication (MELSEC)

### CC-Link IE / CC-Link
- Q/iQ-R series: deterministic fieldbus for distributed I/O
- Configure in GX Works network parameters before programming logic

### SLMP / MC Protocol (Ethernet)
- Read/write devices from HMI/SCADA over TCP (port 5007 typical on iQ-R)
- Map external requests to D/W registers

### Modbus RTU/TCP (FX5U / iQ-R option modules)
- Use dedicated communication function blocks (RS, MODBUS instructions on FX)
- Verify module slot and parameter settings in hardware config

---

## PLCopen XML → GX Works Import

1. Generate XML via `PLCAutomation(Platform.MITSUBISHI).export_xml(...)`
2. Open GX Works3 → **Project** → **Import PLCopen XML File**
3. Map `%I0.0` / `%Q0.0` addresses to physical X/Y devices in device assignment
4. Compile → simulate in GX Simulator3 → download to CPU

**Address mapping note**: PLCopen uses `%I/%Q`; GX Works may require rebinding to X/Y after import.

---

## Working Examples

### 1. Motor Start/Stop (PLCopen)
**File**: `automation/samples/MotorControl_Universal.xml`
- Seal-in circuit, START/STOP/E-stop pattern
- Import into GX Works3

### 2. Unified API Demo
**File**: `automation/plc_automation/unified_interface.py` (`quick_mitsubishi()`)
- Creates project, adds motor logic, exports XML

### 3. Native .gx3 Generation (Planned)
**File**: `automation/plc_automation/create_sequential_mitsubishi_fx5u.py`
- OLE2 compound file writer
- LD program streams for FX5U

---

## Activation Rules

**Trigger Keywords**:
- Mitsubishi, MELSEC, FX5U, FX5UC, iQ-R, Q series, L series
- GX Works, GX Works2, GX Works3
- .gxw, .gx2, .gx3
- X/Y/M/T/C/D device addressing
- CC-Link, MC Protocol, SLMP

**Action Sequence**:
```
1. Read .claude/skills/mitsubishi.md (this file)
2. Confirm CPU family (FX vs Q/L vs iQ-R) and software (GX2 vs GX3)
3. Use PLCopen XML path via automation/plc_automation/
4. Document GX Works import and X/Y mapping steps
5. Flag safety logic for certified engineer review
```

---

## Mitsubishi Programming Checklist

- [ ] Confirm CPU model and I/O count (FX5U-32MT, R08CPU, etc.)
- [ ] Choose GX Works2 vs GX Works3
- [ ] Define device assignment (X/Y/M/T/C/D or labels on iQ-R)
- [ ] Include E-stop (hardware) and overload interlocks in logic
- [ ] Generate via PLCopen XML (preferred) or plan OLE2 native path
- [ ] Import and rebind addresses in GX Works
- [ ] Simulate with GX Simulator before download
- [ ] Document communication module config if used

---

## Repo Integration

| Component | Path |
|-----------|------|
| PLCopen generator | `automation/plc_automation/plcopen_xml.py` |
| Unified API | `automation/plc_automation/unified_interface.py` |
| Parser (stub) | `automation/plc_file_handler/parsers/mitsubishi_parser.py` |
| Cursor skill | `.cursor/skills/mitsubishi/SKILL.md` |
| Architecture plan | `docs/architecture/PHASE_4_PLATFORM_INTEGRATIONS.md` |

---

## Resources

- **MELSEC iQ-R Programming Manual**: Mitsubishi Electric technical library
- **FX5 Programming Manual**: FX5U/FX5UC instruction reference
- **GX Works3 Operating Manual**: Import/export and simulation
- **PLCopen TC6 XML**: https://plcopen.org/technical-activities/xml-exchange

---

## Version History

- **v1.0** (2025-06-14): Initial Mitsubishi MELSEC skill — PLCopen path + addressing reference

---

**PLCAutoPilot Mitsubishi Skill v1.0 | 2025-06-14 | github.com/prashiyn/plc-copilot**

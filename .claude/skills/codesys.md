# CODESYS V3 Universal PLC Programming Skill
## Expert Agent for 500+ IEC 61131-3 PLC Brands

---

## Overview

**Target Runtimes**: CODESYS Control Runtime V3 on 500+ OEM PLCs
**Software**: CODESYS Development System V3.5 SP17+ (vendor-specific variants exist)
**File Format**: `.project` (XML project), `.export` (portable export archive), `.app` (compiled application)
**Programming Languages**: LD, FBD, ST, SFC, IL (all IEC 61131-3)
**Standards**: IEC 61131-3, IEC 61508 (with CODESYS Safety optional)

**Coverage**: Schneider (select lines), ABB AC500, WAGO PFC, Festo, Eaton, IFM, Lenze, B&R (legacy migration), and hundreds of others — **always verify device profile for target hardware**

---

## CRITICAL: CODESYS vs Vendor-Native IDEs

### Why CODESYS Matters
- **One toolchain, many brands** — logic POUs transfer across runtimes when device profiles match
- **XML-native projects** — far easier to generate programmatically than TIA `.apXX` or Rockwell `.ACD`
- **PLCopen XML** is the standard interchange format CODESYS imports natively

### File Structure Comparison
| Platform | Format | Programmatic access |
|----------|--------|---------------------|
| CODESYS | `.project` XML | Direct XML edit / PLCopen import |
| Schneider M221 | `.smbp` single XML | Direct (see `schneider-m221` skill) |
| Siemens | `.apXX` proprietary | Requires Openness SDK |
| Rockwell | `.ACD` binary | Requires FactoryTalk SDK |
| Mitsubishi | `.gx3` OLE2 | Requires olefile / SDK |

### CODESYS Project Layout (`.project` — simplified)
```
MyProject.project (XML root)
├── Device (target PLC from device catalog)
├── PlcLogic/
│   ├── Application/
│   │   ├── POUs/          (Programs, FBs, Functions)
│   │   ├── GVLs/          (Global variable lists)
│   │   ├── DUTs/          (Data unit types / structs)
│   │   └── VISUs/         (optional HMI)
│   └── Task Configuration/
│       ├── MainTask
│       └── BusTask (fieldbus cyclic)
└── Libraries/             (vendor and standard libs)
```

---

## Addressing and Variables

### Direct addressing (IEC style in CODESYS)
```
Global variables with AT keyword:

VAR_GLOBAL
    Start_PB    AT %IX0.0 : BOOL;
    Stop_PB     AT %IX0.1 : BOOL;
    Motor_Run   AT %QX0.0 : BOOL;
    Run_Lamp    AT %QX0.1 : BOOL;
    Speed_SP    AT %MW100  : INT;
END_VAR
```

### Symbolic (recommended)
```
VAR_GLOBAL
    Start_PB  : BOOL;   (* mapped to I/O in device tree *)
    Stop_PB   : BOOL;
    Motor_Run : BOOL;
END_VAR

Map symbols to physical I/O in the **I/O Mapping** editor or GVL AT declarations.
```

### Memory areas (runtime-dependent)
| Prefix | Typical use |
|--------|-------------|
| %IX / %QX | Digital I/O |
| %IW / %QW | Analog I/O words |
| %MW | Memory words |
| %MD | Memory double words |

Exact limits depend on **device description** — never assume Schneider/Siemens limits.

---

## Timers and Counters (IEC 61131-3 in CODESYS)

### Standard function blocks (preferred over vendor-specific)
```
VAR
    Timer_1 : TON;      (* On-delay *)
    Timer_2 : TOF;      (* Off-delay *)
    Counter_1 : CTU;    (* Count up *)
END_VAR

Timer_1(IN := Motor_Run, PT := T#3S);
Light_2 := Timer_1.Q;

Counter_1(CU := Pulse_Input, RESET := Reset_Cnt, PV := 100);
Batch_Done := Counter_1.Q;
```

### Structured Text sequential pattern
```
IF Start_PB AND NOT Stop_PB THEN
    Sequence_Run := TRUE;
END_IF;

IF Stop_PB OR E_Stop THEN
    Sequence_Run := FALSE;
END_IF;

Light_1 := Sequence_Run;

Timer_1(IN := Sequence_Run, PT := T#3S);
Light_2 := Timer_1.Q;

Timer_2(IN := Timer_1.Q, PT := T#3S);
Light_3 := Timer_2.Q;
```

---

## MANDATORY Templates

### Primary Path (Recommended — PLCopen XML)
**Location**: `automation/plc_automation/unified_interface.py`

```python
from plc_automation import PLCAutomation, Platform

automation = PLCAutomation(Platform.CODESYS)
automation.create_project("MotorControl", "CODESYS Control Win V3")
automation.add_motor_startstop()
automation.export_xml("MotorControl_Codesys.xml")
# Import in CODESYS: File → Import → PLCopen XML
```

**Sample output**: `automation/samples/MotorControl_Universal.xml`

### Direct CODESYS `.project` Generation (Planned)
**Location**: `automation/plc_automation/create_codesys_project.py` (to be created)

```python
# Pattern: build minimal .project XML with Application + MainProgram POU
from xml.etree.ElementTree import Element, SubElement, tostring

def create_codesys_project(name: str, device: str) -> str:
    root = Element("Project")
    # Add Device, PlcLogic/Application/POUs/MAIN (program)
    # Add GVL for I/O symbols
    # Add TaskConfiguration with MainTask calling MAIN
    return tostring(root, encoding="unicode")
```

---

## Ladder Logic Patterns (CODESYS LD)

### Pattern 1: Seal-in Circuit
```
Network: Motor Control
  Start_PB (NO) ----+---- Stop_PB (NC) ---- Motor_Run (coil)
  Motor_Run (NO) ---+
```

### Pattern 2: TON Timer
```
Network: Delay
  Enable (NO) ---- TON (Timer_1, PT=T#3S) ---- Output (coil from Timer_1.Q)
```

### Pattern 3: Motor Start/Stop with E-stop
```
Network 0: E-stop interlock (E_Stop NC in series with all rungs)
Network 1: Seal-in on Motor_Run
Network 2: Motor_Run → contactor output
Network 3: Overload NC in series with seal-in branch
```

---

## Task Configuration

### Standard single-task setup
```
MainTask:
  Type: Cyclic
  Interval: 20ms (or match device default)
  Priority: 1
  POU calls: MAIN
```

### Fieldbus / motion tasks
```
BusTask:
  Type: Freewheeling or Cyclic (bus-synchronized)
  Calls: FieldbusHandler, MotionFB

SafetyTask (CODESYS Safety):
  Separate safety project — do NOT mix standard and safety POUs without certification
```

---

## Multi-Brand Deployment Workflow

1. **Select device profile** in CODESYS device catalog (e.g., WAGO 750-889, ABB AC500, Festo CPX)
2. **Generate logic** via PLCopen XML or ST/LD POUs
3. **Import** PLCopen XML → CODESYS maps POUs and variables
4. **Map I/O** in device tree to physical modules
5. **Add vendor libraries** if required (Modbus, CANopen, EtherCAT)
6. **Build** → download to runtime or generate `.app`
7. **Export** `.export` for customer handoff (portable archive)

### Brand examples (verify before use)
| Vendor | Example device | Notes |
|--------|----------------|-------|
| WAGO | PFC200 750-889 | Linux-based CODESYS runtime |
| ABB | AC500 PM564 | CODESYS V3 embedded |
| Festo | CPX-CEC | Motion + I/O |
| Eaton | XC-152 | Compact controller |
| IFM | CR711S | IO-Link master built-in |

---

## PLCopen XML Structure (Reference)

Namespace: `http://www.plcopen.org/xml/tc6_0201`

```xml
<project xmlns="http://www.plcopen.org/xml/tc6_0201">
  <fileHeader companyName="..." productName="..." creationDateTime="..."/>
  <contentHeader name="MotorControl"/>
  <types>
    <pous>
      <pou name="MainProgram" pouType="program">
        <interface><!-- localVars --></interface>
        <body><LD><!-- contacts, coils --></LD></body>
      </pou>
    </pous>
  </types>
  <instances>
    <configurations>
      <configuration name="Config0">
        <resource name="Res0">
          <task name="MainTask" interval="PT0.02S"/>
        </resource>
      </configuration>
    </configurations>
  </instances>
</project>
```

See `automation/samples/MotorControl_Universal.xml` for a working example.

---

## Working Examples

### 1. Motor Start/Stop (PLCopen)
**File**: `automation/samples/MotorControl_Universal.xml`

### 2. PLCopen Generator
**File**: `automation/plc_automation/plcopen_xml.py`
- `PLCopenXMLGenerator`, `PLCopenProject`, `PLCopenProgram`

### 3. Platform Converter
**File**: `automation/plc_file_handler/converters/platform_converter.py`
- Cross-platform conversion via intermediate representation

### 4. Native CODESYS Project (Planned)
**File**: `automation/plc_automation/create_codesys_sequential.py`

---

## Activation Rules

**Trigger Keywords**:
- CODESYS, CoDeSys, .project, .export
- WAGO, ABB AC500, Festo, Eaton, IFM (CODESYS-based)
- IEC 61131-3 universal, multi-brand PLC
- POU, GVL, DUT, device profile
- PLCopen XML import

**Action Sequence**:
```
1. Read .claude/skills/codesys.md (this file)
2. Confirm target device profile / runtime vendor
3. Generate via PLCopen XML (automation/plc_automation/) or ST/LD POUs
4. Document import, I/O mapping, and build/download steps
5. Flag safety POUs for certified engineer review
```

---

## CODESYS Programming Checklist

- [ ] Confirm target device is in CODESYS device catalog (or vendor plugin installed)
- [ ] Choose languages (LD for discrete, ST for math/PID, FBD for analog)
- [ ] Define GVL for all I/O symbols with meaningful names
- [ ] Configure MainTask interval and POU call order
- [ ] Add E-stop and safety interlocks (standard project — not safety-certified without Safety addon)
- [ ] Generate PLCopen XML or build `.project` XML
- [ ] Import, map I/O, compile without errors
- [ ] Test on CODESYS Control Win (soft PLC) before hardware download
- [ ] Export `.export` for deployment package

---

## Repo Integration

| Component | Path |
|-----------|------|
| PLCopen generator | `automation/plc_automation/plcopen_xml.py` |
| Unified API | `automation/plc_automation/unified_interface.py` (`Platform.CODESYS`) |
| File handler | `automation/plc_file_handler/` (CODESYS detection in `format_detector.py`) |
| Cursor skill | `.cursor/skills/codesys/SKILL.md` |
| Architecture plan | `docs/architecture/PHASE_4_PLATFORM_INTEGRATIONS.md` |

---

## Resources

- **CODESYS Online Help**: https://help.codesys.com/
- **PLCopen TC6 XML Exchange**: https://plcopen.org/technical-activities/xml-exchange
- **CODESYS Store (device packages)**: Vendor-specific device descriptions
- **IEC 61131-3**: Language and FB standard reference

---

## Version History

- **v1.0** (2025-06-14): Initial CODESYS universal skill — PLCopen path, project structure, multi-brand workflow

---

**PLCAutoPilot CODESYS Skill v1.0 | 2025-06-14 | github.com/prashiyn/plc-copilot**

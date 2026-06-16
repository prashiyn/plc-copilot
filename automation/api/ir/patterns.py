"""Deterministic pattern library — produces validated PlcProgram IR."""

from ..schemas.ir import (
    AndNode,
    CoilNode,
    ContactNode,
    FbCallNode,
    FbParamRef,
    Network,
    NotNode,
    OrNode,
    PatternName,
    PlcMeta,
    PlcProgram,
    PlcTarget,
    PlcVar,
    Pou,
    TimerNode,
)

PATTERN_CATALOG: dict[PatternName, dict[str, str | list[str]]] = {
    "motor_startstop": {
        "title": "Motor Start/Stop",
        "description": "Seal-in motor control with start, stop, motor output, and run indicator.",
        "vendors": ["schneider", "rockwell", "siemens", "mitsubishi", "codesys", "generic"],
    },
    "sequential_lights": {
        "title": "Sequential Lights",
        "description": "Start/stop latched sequence with timed light outputs.",
        "vendors": ["schneider", "rockwell"],
    },
    "estop_motor": {
        "title": "E-Stop Motor",
        "description": "Motor seal-in with normally-closed E-stop in series (fail-safe).",
        "vendors": ["schneider", "rockwell", "siemens", "mitsubishi", "codesys", "generic"],
    },
    "tank_level": {
        "title": "Tank Level Control",
        "description": "Single-tank fill pump with NC low/high level interlocks and manual override.",
        "vendors": ["schneider", "rockwell"],
    },
    "conveyor_startstop": {
        "title": "Conveyor Start/Stop",
        "description": "Conveyor run seal-in with start, stop, and run signal output.",
        "vendors": ["schneider", "rockwell", "siemens", "mitsubishi", "codesys", "generic"],
    },
    "traffic_lights": {
        "title": "Traffic Lights",
        "description": "Three-phase red/yellow/green sequence latched by start/stop.",
        "vendors": ["schneider", "rockwell"],
    },
    "motor_interlock": {
        "title": "Dual Motor Interlock",
        "description": "Two motors with mutual exclusion — only one may run at a time.",
        "vendors": ["schneider", "rockwell", "siemens", "mitsubishi", "codesys", "generic"],
    },
    "pump_staging": {
        "title": "Lead/Lag Pump Staging",
        "description": "Dual-pump tank fill with lead and lag pumps based on level sensors.",
        "vendors": ["schneider", "rockwell", "siemens", "mitsubishi", "codesys", "generic"],
    },
    "timed_motor": {
        "title": "Timed Motor Run",
        "description": "Motor seal-in with on-delay timer before energizing the output.",
        "vendors": ["schneider", "rockwell", "siemens", "mitsubishi", "codesys", "generic"],
    },
    "pid_loop": {
        "title": "PID Closed Loop",
        "description": "Analog PID control loop with enable, process variable, setpoint, and control variable.",
        "vendors": ["schneider", "rockwell", "siemens", "codesys", "generic"],
    },
}


def list_patterns() -> list[dict[str, object]]:
    return [
        {"id": pattern_id, **meta}
        for pattern_id, meta in PATTERN_CATALOG.items()
    ]


def build_pattern(
    pattern: PatternName,
    *,
    project_name: str,
    vendor: str,
    model: str,
    num_lights: int = 4,
    delay_seconds: int = 3,
    cycle_seconds: int = 5,
    run_seconds: int = 5,
    setpoint: float = 50.0,
) -> PlcProgram:
    if pattern == "motor_startstop":
        return _motor_startstop(project_name, vendor, model)
    if pattern == "sequential_lights":
        return _sequential_lights(project_name, vendor, model, num_lights, delay_seconds)
    if pattern == "estop_motor":
        return _estop_motor(project_name, vendor, model)
    if pattern == "tank_level":
        return _tank_level(project_name, vendor, model)
    if pattern == "conveyor_startstop":
        return _conveyor_startstop(project_name, vendor, model)
    if pattern == "traffic_lights":
        return _traffic_lights(project_name, vendor, model, cycle_seconds)
    if pattern == "motor_interlock":
        return _motor_interlock(project_name, vendor, model)
    if pattern == "pump_staging":
        return _pump_staging(project_name, vendor, model)
    if pattern == "timed_motor":
        return _timed_motor(project_name, vendor, model, run_seconds)
    if pattern == "pid_loop":
        return _pid_loop(project_name, vendor, model, setpoint)
    raise ValueError(f"Unknown pattern: {pattern}")


def _motor_startstop(project_name: str, vendor: str, model: str) -> PlcProgram:
    vars_ = [
        PlcVar(symbol="START_BTN", address="%I0.0", kind="input", comment="Start push button"),
        PlcVar(symbol="STOP_BTN", address="%I0.1", kind="input", comment="Stop push button"),
        PlcVar(symbol="MOTOR_RUN", address="%Q0.0", kind="output", comment="Motor contactor"),
        PlcVar(symbol="GREEN_LED", address="%Q0.1", kind="output", comment="Motor running indicator"),
    ]
    networks = [
        Network(
            label="Rung 1",
            comment="Motor start/stop control with latching",
            logic=AndNode(
                inputs=[
                    OrNode(inputs=[
                        ContactNode(symbol="START_BTN"),
                        ContactNode(symbol="MOTOR_RUN"),
                    ]),
                    NotNode(input=ContactNode(symbol="STOP_BTN")),
                    CoilNode(symbol="MOTOR_RUN"),
                ]
            ),
        ),
        Network(
            label="Rung 2",
            comment="Motor running indicator",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="MOTOR_RUN"),
                    CoilNode(symbol="GREEN_LED"),
                ]
            ),
        ),
    ]
    return PlcProgram(
        name=project_name,
        target=PlcTarget(vendor=vendor, model=model),  # type: ignore[arg-type]
        vars=vars_,
        pous=[Pou(name="MainProgram", networks=networks)],
        meta=PlcMeta(
            description="Motor start/stop with seal-in and run indicator",
            pattern="motor_startstop",
        ),
    )


def _sequential_lights(
    project_name: str,
    vendor: str,
    model: str,
    num_lights: int,
    delay_seconds: int,
) -> PlcProgram:
    num_lights = max(2, min(8, num_lights))
    vars_: list[PlcVar] = [
        PlcVar(symbol="START_BTN", address="%I0.0", kind="input", comment="Start button"),
        PlcVar(symbol="STOP_BTN", address="%I0.1", kind="input", comment="Stop button"),
        PlcVar(symbol="SEQ_RUN", address="%M0", kind="memory", comment="Sequence running flag"),
    ]
    for i in range(1, num_lights + 1):
        vars_.append(
            PlcVar(
                symbol=f"LIGHT{i}",
                address=f"%Q0.{i - 1}",
                kind="output",
                comment=f"Light {i} output",
            )
        )
    for i in range(num_lights - 1):
        vars_.append(
            PlcVar(
                symbol=f"TIMER_{i + 1}",
                address=f"%TM{i}",
                dataType="TON",
                kind="timer",
                comment=f"{delay_seconds}s delay before light {i + 2}",
            )
        )

    networks: list[Network] = [
        Network(
            label="Rung 1",
            comment="Sequence start/stop latch",
            logic=AndNode(
                inputs=[
                    OrNode(inputs=[
                        ContactNode(symbol="START_BTN"),
                        ContactNode(symbol="SEQ_RUN"),
                    ]),
                    NotNode(input=ContactNode(symbol="STOP_BTN")),
                    CoilNode(symbol="SEQ_RUN"),
                ]
            ),
        ),
        Network(
            label="Rung 2",
            comment="Light 1 immediate",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="SEQ_RUN"),
                    CoilNode(symbol="LIGHT1"),
                ]
            ),
        ),
    ]

    for i in range(2, num_lights + 1):
        prev = "SEQ_RUN" if i == 2 else f"LIGHT{i - 1}"
        networks.append(
            Network(
                label=f"Rung {i + 1}",
                comment=f"Light {i} step",
                logic=AndNode(
                    inputs=[
                        ContactNode(symbol=prev),
                        CoilNode(symbol=f"LIGHT{i}"),
                    ]
                ),
            )
        )

    return PlcProgram(
        name=project_name,
        target=PlcTarget(vendor=vendor, model=model),  # type: ignore[arg-type]
        vars=vars_,
        pous=[Pou(name="MainProgram", networks=networks)],
        meta=PlcMeta(
            description=f"{num_lights}-light sequential sequence",
            pattern="sequential_lights",
            patternParams={"numLights": num_lights, "delaySeconds": delay_seconds},
        ),
    )


def _estop_motor(project_name: str, vendor: str, model: str) -> PlcProgram:
    vars_ = [
        PlcVar(symbol="START_BTN", address="%I0.0", kind="input", comment="Start push button"),
        PlcVar(symbol="STOP_BTN", address="%I0.1", kind="input", comment="Stop push button"),
        PlcVar(symbol="ESTOP_BTN", address="%I0.2", kind="input", comment="Emergency stop (NC)"),
        PlcVar(symbol="MOTOR_RUN", address="%Q0.0", kind="output", comment="Motor contactor"),
        PlcVar(symbol="GREEN_LED", address="%Q0.1", kind="output", comment="Motor running indicator"),
    ]
    networks = [
        Network(
            label="Rung 1",
            comment="Motor start/stop with E-stop NC in series",
            logic=AndNode(
                inputs=[
                    OrNode(inputs=[
                        ContactNode(symbol="START_BTN"),
                        ContactNode(symbol="MOTOR_RUN"),
                    ]),
                    NotNode(input=ContactNode(symbol="STOP_BTN")),
                    NotNode(input=ContactNode(symbol="ESTOP_BTN")),
                    CoilNode(symbol="MOTOR_RUN"),
                ]
            ),
        ),
        Network(
            label="Rung 2",
            comment="Motor running indicator",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="MOTOR_RUN"),
                    CoilNode(symbol="GREEN_LED"),
                ]
            ),
        ),
    ]
    return PlcProgram(
        name=project_name,
        target=PlcTarget(vendor=vendor, model=model),  # type: ignore[arg-type]
        vars=vars_,
        pous=[Pou(name="MainProgram", networks=networks)],
        meta=PlcMeta(
            description="Motor start/stop with E-stop NC interlock and run indicator",
            pattern="estop_motor",
            requireEstop=True,
        ),
    )


def _tank_level(project_name: str, vendor: str, model: str) -> PlcProgram:
    vars_ = [
        PlcVar(symbol="AUTO_MODE", address="%I0.0", kind="input", comment="Auto mode enable"),
        PlcVar(symbol="TANK_LOW", address="%I0.1", kind="input", comment="Low level sensor (NC)"),
        PlcVar(symbol="MANUAL_PUMP", address="%I0.2", kind="input", comment="Manual pump start"),
        PlcVar(symbol="TANK_HIGH", address="%I0.3", kind="input", comment="High level sensor (NC)"),
        PlcVar(symbol="AUTO_ACTIVE", address="%M0", kind="memory", comment="Auto mode active"),
        PlcVar(symbol="PUMP_RUN", address="%M1", kind="memory", comment="Pump run with seal-in"),
        PlcVar(symbol="PUMP_OUTPUT", address="%Q0.0", kind="output", comment="Pump contactor"),
    ]
    networks = [
        Network(
            label="Rung 1",
            comment="Auto mode latch",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="AUTO_MODE"),
                    CoilNode(symbol="AUTO_ACTIVE"),
                ]
            ),
        ),
        Network(
            label="Rung 2",
            comment="Pump control with low/high NC interlocks",
            logic=AndNode(
                inputs=[
                    OrNode(
                        inputs=[
                            AndNode(
                                inputs=[
                                    ContactNode(symbol="AUTO_ACTIVE"),
                                    NotNode(input=ContactNode(symbol="TANK_LOW")),
                                ]
                            ),
                            ContactNode(symbol="MANUAL_PUMP"),
                            ContactNode(symbol="PUMP_RUN"),
                        ]
                    ),
                    NotNode(input=ContactNode(symbol="TANK_HIGH")),
                    CoilNode(symbol="PUMP_RUN"),
                ]
            ),
        ),
        Network(
            label="Rung 3",
            comment="Pump output",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="PUMP_RUN"),
                    CoilNode(symbol="PUMP_OUTPUT"),
                ]
            ),
        ),
    ]
    return PlcProgram(
        name=project_name,
        target=PlcTarget(vendor=vendor, model=model),  # type: ignore[arg-type]
        vars=vars_,
        pous=[Pou(name="MainProgram", networks=networks)],
        meta=PlcMeta(
            description="Single-tank pump with NC low/high level interlocks",
            pattern="tank_level",
        ),
    )


def _conveyor_startstop(project_name: str, vendor: str, model: str) -> PlcProgram:
    vars_ = [
        PlcVar(symbol="START_BTN", address="%I0.0", kind="input", comment="Start push button"),
        PlcVar(symbol="STOP_BTN", address="%I0.1", kind="input", comment="Stop push button"),
        PlcVar(symbol="CONVEYOR_RUN", address="%Q0.0", kind="output", comment="Conveyor motor"),
        PlcVar(symbol="RUN_SIGNAL", address="%Q0.1", kind="output", comment="Conveyor running signal"),
    ]
    networks = [
        Network(
            label="Rung 1",
            comment="Conveyor start/stop with seal-in",
            logic=AndNode(
                inputs=[
                    OrNode(inputs=[
                        ContactNode(symbol="START_BTN"),
                        ContactNode(symbol="CONVEYOR_RUN"),
                    ]),
                    NotNode(input=ContactNode(symbol="STOP_BTN")),
                    CoilNode(symbol="CONVEYOR_RUN"),
                ]
            ),
        ),
        Network(
            label="Rung 2",
            comment="Run signal output",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="CONVEYOR_RUN"),
                    CoilNode(symbol="RUN_SIGNAL"),
                ]
            ),
        ),
    ]
    return PlcProgram(
        name=project_name,
        target=PlcTarget(vendor=vendor, model=model),  # type: ignore[arg-type]
        vars=vars_,
        pous=[Pou(name="MainProgram", networks=networks)],
        meta=PlcMeta(
            description="Conveyor start/stop with seal-in and run signal",
            pattern="conveyor_startstop",
        ),
    )


def _traffic_lights(project_name: str, vendor: str, model: str, cycle_seconds: int) -> PlcProgram:
    cycle_seconds = max(1, min(60, cycle_seconds))
    vars_ = [
        PlcVar(symbol="START_BTN", address="%I0.0", kind="input", comment="Start button"),
        PlcVar(symbol="STOP_BTN", address="%I0.1", kind="input", comment="Stop button"),
        PlcVar(symbol="SEQ_RUN", address="%M0", kind="memory", comment="Sequence running flag"),
        PlcVar(symbol="RED_LIGHT", address="%Q0.0", kind="output", comment="Red signal"),
        PlcVar(symbol="YELLOW_LIGHT", address="%Q0.1", kind="output", comment="Yellow signal"),
        PlcVar(symbol="GREEN_LIGHT", address="%Q0.2", kind="output", comment="Green signal"),
    ]
    networks: list[Network] = [
        Network(
            label="Rung 1",
            comment="Sequence start/stop latch",
            logic=AndNode(
                inputs=[
                    OrNode(inputs=[
                        ContactNode(symbol="START_BTN"),
                        ContactNode(symbol="SEQ_RUN"),
                    ]),
                    NotNode(input=ContactNode(symbol="STOP_BTN")),
                    CoilNode(symbol="SEQ_RUN"),
                ]
            ),
        ),
        Network(
            label="Rung 2",
            comment="Red phase (initial)",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="SEQ_RUN"),
                    CoilNode(symbol="RED_LIGHT"),
                ]
            ),
        ),
        Network(
            label="Rung 3",
            comment="Yellow follows red",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="SEQ_RUN"),
                    ContactNode(symbol="RED_LIGHT"),
                    CoilNode(symbol="YELLOW_LIGHT"),
                ]
            ),
        ),
        Network(
            label="Rung 4",
            comment="Green follows yellow",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="SEQ_RUN"),
                    ContactNode(symbol="YELLOW_LIGHT"),
                    CoilNode(symbol="GREEN_LIGHT"),
                ]
            ),
        ),
    ]
    return PlcProgram(
        name=project_name,
        target=PlcTarget(vendor=vendor, model=model),  # type: ignore[arg-type]
        vars=vars_,
        pous=[Pou(name="MainProgram", networks=networks)],
        meta=PlcMeta(
            description="Red/yellow/green traffic light sequence",
            pattern="traffic_lights",
            patternParams={"cycleSeconds": cycle_seconds},
        ),
    )


def _motor_interlock(project_name: str, vendor: str, model: str) -> PlcProgram:
    vars_ = [
        PlcVar(symbol="START_A", address="%I0.0", kind="input", comment="Start motor A"),
        PlcVar(symbol="STOP_A", address="%I0.1", kind="input", comment="Stop motor A"),
        PlcVar(symbol="START_B", address="%I0.2", kind="input", comment="Start motor B"),
        PlcVar(symbol="STOP_B", address="%I0.3", kind="input", comment="Stop motor B"),
        PlcVar(symbol="MOTOR_A_MEM", address="%M0", kind="memory", comment="Motor A seal-in"),
        PlcVar(symbol="MOTOR_B_MEM", address="%M1", kind="memory", comment="Motor B seal-in"),
        PlcVar(symbol="MOTOR_A_RUN", address="%Q0.0", kind="output", comment="Motor A contactor"),
        PlcVar(symbol="MOTOR_B_RUN", address="%Q0.1", kind="output", comment="Motor B contactor"),
    ]
    networks = [
        Network(
            label="Rung 1",
            comment="Motor A seal-in with motor B interlock",
            logic=AndNode(
                inputs=[
                    OrNode(inputs=[
                        ContactNode(symbol="START_A"),
                        ContactNode(symbol="MOTOR_A_MEM"),
                    ]),
                    NotNode(input=ContactNode(symbol="STOP_A")),
                    NotNode(input=ContactNode(symbol="MOTOR_B_MEM")),
                    CoilNode(symbol="MOTOR_A_MEM"),
                ]
            ),
        ),
        Network(
            label="Rung 2",
            comment="Motor A output",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="MOTOR_A_MEM"),
                    CoilNode(symbol="MOTOR_A_RUN"),
                ]
            ),
        ),
        Network(
            label="Rung 3",
            comment="Motor B seal-in with motor A interlock",
            logic=AndNode(
                inputs=[
                    OrNode(inputs=[
                        ContactNode(symbol="START_B"),
                        ContactNode(symbol="MOTOR_B_MEM"),
                    ]),
                    NotNode(input=ContactNode(symbol="STOP_B")),
                    NotNode(input=ContactNode(symbol="MOTOR_A_MEM")),
                    CoilNode(symbol="MOTOR_B_MEM"),
                ]
            ),
        ),
        Network(
            label="Rung 4",
            comment="Motor B output",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="MOTOR_B_MEM"),
                    CoilNode(symbol="MOTOR_B_RUN"),
                ]
            ),
        ),
    ]
    return PlcProgram(
        name=project_name,
        target=PlcTarget(vendor=vendor, model=model),  # type: ignore[arg-type]
        vars=vars_,
        pous=[Pou(name="MainProgram", networks=networks)],
        meta=PlcMeta(
            description="Dual motor control with mutual exclusion interlock",
            pattern="motor_interlock",
        ),
    )


def _pump_staging(project_name: str, vendor: str, model: str) -> PlcProgram:
    vars_ = [
        PlcVar(symbol="AUTO_MODE", address="%I0.0", kind="input", comment="Auto mode enable"),
        PlcVar(symbol="TANK_LOW", address="%I0.1", kind="input", comment="Low level sensor (NC)"),
        PlcVar(symbol="TANK_HIGH", address="%I0.2", kind="input", comment="High level sensor (NC)"),
        PlcVar(symbol="LEAD_RUN", address="%M0", kind="memory", comment="Lead pump seal-in"),
        PlcVar(symbol="LAG_RUN", address="%M1", kind="memory", comment="Lag pump run flag"),
        PlcVar(symbol="PUMP_LEAD", address="%Q0.0", kind="output", comment="Lead pump contactor"),
        PlcVar(symbol="PUMP_LAG", address="%Q0.1", kind="output", comment="Lag pump contactor"),
    ]
    networks = [
        Network(
            label="Rung 1",
            comment="Lead pump seal-in when auto and tank needs fill",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="AUTO_MODE"),
                    NotNode(input=ContactNode(symbol="TANK_HIGH")),
                    OrNode(
                        inputs=[
                            NotNode(input=ContactNode(symbol="TANK_LOW")),
                            ContactNode(symbol="LEAD_RUN"),
                        ]
                    ),
                    CoilNode(symbol="LEAD_RUN"),
                ]
            ),
        ),
        Network(
            label="Rung 2",
            comment="Lead pump output",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="LEAD_RUN"),
                    CoilNode(symbol="PUMP_LEAD"),
                ]
            ),
        ),
        Network(
            label="Rung 3",
            comment="Lag pump when lead is on and tank still low",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="LEAD_RUN"),
                    NotNode(input=ContactNode(symbol="TANK_LOW")),
                    NotNode(input=ContactNode(symbol="TANK_HIGH")),
                    CoilNode(symbol="LAG_RUN"),
                ]
            ),
        ),
        Network(
            label="Rung 4",
            comment="Lag pump output",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="LAG_RUN"),
                    CoilNode(symbol="PUMP_LAG"),
                ]
            ),
        ),
    ]
    return PlcProgram(
        name=project_name,
        target=PlcTarget(vendor=vendor, model=model),  # type: ignore[arg-type]
        vars=vars_,
        pous=[Pou(name="MainProgram", networks=networks)],
        meta=PlcMeta(
            description="Lead/lag pump staging for tank fill control",
            pattern="pump_staging",
        ),
    )


def _timed_motor(project_name: str, vendor: str, model: str, run_seconds: int) -> PlcProgram:
    run_seconds = max(1, min(60, run_seconds))
    preset_ms = run_seconds * 1000
    vars_ = [
        PlcVar(symbol="START_BTN", address="%I0.0", kind="input", comment="Start push button"),
        PlcVar(symbol="STOP_BTN", address="%I0.1", kind="input", comment="Stop push button"),
        PlcVar(
            symbol="RUN_TIMER",
            address="%TM0",
            dataType="TON",
            kind="timer",
            comment=f"{run_seconds}s on-delay before motor output",
        ),
        PlcVar(symbol="MOTOR_RUN", address="%M0", kind="memory", comment="Motor run seal-in"),
        PlcVar(symbol="MOTOR_OUTPUT", address="%Q0.0", kind="output", comment="Motor contactor"),
    ]
    networks = [
        Network(
            label="Rung 1",
            comment="Motor run latch",
            logic=AndNode(
                inputs=[
                    OrNode(inputs=[
                        ContactNode(symbol="START_BTN"),
                        ContactNode(symbol="MOTOR_RUN"),
                    ]),
                    NotNode(input=ContactNode(symbol="STOP_BTN")),
                    CoilNode(symbol="MOTOR_RUN"),
                ]
            ),
        ),
        Network(
            label="Rung 2",
            comment="On-delay timer gates motor output",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="MOTOR_RUN"),
                    TimerNode(symbol="RUN_TIMER", timerType="TON", presetMs=preset_ms),
                    CoilNode(symbol="MOTOR_OUTPUT"),
                ]
            ),
        ),
    ]
    return PlcProgram(
        name=project_name,
        target=PlcTarget(vendor=vendor, model=model),  # type: ignore[arg-type]
        vars=vars_,
        pous=[Pou(name="MainProgram", networks=networks)],
        meta=PlcMeta(
            description=f"Motor start/stop with {run_seconds}s on-delay timer before output",
            pattern="timed_motor",
            patternParams={"runSeconds": run_seconds},
        ),
    )


def _pid_loop(project_name: str, vendor: str, model: str, setpoint: float) -> PlcProgram:
    setpoint = max(0.0, min(1000.0, float(setpoint)))
    vars_ = [
        PlcVar(
            symbol="LOOP_EN",
            address="%I0.0",
            kind="input",
            dataType="BOOL",
            comment="PID loop enable",
        ),
        PlcVar(
            symbol="TEMP_PV",
            address="%IW0",
            kind="input",
            dataType="REAL",
            comment="Process variable (PV)",
        ),
        PlcVar(
            symbol="TEMP_SP",
            address="%MW0",
            kind="memory",
            dataType="REAL",
            initial=str(setpoint),
            comment="Setpoint (SP)",
        ),
        PlcVar(
            symbol="VALVE_CV",
            address="%QW0",
            kind="output",
            dataType="REAL",
            comment="Control variable (CV)",
        ),
        PlcVar(
            symbol="PID1",
            address="%MW10",
            kind="memory",
            dataType="REAL",
            comment="PID function block instance data",
        ),
        PlcVar(
            symbol="LOOP_ACTIVE",
            address="%M0.0",
            kind="memory",
            dataType="BOOL",
            comment="Loop active indicator",
        ),
    ]
    networks = [
        Network(
            label="Rung 1",
            comment="PID closed-loop control",
            logic=FbCallNode(
                kind="PID",
                instance="PID1",
                enable="LOOP_EN",
                params=[
                    FbParamRef(name="PV", symbol="TEMP_PV", direction="in"),
                    FbParamRef(name="SP", symbol="TEMP_SP", direction="in"),
                    FbParamRef(name="CV", symbol="VALVE_CV", direction="out"),
                ],
            ),
        ),
        Network(
            label="Rung 2",
            comment="Loop active indicator",
            logic=AndNode(
                inputs=[
                    ContactNode(symbol="LOOP_EN"),
                    CoilNode(symbol="LOOP_ACTIVE"),
                ]
            ),
        ),
    ]
    return PlcProgram(
        name=project_name,
        target=PlcTarget(vendor=vendor, model=model),  # type: ignore[arg-type]
        vars=vars_,
        pous=[Pou(name="MainProgram", networks=networks)],
        meta=PlcMeta(
            description=f"PID closed-loop control with setpoint {setpoint}",
            pattern="pid_loop",
            patternParams={"setpoint": setpoint},
        ),
    )

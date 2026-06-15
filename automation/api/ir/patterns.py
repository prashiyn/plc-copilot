"""Deterministic pattern library — produces validated PlcProgram IR."""

from ..schemas.ir import (
    AndNode,
    CoilNode,
    ContactNode,
    Network,
    NotNode,
    OrNode,
    PatternName,
    PlcMeta,
    PlcProgram,
    PlcTarget,
    PlcVar,
    Pou,
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

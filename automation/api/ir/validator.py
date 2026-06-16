import re

from pydantic import ValidationError

from ..schemas.ir import (
    AndNode,
    CoilNode,
    CompareNode,
    ContactNode,
    CounterNode,
    FbCallNode,
    LogicNode,
    NotNode,
    OrNode,
    PlcProgram,
    PlcVar,
    TimerNode,
)

ADDRESS_PATTERN = re.compile(r"^%(?:I|Q|M|TM|T|C|IW|QW|MW)[0-9]+(\.[0-9]+)?$")

TIMER_DATA_TYPES = frozenset({"TON", "TOF", "TP"})
COUNTER_DATA_TYPES = frozenset({"CTU", "CTD", "CTUD"})
ANALOG_DATA_TYPES = frozenset({"INT", "DINT", "REAL"})
BOOL_DATA_TYPES = frozenset({"BOOL"})
ESTOP_SYMBOLS = frozenset({"ESTOP_BTN", "E_STOP", "EMERGENCY_STOP"})
MOTOR_LIKE_PATTERNS = frozenset({"motor_startstop", "estop_motor", "conveyor_startstop"})
EXPORT_PATTERNS = frozenset(
    {
        "motor_startstop",
        "sequential_lights",
        "estop_motor",
        "tank_level",
        "conveyor_startstop",
        "traffic_lights",
        "motor_interlock",
        "pump_staging",
        "timed_motor",
        "pid_loop",
    }
)


class IrValidationError(ValueError):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


def validate_program(program: PlcProgram | dict) -> PlcProgram:
    """Parse and validate a PlcProgram, returning normalized model or raising IrValidationError."""
    errors: list[str] = []
    try:
        model = program if isinstance(program, PlcProgram) else PlcProgram.model_validate(program)
    except ValidationError as exc:
        raise IrValidationError([f"Schema: {err['msg']}" for err in exc.errors()]) from exc

    symbols = [var.symbol for var in model.vars]
    if len(symbols) != len(set(symbols)):
        errors.append("Duplicate variable symbols detected")

    addresses = [var.address for var in model.vars if var.address]
    if len(addresses) != len(set(addresses)):
        errors.append("Duplicate variable addresses detected")

    var_by_symbol = {var.symbol: var for var in model.vars}
    defined = set(symbols)

    for var in model.vars:
        if var.address and not ADDRESS_PATTERN.match(var.address):
            errors.append(f"Invalid address format for {var.symbol}: {var.address}")
        errors.extend(_validate_var_kind_datatype(var))

    for pou in model.pous:
        for network in pou.networks:
            for symbol in collect_logic_symbols(network.logic):
                if symbol not in defined:
                    errors.append(f"Undefined symbol referenced in logic: {symbol}")
            errors.extend(_validate_logic_nodes(network.logic, var_by_symbol))

    if model.meta.pattern == "motor_startstop":
        required = {"START_BTN", "STOP_BTN", "MOTOR_RUN"}
        missing = required - defined
        if missing:
            errors.append(f"Motor start/stop pattern missing symbols: {', '.join(sorted(missing))}")

    if model.meta.pattern == "estop_motor":
        required = {"START_BTN", "STOP_BTN", "ESTOP_BTN", "MOTOR_RUN"}
        missing = required - defined
        if missing:
            errors.append(f"E-stop motor pattern missing symbols: {', '.join(sorted(missing))}")
        if not model.meta.requireEstop:
            errors.append("estop_motor pattern requires meta.requireEstop = true")

    if model.meta.pattern == "tank_level":
        required = {"AUTO_MODE", "TANK_LOW", "TANK_HIGH", "PUMP_RUN", "PUMP_OUTPUT"}
        missing = required - defined
        if missing:
            errors.append(f"Tank level pattern missing symbols: {', '.join(sorted(missing))}")

    if model.meta.pattern == "conveyor_startstop":
        required = {"START_BTN", "STOP_BTN", "CONVEYOR_RUN", "RUN_SIGNAL"}
        missing = required - defined
        if missing:
            errors.append(f"Conveyor start/stop pattern missing symbols: {', '.join(sorted(missing))}")

    if model.meta.pattern == "traffic_lights":
        required = {"START_BTN", "STOP_BTN", "SEQ_RUN", "RED_LIGHT", "YELLOW_LIGHT", "GREEN_LIGHT"}
        missing = required - defined
        if missing:
            errors.append(f"Traffic lights pattern missing symbols: {', '.join(sorted(missing))}")

    if model.meta.pattern == "motor_interlock":
        required = {
            "START_A",
            "STOP_A",
            "MOTOR_A_RUN",
            "START_B",
            "STOP_B",
            "MOTOR_B_RUN",
            "MOTOR_A_MEM",
            "MOTOR_B_MEM",
        }
        missing = required - defined
        if missing:
            errors.append(f"Motor interlock pattern missing symbols: {', '.join(sorted(missing))}")

    if model.meta.pattern == "pump_staging":
        required = {
            "AUTO_MODE",
            "TANK_LOW",
            "TANK_HIGH",
            "LEAD_RUN",
            "LAG_RUN",
            "PUMP_LEAD",
            "PUMP_LAG",
        }
        missing = required - defined
        if missing:
            errors.append(f"Pump staging pattern missing symbols: {', '.join(sorted(missing))}")

    if model.meta.pattern == "timed_motor":
        required = {"START_BTN", "STOP_BTN", "MOTOR_RUN", "RUN_TIMER", "MOTOR_OUTPUT"}
        missing = required - defined
        if missing:
            errors.append(f"Timed motor pattern missing symbols: {', '.join(sorted(missing))}")
        timer_var = var_by_symbol.get("RUN_TIMER")
        if timer_var is None or timer_var.kind != "timer":
            errors.append("timed_motor pattern requires RUN_TIMER timer variable")

    if model.meta.pattern == "pid_loop":
        required = {"LOOP_EN", "TEMP_PV", "TEMP_SP", "VALVE_CV", "PID1"}
        missing = required - defined
        if missing:
            errors.append(f"PID loop pattern missing symbols: {', '.join(sorted(missing))}")
        pv_var = var_by_symbol.get("TEMP_PV")
        sp_var = var_by_symbol.get("TEMP_SP")
        cv_var = var_by_symbol.get("VALVE_CV")
        for label, var in (("TEMP_PV", pv_var), ("TEMP_SP", sp_var), ("VALVE_CV", cv_var)):
            if var is not None and var.dataType not in ANALOG_DATA_TYPES:
                errors.append(f"PID loop {label} must be analog REAL/INT/DINT (got {var.dataType})")
        has_pid_fb = any(
            isinstance(network.logic, FbCallNode) and network.logic.kind == "PID"
            for pou in model.pous
            for network in pou.networks
        )
        if not has_pid_fb:
            errors.append("pid_loop pattern requires a PID FbCallNode in ladder logic")

    if model.meta.requireEstop:
        errors.extend(_validate_estop_requirements(model))

    if errors:
        raise IrValidationError(errors)
    return model


def _validate_var_kind_datatype(var: PlcVar) -> list[str]:
    errors: list[str] = []
    if var.kind == "timer" and var.dataType not in TIMER_DATA_TYPES:
        errors.append(
            f"Timer variable {var.symbol} must use dataType TON, TOF, or TP (got {var.dataType})"
        )
    if var.kind == "counter" and var.dataType not in COUNTER_DATA_TYPES:
        errors.append(
            f"Counter variable {var.symbol} must use dataType CTU, CTD, or CTUD (got {var.dataType})"
        )
    if var.dataType in TIMER_DATA_TYPES and var.kind != "timer":
        errors.append(f"Variable {var.symbol} with dataType {var.dataType} must have kind timer")
    if var.dataType in COUNTER_DATA_TYPES and var.kind != "counter":
        errors.append(f"Variable {var.symbol} with dataType {var.dataType} must have kind counter")
    if var.kind in {"input", "output", "memory"} and var.dataType in TIMER_DATA_TYPES | COUNTER_DATA_TYPES:
        errors.append(
            f"Variable {var.symbol} with kind {var.kind} cannot use timer/counter dataType {var.dataType}"
        )
    return errors


def _validate_logic_nodes(node: LogicNode, var_by_symbol: dict[str, PlcVar]) -> list[str]:
    errors: list[str] = []
    if isinstance(node, TimerNode):
        var = var_by_symbol.get(node.symbol)
        if var is None:
            return [f"Timer node references undefined symbol: {node.symbol}"]
        if var.kind != "timer":
            errors.append(f"Timer node {node.symbol} must reference a timer variable (kind timer)")
        if var.dataType != node.timerType:
            errors.append(
                f"Timer node {node.symbol} timerType {node.timerType} "
                f"does not match variable dataType {var.dataType}"
            )
        return errors
    if isinstance(node, CounterNode):
        var = var_by_symbol.get(node.symbol)
        if var is None:
            return [f"Counter node references undefined symbol: {node.symbol}"]
        if var.kind != "counter":
            errors.append(f"Counter node {node.symbol} must reference a counter variable (kind counter)")
        if var.dataType != node.counterType:
            errors.append(
                f"Counter node {node.symbol} counterType {node.counterType} "
                f"does not match variable dataType {var.dataType}"
            )
        return errors
    if isinstance(node, CompareNode):
        for label, symbol in (("left", node.left), ("right", node.right), ("output", node.output)):
            var = var_by_symbol.get(symbol)
            if var is None:
                errors.append(f"Compare node {label} references undefined symbol: {symbol}")
                continue
            if label == "output":
                if var.dataType not in BOOL_DATA_TYPES:
                    errors.append(
                        f"Compare node output {symbol} must be BOOL (got {var.dataType})"
                    )
            elif var.dataType not in ANALOG_DATA_TYPES:
                errors.append(
                    f"Compare node {label} {symbol} must be analog INT/DINT/REAL (got {var.dataType})"
                )
        left_var = var_by_symbol.get(node.left)
        right_var = var_by_symbol.get(node.right)
        if (
            left_var is not None
            and right_var is not None
            and left_var.dataType != right_var.dataType
        ):
            errors.append(
                f"Compare operands {node.left} ({left_var.dataType}) and "
                f"{node.right} ({right_var.dataType}) must share the same dataType"
            )
        return errors
    if isinstance(node, FbCallNode):
        instance_var = var_by_symbol.get(node.instance)
        if instance_var is None:
            errors.append(f"FB call references undefined instance symbol: {node.instance}")
        elif instance_var.kind != "memory":
            errors.append(f"FB instance {node.instance} must be kind memory")
        if node.enable:
            enable_var = var_by_symbol.get(node.enable)
            if enable_var is None:
                errors.append(f"FB call enable references undefined symbol: {node.enable}")
            elif enable_var.dataType not in BOOL_DATA_TYPES:
                errors.append(f"FB call enable {node.enable} must be BOOL")
        for param in node.params:
            param_var = var_by_symbol.get(param.symbol)
            if param_var is None:
                errors.append(f"FB param {param.name} references undefined symbol: {param.symbol}")
            elif node.kind == "PID" and param.name in {"PV", "SP", "CV"}:
                if param_var.dataType not in ANALOG_DATA_TYPES:
                    errors.append(
                        f"PID param {param.name} ({param.symbol}) must be analog "
                        f"(got {param_var.dataType})"
                    )
        return errors
    if isinstance(node, AndNode):
        for child in node.inputs:
            errors.extend(_validate_logic_nodes(child, var_by_symbol))
    elif isinstance(node, OrNode):
        for child in node.inputs:
            errors.extend(_validate_logic_nodes(child, var_by_symbol))
    elif isinstance(node, NotNode):
        errors.extend(_validate_logic_nodes(node.input, var_by_symbol))
    return errors


def _validate_estop_requirements(model: PlcProgram) -> list[str]:
    errors: list[str] = []
    defined = {var.symbol for var in model.vars}
    estop_defined = defined & ESTOP_SYMBOLS
    if not estop_defined:
        return [
            "requireEstop is set but no E-stop symbol defined "
            f"(expected one of: {', '.join(sorted(ESTOP_SYMBOLS))})"
        ]

    estop_in_nc_contact = False
    for pou in model.pous:
        for network in pou.networks:
            if _logic_has_nc_contact(network.logic, estop_defined):
                estop_in_nc_contact = True
                break
        if estop_in_nc_contact:
            break

    if not estop_in_nc_contact:
        errors.append(
            "requireEstop is set but no E-stop symbol appears as a normally-closed "
            "(negated contact or NOT contact) input in ladder logic"
        )
    return errors


def _logic_has_nc_contact(node: LogicNode, symbols: set[str]) -> bool:
    if isinstance(node, ContactNode):
        return node.symbol in symbols and node.negated
    if isinstance(node, NotNode) and isinstance(node.input, ContactNode):
        return node.input.symbol in symbols and not node.input.negated
    if isinstance(node, AndNode):
        return any(_logic_has_nc_contact(child, symbols) for child in node.inputs)
    if isinstance(node, OrNode):
        return any(_logic_has_nc_contact(child, symbols) for child in node.inputs)
    return False


def collect_logic_symbols(node: LogicNode) -> set[str]:
    if isinstance(node, ContactNode):
        return {node.symbol}
    if isinstance(node, CoilNode):
        return {node.symbol}
    if isinstance(node, TimerNode):
        return {node.symbol}
    if isinstance(node, CounterNode):
        return {node.symbol}
    if isinstance(node, CompareNode):
        return {node.left, node.right, node.output}
    if isinstance(node, FbCallNode):
        symbols = {node.instance, *(p.symbol for p in node.params)}
        if node.enable:
            symbols.add(node.enable)
        return symbols
    if isinstance(node, AndNode):
        result: set[str] = set()
        for child in node.inputs:
            result |= collect_logic_symbols(child)
        return result
    if isinstance(node, OrNode):
        result = set()
        for child in node.inputs:
            result |= collect_logic_symbols(child)
        return result
    if isinstance(node, NotNode):
        return collect_logic_symbols(node.input)
    return set()


def program_summary(program: PlcProgram) -> dict[str, int | str | None | bool]:
    return {
        "name": program.name,
        "vendor": program.target.vendor,
        "model": program.target.model,
        "pattern": program.meta.pattern,
        "requireEstop": program.meta.requireEstop,
        "varCount": len(program.vars),
        "networkCount": sum(len(pou.networks) for pou in program.pous),
    }

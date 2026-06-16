"""Siemens SCL export from PlcProgram IR (Tier-2 source import)."""

from __future__ import annotations

from plc_file_handler.converters.platform_converter import PlatformConverter

from ...schemas.ir import (
    AndNode,
    CoilNode,
    CompareNode,
    ContactNode,
    CounterNode,
    FbCallNode,
    LogicNode,
    Network,
    NotNode,
    OrNode,
    PlcProgram,
    PlcVar,
    TimerNode,
)
from .analog_fb import render_pid_fb_statement

_SOURCE_DISCLAIMER = (
    "PLC AutoPilot export — source import only, not a TIA Portal project (.ap* / .zap*)."
)

_SCL_TYPE_MAP = {
    "BOOL": "Bool",
    "INT": "Int",
    "DINT": "DInt",
    "REAL": "Real",
    "TIME": "Time",
    "TON": "Time",
    "TOF": "Time",
    "TP": "Time",
    "CTU": "Int",
    "CTD": "Int",
    "CTUD": "Int",
}


def render_siemens_scl(program: PlcProgram, controller: str) -> str:
    converter = PlatformConverter("schneider", "siemens")
    var_lines = _render_var_block(program.vars, converter)
    body_lines = _render_networks(program)
    pattern = program.meta.pattern or "ir"

    lines = [
        f"// {_SOURCE_DISCLAIMER}",
        f"// Controller: {controller}",
        f"// Project: {program.name}",
        f"// Pattern: {pattern}",
        "",
        f'ORGANIZATION_BLOCK "Main"',
        "{ S7_Optimized_Access := 'TRUE' }",
        "VERSION : 0.1",
        "   VAR",
        *var_lines,
        "   END_VAR",
        "",
        "BEGIN",
        *body_lines,
        "END_ORGANIZATION_BLOCK",
        "",
    ]
    return "\n".join(lines)


def _render_var_block(vars_: list[PlcVar], converter: PlatformConverter) -> list[str]:
    lines: list[str] = []
    for var in vars_:
        scl_type = _SCL_TYPE_MAP.get(var.dataType, "Bool")
        comment = f" // {var.comment}" if var.comment else ""
        if var.address:
            siemens_addr = _to_siemens_absolute(converter.convert_address(var.address), var.kind)
            lines.append(f"      {var.symbol} AT {siemens_addr} : {scl_type};{comment}")
        else:
            lines.append(f"      {var.symbol} : {scl_type};{comment}")
    return lines


def _to_siemens_absolute(address: str, kind: str) -> str:
    if address.startswith("%"):
        return address
    if address and address[0] in {"I", "Q", "M"}:
        return f"%{address}"
    if kind == "timer" and address and address[0] == "T":
        return f"%{address}"
    return address


def _render_networks(program: PlcProgram) -> list[str]:
    lines: list[str] = []
    pou = program.pous[0] if program.pous else None
    if not pou:
        return lines

    for network in pou.networks:
        label = network.comment or network.label or "Network"
        lines.append(f"   // {label}")
        for statement in network_to_scl_statements(network):
            lines.append(f"   {statement}")
        lines.append("")
    if lines and lines[-1] == "":
        lines.pop()
    return lines


def network_to_scl_statements(network: Network) -> list[str]:
    if isinstance(network.logic, FbCallNode) and network.logic.kind == "PID":
        statement = render_pid_fb_statement(network.logic, "siemens")
        return [f"{statement};"]
    assignment = _assignment_from_logic(network.logic)
    if assignment:
        target, expression = assignment
        return [f"{target} := {expression};"]
    return []


def _assignment_from_logic(node: LogicNode) -> tuple[str, str] | None:
    if isinstance(node, AndNode):
        coil = next((child for child in node.inputs if isinstance(child, CoilNode)), None)
        if coil is None:
            return None
        parts = [logic_expr(child) for child in node.inputs if not isinstance(child, CoilNode)]
        parts = [part for part in parts if part]
        if not parts:
            return None
        return coil.symbol, " AND ".join(parts)

    if isinstance(node, CoilNode):
        return node.symbol, logic_expr(node)

    return None


def logic_expr(node: LogicNode) -> str:
    if isinstance(node, OrNode):
        parts = [logic_expr(child) for child in node.inputs]
        inner = " OR ".join(parts)
        return f"({inner})" if len(parts) > 1 else inner

    if isinstance(node, AndNode):
        parts = [logic_expr(child) for child in node.inputs if not isinstance(child, CoilNode)]
        return " AND ".join(part for part in parts if part)

    if isinstance(node, NotNode):
        inner = logic_expr(node.input)
        if " " in inner and not (inner.startswith("(") and inner.endswith(")")):
            return f"NOT ({inner})"
        return f"NOT {inner}"

    if isinstance(node, ContactNode):
        return node.symbol

    if isinstance(node, TimerNode):
        return node.symbol

    if isinstance(node, CounterNode):
        return node.symbol

    if isinstance(node, CompareNode):
        op_map = {"GT": ">", "GE": ">=", "LT": "<", "LE": "<=", "EQ": "="}
        op = op_map.get(node.op, node.op)
        return f"({node.left} {op} {node.right})"

    if isinstance(node, FbCallNode):
        return node.enable or "TRUE"

    if isinstance(node, CoilNode):
        return node.symbol

    return ""

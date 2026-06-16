"""Mitsubishi Tier-2 export: IL + ST source and device-comment CSV from PlcProgram IR."""

from __future__ import annotations

import csv
import io
from typing import Any

from plc_file_handler.converters.platform_converter import PlatformConverter

from ...schemas.ir import (
    AndNode,
    CoilNode,
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
    "PLC AutoPilot export — source import only, not a GX Works project (.gxw / .gx3)."
)

TIER2_LIMITATIONS = [
    "ZIP bundles IL + ST source and a device-comment CSV — not a native GX Works project file.",
    "Import IL or ST manually in GX Works; use the CSV for device comments where your tool version supports it.",
    "All vetted IR patterns export to IL/ST; complex parallel branches are approximated in IL — prefer ST import.",
    "Device addresses are mapped from Schneider-style IR via schneider_to_mitsubishi; verify I/O on the target CPU.",
]

PID_TIER2_LIMITATION = (
    "Mitsubishi Tier-2 PID export emits ST function-block text only — not a native PID instruction; verify on target CPU."
)


def build_mitsubishi_tier2_export(program: PlcProgram, controller: str) -> dict[str, Any]:
    converter = PlatformConverter("schneider", "mitsubishi")
    var_by_symbol = {var.symbol: var for var in program.vars}
    mapped_vars = [_map_var(var, converter) for var in program.vars]

    il_text = render_mitsubishi_il(program, controller, mapped_vars, var_by_symbol)
    st_text = render_mitsubishi_st(program, controller, mapped_vars, var_by_symbol)
    csv_text = render_mitsubishi_csv(mapped_vars)

    base = _safe_name(program.name)
    limitations = list(TIER2_LIMITATIONS)
    if program.meta.pattern == "pid_loop":
        limitations.append(PID_TIER2_LIMITATION)
    return {
        "ilFileName": f"{base}.il",
        "il": il_text,
        "stFileName": f"{base}.st",
        "st": st_text,
        "csvFileName": f"{base}_device_comments.csv",
        "csv": csv_text,
        "limitations": limitations,
    }


def render_mitsubishi_il(
    program: PlcProgram,
    controller: str,
    mapped_vars: list[dict[str, str]],
    var_by_symbol: dict[str, PlcVar],
) -> str:
    pattern = program.meta.pattern or "ir"
    lines = [
        f"; {_SOURCE_DISCLAIMER}",
        f"; Controller: {controller}",
        f"; Project: {program.name}",
        f"; Pattern: {pattern}",
        "; Symbol map:",
    ]
    for item in mapped_vars:
        lines.append(f";   {item['symbol']}={item['device']}")
    lines.append("")

    pou = program.pous[0] if program.pous else None
    if pou:
        for index, network in enumerate(pou.networks):
            label = network.comment or network.label or f"Rung {index + 1}"
            if isinstance(network.logic, FbCallNode) and network.logic.kind == "PID":
                st = render_pid_fb_statement(network.logic, "mitsubishi")
                lines.append(f"; --- {label} ---")
                lines.append(f"; {st}")
                lines.append("")
                continue
            lines.append(f"; --- {label} ---")
            il_lines = logic_to_mitsubishi_il(network.logic, var_by_symbol, mapped_vars)
            lines.extend(il_lines)
            lines.append("")

    if lines and lines[-1] == "":
        lines.pop()
    lines.append("")
    return "\n".join(lines)


def render_mitsubishi_st(
    program: PlcProgram,
    controller: str,
    mapped_vars: list[dict[str, str]],
    var_by_symbol: dict[str, PlcVar],
) -> str:
    pattern = program.meta.pattern or "ir"
    device_by_symbol = {item["symbol"]: item["device"] for item in mapped_vars}
    lines = [
        f"(* {_SOURCE_DISCLAIMER} *)",
        f"(* Controller: {controller} *)",
        f"(* Project: {program.name} *)",
        f"(* Pattern: {pattern} *)",
        "",
    ]

    pou = program.pous[0] if program.pous else None
    if pou:
        for index, network in enumerate(pou.networks):
            label = network.comment or network.label or f"Rung {index + 1}"
            if isinstance(network.logic, FbCallNode) and network.logic.kind == "PID":
                st = render_pid_fb_statement(network.logic, "mitsubishi")
                lines.append(f"(* {label} *)")
                lines.append(f"{st};")
                lines.append("")
                continue
            assignment = _assignment_from_logic(network.logic, device_by_symbol)
            if assignment:
                target, expression = assignment
                lines.append(f"(* {label} *)")
                lines.append(f"{target} := {expression};")
                lines.append("")

    if lines and lines[-1] == "":
        lines.pop()
    lines.append("")
    return "\n".join(lines)


def render_mitsubishi_csv(mapped_vars: list[dict[str, str]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(["Device", "Symbol", "Comment"])
    for item in mapped_vars:
        writer.writerow([item["device"], item["symbol"], item["comment"]])
    return buffer.getvalue()


def logic_to_mitsubishi_il(
    node: LogicNode,
    var_by_symbol: dict[str, PlcVar],
    mapped_vars: list[dict[str, str]],
) -> list[str]:
    device_by_symbol = {item["symbol"]: item["device"] for item in mapped_vars}

    if isinstance(node, AndNode):
        lines: list[str] = []
        for child in node.inputs:
            if isinstance(child, CoilNode):
                lines.append(f"OUT {_device(child.symbol, var_by_symbol, device_by_symbol)}")
            else:
                lines.extend(_logic_part_il(child, var_by_symbol, device_by_symbol, first=len(lines) == 0))
        return [line for line in lines if line]

    if isinstance(node, CoilNode):
        return [f"OUT {_device(node.symbol, var_by_symbol, device_by_symbol)}"]

    return _logic_part_il(node, var_by_symbol, device_by_symbol, first=True)


def _logic_part_il(
    node: LogicNode,
    var_by_symbol: dict[str, PlcVar],
    device_by_symbol: dict[str, str],
    *,
    first: bool,
) -> list[str]:
    if isinstance(node, ContactNode):
        op = _device(node.symbol, var_by_symbol, device_by_symbol)
        prefix = "LD" if first else "AND"
        if node.negated:
            prefix = "LDI" if first else "ANI"
        return [f"{prefix} {op}"]

    if isinstance(node, NotNode) and isinstance(node.input, ContactNode):
        op = _device(node.input.symbol, var_by_symbol, device_by_symbol)
        prefix = "LDI" if first else "ANI"
        return [f"{prefix} {op}"]

    if isinstance(node, OrNode):
        lines: list[str] = []
        for index, child in enumerate(node.inputs):
            if isinstance(child, ContactNode):
                op = _device(child.symbol, var_by_symbol, device_by_symbol)
                if index == 0:
                    instr = "LDI" if child.negated else "LD"
                else:
                    instr = "ORI" if child.negated else "OR"
                lines.append(f"{instr} {op}")
            else:
                lines.extend(_logic_part_il(child, var_by_symbol, device_by_symbol, first=index == 0 and not lines))
        return lines

    if isinstance(node, TimerNode):
        op = _device(node.symbol, var_by_symbol, device_by_symbol)
        prefix = "LD" if first else "AND"
        return [f"{prefix} {op}"]

    if isinstance(node, CounterNode):
        op = _device(node.symbol, var_by_symbol, device_by_symbol)
        prefix = "LD" if first else "AND"
        return [f"{prefix} {op}"]

    if isinstance(node, AndNode):
        lines: list[str] = []
        for child in node.inputs:
            if isinstance(child, CoilNode):
                continue
            lines.extend(_logic_part_il(child, var_by_symbol, device_by_symbol, first=not lines))
        return lines

    return []


def _assignment_from_logic(node: LogicNode, device_by_symbol: dict[str, str]) -> tuple[str, str] | None:
    if isinstance(node, AndNode):
        coil = next((child for child in node.inputs if isinstance(child, CoilNode)), None)
        if coil is None:
            return None
        parts = [_logic_expr(child, device_by_symbol) for child in node.inputs if not isinstance(child, CoilNode)]
        parts = [part for part in parts if part]
        if not parts:
            return None
        target = device_by_symbol.get(coil.symbol, coil.symbol)
        return target, " AND ".join(parts)

    if isinstance(node, CoilNode):
        target = device_by_symbol.get(node.symbol, node.symbol)
        return target, _logic_expr(node, device_by_symbol)

    return None


def _logic_expr(node: LogicNode, device_by_symbol: dict[str, str]) -> str:
    if isinstance(node, OrNode):
        parts = [_logic_expr(child, device_by_symbol) for child in node.inputs]
        inner = " OR ".join(parts)
        return f"({inner})" if len(parts) > 1 else inner

    if isinstance(node, AndNode):
        parts = [_logic_expr(child, device_by_symbol) for child in node.inputs if not isinstance(child, CoilNode)]
        return " AND ".join(part for part in parts if part)

    if isinstance(node, NotNode):
        inner = _logic_expr(node.input, device_by_symbol)
        if " " in inner and not (inner.startswith("(") and inner.endswith(")")):
            return f"NOT ({inner})"
        return f"NOT {inner}"

    if isinstance(node, ContactNode):
        return device_by_symbol.get(node.symbol, node.symbol)

    if isinstance(node, (TimerNode, CounterNode, CoilNode)):
        return device_by_symbol.get(node.symbol, node.symbol)

    return ""


def _map_var(var: PlcVar, converter: PlatformConverter) -> dict[str, str]:
    device = converter.convert_address(var.address) if var.address else var.symbol
    return {
        "symbol": var.symbol,
        "device": device,
        "comment": var.comment or var.symbol,
        "kind": var.kind,
    }


def _device(symbol: str, var_by_symbol: dict[str, PlcVar], device_by_symbol: dict[str, str]) -> str:
    if symbol in device_by_symbol:
        return device_by_symbol[symbol]
    var = var_by_symbol.get(symbol)
    if var and var.address:
        return var.address
    return symbol


def _safe_name(name: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in {"_", "-"} else "_" for ch in name.strip())
    return cleaned or "Mitsubishi_Program"

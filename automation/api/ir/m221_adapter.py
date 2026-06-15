"""Convert validated PlcProgram IR into M221 builder JSON (Calaos export path)."""

from __future__ import annotations

from typing import Any

from ..schemas.ir import (
    AndNode,
    CoilNode,
    ContactNode,
    CounterNode,
    LogicNode,
    Network,
    NotNode,
    OrNode,
    PlcProgram,
    PlcVar,
    TimerNode,
)


def plc_program_to_m221_data(program: PlcProgram) -> dict[str, Any]:
    """Map PlcProgram IR to M221ProgramData-compatible dict for M221SmbpBuilder."""
    inputs: list[dict[str, str]] = []
    outputs: list[dict[str, str]] = []
    memory: list[dict[str, str]] = []
    timers: list[dict[str, Any]] = []

    for var in program.vars:
        point = {
            "address": var.address or "",
            "symbol": var.symbol,
            "comment": var.comment or var.symbol,
        }
        if var.kind == "input":
            inputs.append(point)
        elif var.kind == "output":
            outputs.append(point)
        elif var.kind == "memory":
            memory.append(point)
        elif var.kind == "timer":
            timers.append(
                {
                    **point,
                    "type": var.dataType if var.dataType in {"TON", "TOF", "TP"} else "TON",
                    "preset": 3,
                    "timebase": "1s",
                }
            )
        elif var.kind == "counter":
            memory.append(point)

    var_by_symbol = {var.symbol: var for var in program.vars}
    rungs: list[dict[str, Any]] = []
    pou = program.pous[0] if program.pous else None
    if pou:
        for index, network in enumerate(pou.networks):
            il_lines = logic_to_il(network.logic, var_by_symbol)
            if not il_lines:
                continue
            rungs.append(
                {
                    "name": network.label or f"Rung {index + 1}",
                    "comment": network.comment or network.label or f"Rung {index + 1}",
                    "il": il_lines,
                    "ladder": network.comment or network.label or "",
                }
            )

    if not rungs:
        from ..services.m221_smbp_builder import default_m221_program

        fallback = default_m221_program(program.name)
        fallback["inputs"] = inputs or fallback["inputs"]
        fallback["outputs"] = outputs or fallback["outputs"]
        fallback["memory"] = memory or fallback["memory"]
        fallback["timers"] = timers or fallback["timers"]
        return fallback

    return {
        "projectName": program.name,
        "inputs": inputs,
        "outputs": outputs,
        "memory": memory,
        "timers": timers,
        "rungs": rungs,
    }


def logic_to_il(node: LogicNode, var_by_symbol: dict[str, PlcVar]) -> list[str]:
    if isinstance(node, AndNode):
        lines: list[str] = []
        for child in node.inputs:
            if isinstance(child, CoilNode):
                lines.append(f"ST {_operand(child.symbol, var_by_symbol)}")
            else:
                lines.extend(_logic_part_il(child, var_by_symbol, first=len(lines) == 0))
        return [line for line in lines if line]

    if isinstance(node, CoilNode):
        return [f"ST {_operand(node.symbol, var_by_symbol)}"]

    return _logic_part_il(node, var_by_symbol, first=True)


def _logic_part_il(node: LogicNode, var_by_symbol: dict[str, PlcVar], *, first: bool) -> list[str]:
    if isinstance(node, ContactNode):
        op = _operand(node.symbol, var_by_symbol)
        prefix = "LD" if first else "AND"
        if node.negated:
            prefix = "LDN" if first else "ANDN"
        return [f"{prefix} {op}"]

    if isinstance(node, NotNode) and isinstance(node.input, ContactNode):
        op = _operand(node.input.symbol, var_by_symbol)
        prefix = "LDN" if first else "ANDN"
        return [f"{prefix} {op}"]

    if isinstance(node, OrNode):
        lines: list[str] = []
        for index, child in enumerate(node.inputs):
            if isinstance(child, ContactNode):
                op = _operand(child.symbol, var_by_symbol)
                if index == 0:
                    instr = "LDN" if child.negated else "LD"
                else:
                    instr = "ORN" if child.negated else "OR"
                lines.append(f"{instr} {op}")
            else:
                lines.extend(_logic_part_il(child, var_by_symbol, first=index == 0 and not lines))
        return lines

    if isinstance(node, TimerNode):
        op = _operand(node.symbol, var_by_symbol)
        prefix = "LD" if first else "AND"
        return [f"{prefix} {op}"]

    if isinstance(node, CounterNode):
        op = _operand(node.symbol, var_by_symbol)
        prefix = "LD" if first else "AND"
        return [f"{prefix} {op}"]

    if isinstance(node, AndNode):
        lines: list[str] = []
        for child in node.inputs:
            if isinstance(child, CoilNode):
                continue
            lines.extend(_logic_part_il(child, var_by_symbol, first=not lines))
        return lines

    return []


def _operand(symbol: str, var_by_symbol: dict[str, PlcVar]) -> str:
    var = var_by_symbol.get(symbol)
    if var and var.address:
        return var.address
    return symbol

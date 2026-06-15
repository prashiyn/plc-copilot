"""Convert SketchAnalyzer JSON output into validated PlcProgram IR."""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from ..schemas.ir import (
    AndNode,
    CoilNode,
    ContactNode,
    CounterNode,
    LogicNode,
    Network,
    OrNode,
    PlcMeta,
    PlcProgram,
    PlcTarget,
    PlcVar,
    Pou,
    TimerNode,
)
from .validator import validate_program

_COIL_TYPES = frozenset({"coil", "coil_set", "coil_reset"})
_TIMER_TYPES = {"timer_ton": "TON", "timer_tof": "TOF", "timer_tp": "TP", "timer_rto": "TON"}
_COUNTER_TYPES = {"counter_ctu": "CTU", "counter_ctd": "CTD", "counter_ctud": "CTUD"}
_TAG_KIND = {
    "INPUT": "input",
    "OUTPUT": "output",
    "MEMORY": "memory",
    "TIMER": "timer",
    "COUNTER": "counter",
}
_VENDOR_ALIASES = {
    "schneider": "schneider",
    "rockwell": "rockwell",
    "allen-bradley": "rockwell",
    "siemens": "siemens",
    "mitsubishi": "mitsubishi",
}


class SketchAdapterError(ValueError):
    pass


def sketch_analysis_to_ir(
    analysis: dict[str, Any],
    *,
    project_name: str,
    vendor: str,
    model: str,
) -> PlcProgram:
    """Build a PlcProgram from sketch analysis JSON."""
    if analysis.get("error"):
        raise SketchAdapterError(str(analysis["error"]))

    rungs = analysis.get("rungs")
    if not isinstance(rungs, list) or not rungs:
        raise SketchAdapterError("Sketch analysis must include at least one rung")

    vendor_norm = _normalize_vendor(vendor, analysis.get("target_platform"))
    vars_ = _tags_to_vars(analysis.get("tags_detected", []))
    _ensure_element_symbols(rungs, vars_)

    networks: list[Network] = []
    sorted_rungs = sorted(rungs, key=lambda item: int(item.get("rung_number", 0)))
    for index, rung in enumerate(sorted_rungs):
        elements = rung.get("elements") or []
        if not elements:
            raise SketchAdapterError(f"Rung {rung.get('rung_number', index)} has no elements")
        networks.append(
            Network(
                label=f"Rung {rung.get('rung_number', index) + 1}",
                comment=rung.get("comment") or rung.get("logic_description"),
                logic=_build_rung_logic(elements),
            )
        )

    confidence = analysis.get("confidence")
    pattern_params: dict[str, int | str | float | bool] = {"source": "sketch_analysis"}
    if isinstance(confidence, (int, float)):
        pattern_params["sketchConfidence"] = float(confidence)

    program = PlcProgram(
        name=project_name,
        target=PlcTarget(vendor=vendor_norm, model=model),  # type: ignore[arg-type]
        vars=vars_,
        pous=[Pou(name="MainProgram", networks=networks)],
        meta=PlcMeta(
            description="Ladder logic imported from sketch analysis",
            pattern=None,
            patternParams=pattern_params,
        ),
    )
    return validate_program(program)


def _normalize_vendor(vendor: str, analysis_platform: Any) -> str:
    key = str(vendor or analysis_platform or "schneider").lower().strip()
    if key in _VENDOR_ALIASES:
        return _VENDOR_ALIASES[key]
    if "allen" in key or "bradley" in key:
        return "rockwell"
    return "generic"


def _tags_to_vars(tags: list[Any]) -> list[PlcVar]:
    vars_: list[PlcVar] = []
    seen: set[str] = set()
    for tag in tags:
        if not isinstance(tag, dict):
            continue
        symbol = _symbol_from_element(tag, fallback_prefix="TAG")
        if symbol in seen:
            continue
        seen.add(symbol)
        tag_type = str(tag.get("type", "MEMORY")).upper()
        kind = _TAG_KIND.get(tag_type, "memory")
        data_type = str(tag.get("data_type", "BOOL")).upper()
        if kind == "timer" and data_type == "BOOL":
            data_type = "TON"
        if kind == "counter" and data_type == "BOOL":
            data_type = "CTU"
        vars_.append(
            PlcVar(
                symbol=symbol,
                address=tag.get("address"),
                dataType=data_type,  # type: ignore[arg-type]
                kind=kind,  # type: ignore[arg-type]
                comment=tag.get("comment"),
            )
        )
    return vars_


def _ensure_element_symbols(rungs: list[Any], vars_: list[PlcVar]) -> None:
    known = {var.symbol for var in vars_}
    next_idx = len(vars_)
    for rung in rungs:
        if not isinstance(rung, dict):
            continue
        for element in rung.get("elements") or []:
            if not isinstance(element, dict):
                continue
            symbol = _symbol_from_element(element, fallback_prefix=f"SYM{next_idx}")
            if symbol in known:
                continue
            known.add(symbol)
            address = element.get("address")
            vars_.append(
                PlcVar(
                    symbol=symbol,
                    address=address,
                    kind=_infer_kind(element, address),
                    dataType=_infer_data_type(element),
                    comment=element.get("label"),
                )
            )
            next_idx += 1


def _infer_kind(element: dict[str, Any], address: Any) -> str:
    elem_type = str(element.get("type", "")).lower()
    if elem_type in _TIMER_TYPES:
        return "timer"
    if elem_type in _COUNTER_TYPES:
        return "counter"
    if isinstance(address, str):
        if address.startswith("%I"):
            return "input"
        if address.startswith("%Q"):
            return "output"
        if address.startswith("%TM") or address.startswith("%T"):
            return "timer"
        if address.startswith("%C"):
            return "counter"
        if address.startswith("%M"):
            return "memory"
    return "memory"


def _infer_data_type(element: dict[str, Any]) -> str:
    elem_type = str(element.get("type", "")).lower()
    if elem_type in _TIMER_TYPES:
        return _TIMER_TYPES[elem_type]
    if elem_type in _COUNTER_TYPES:
        return _COUNTER_TYPES[elem_type]
    params = element.get("parameters") or {}
    if isinstance(params, dict) and params.get("data_type"):
        return str(params["data_type"]).upper()
    return "BOOL"


def _build_rung_logic(elements: list[dict[str, Any]]) -> LogicNode:
    coils = [element for element in elements if _is_coil(element)]
    contacts = [element for element in elements if not _is_coil(element)]

    by_branch: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for element in contacts:
        by_branch[int(element.get("branch", 0))].append(element)

    branch_ids = sorted(by_branch.keys())
    if len(branch_ids) <= 1:
        nodes = [_element_to_logic_node(element) for element in contacts]
    else:
        branch_nodes: list[LogicNode] = []
        for branch_id in branch_ids:
            branch_elems = by_branch[branch_id]
            converted = [_element_to_logic_node(element) for element in branch_elems]
            if len(converted) == 1:
                branch_nodes.append(converted[0])
            else:
                branch_nodes.append(AndNode(inputs=converted))
        nodes = [OrNode(inputs=branch_nodes) if len(branch_nodes) > 1 else branch_nodes[0]]

    for coil in coils:
        nodes.append(_coil_node(coil))

    if len(nodes) == 1:
        return nodes[0]
    return AndNode(inputs=nodes)


def _element_to_logic_node(element: dict[str, Any]) -> LogicNode:
    elem_type = str(element.get("type", "")).lower()
    symbol = _symbol_from_element(element)

    if elem_type == "contact_no":
        return ContactNode(symbol=symbol, negated=False)
    if elem_type == "contact_nc":
        return ContactNode(symbol=symbol, negated=True)
    if elem_type in _TIMER_TYPES:
        preset_ms = _preset_ms(element)
        return TimerNode(symbol=symbol, timerType=_TIMER_TYPES[elem_type], presetMs=preset_ms)
    if elem_type in _COUNTER_TYPES:
        preset = _counter_preset(element)
        return CounterNode(symbol=symbol, counterType=_COUNTER_TYPES[elem_type], preset=preset)
    raise SketchAdapterError(f"Unsupported sketch element type: {elem_type}")


def _coil_node(element: dict[str, Any]) -> CoilNode:
    elem_type = str(element.get("type", "coil")).lower()
    coil_type = "normal"
    if elem_type == "coil_set":
        coil_type = "set"
    elif elem_type == "coil_reset":
        coil_type = "reset"
    return CoilNode(symbol=_symbol_from_element(element), coilType=coil_type)  # type: ignore[arg-type]


def _is_coil(element: dict[str, Any]) -> bool:
    return str(element.get("type", "")).lower() in _COIL_TYPES


def _symbol_from_element(element: dict[str, Any], fallback_prefix: str = "SYM") -> str:
    for key in ("label", "name"):
        value = element.get(key)
        if isinstance(value, str) and value.strip():
            return _sanitize_symbol(value)
    address = element.get("address")
    if isinstance(address, str) and address.strip():
        return _sanitize_symbol(address.replace("%", "").replace(".", "_"))
    return f"{fallback_prefix}_{abs(hash(str(element))) % 10_000}"


def _sanitize_symbol(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_]", "_", value.strip())
    if not cleaned:
        return "UNNAMED"
    if cleaned[0].isdigit():
        return f"TAG_{cleaned}"
    return cleaned


def _preset_ms(element: dict[str, Any]) -> int | None:
    params = element.get("parameters") or {}
    raw = element.get("preset") or params.get("preset")
    if raw is None:
        return None
    try:
        value = int(str(raw))
    except ValueError:
        return None
    time_base = str(params.get("time_base", "ms")).lower()
    if time_base.startswith("s"):
        return max(1, value * 1000)
    return max(1, value)


def _counter_preset(element: dict[str, Any]) -> int | None:
    params = element.get("parameters") or {}
    raw = element.get("preset") or params.get("preset")
    if raw is None:
        return None
    try:
        return max(0, int(str(raw)))
    except ValueError:
        return None

"""Shared helpers for IR platform providers."""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

from ..schemas.ir import (
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
    PlcVar,
    TimerNode,
)


def file_result(
    file_name: str,
    content: bytes,
    mime_type: str,
    pattern: str,
    vendor: str,
    controller: str,
    *,
    file_format: str | None = None,
    tier: int | None = None,
    disclaimer: str | None = None,
    metadata_extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "platform": vendor,
        "controller": controller,
        "pattern": pattern,
        "format": file_format or Path(file_name).suffix.lstrip(".").lower(),
        "source": "ir",
    }
    if tier is not None:
        metadata["tier"] = tier
    if disclaimer:
        metadata["disclaimer"] = disclaimer
    if metadata_extra:
        metadata.update(metadata_extra)
    return {
        "fileName": file_name,
        "mimeType": mime_type,
        "contentBase64": base64.standard_b64encode(content).decode("ascii"),
        "metadata": metadata,
    }


def network_to_rockwell_elements(network: Network, vars_: list[PlcVar]) -> list[dict[str, str]]:
    elements: list[dict[str, str]] = []
    for item in flatten_serial_logic(network.logic):
        if item["kind"] == "contact_no":
            elements.append({"type": "contact_no", "label": item["symbol"]})
        elif item["kind"] == "contact_nc":
            elements.append({"type": "contact_nc", "label": item["symbol"]})
        elif item["kind"] == "coil":
            elements.append({"type": "coil", "label": item["symbol"]})
    return elements


def _collect_contact_symbols(node: LogicNode) -> list[str]:
    if isinstance(node, ContactNode):
        return [node.symbol]
    if isinstance(node, NotNode):
        return _collect_contact_symbols(node.input)
    if isinstance(node, (AndNode, OrNode)):
        symbols: list[str] = []
        for child in node.inputs:
            symbols.extend(_collect_contact_symbols(child))
        return symbols
    return []


def _apply_flat_element(
    item: dict[str, str],
    contacts: list[str],
    normally_closed: list[str],
) -> None:
    if item["kind"] == "contact_no":
        contacts.append(item["symbol"])
    elif item["kind"] == "contact_nc":
        normally_closed.append(item["symbol"])


def _flat_elements_to_plcopen_kwargs(flat: list[dict[str, str]]) -> dict[str, Any]:
    contacts: list[str] = []
    normally_closed: list[str] = []
    coil: str | None = None
    for item in flat:
        if item["kind"] == "coil":
            coil = item["symbol"]
        else:
            _apply_flat_element(item, contacts, normally_closed)
    return {
        "contacts": contacts,
        "normally_closed": normally_closed,
        "coil": coil,
        "seal_in": None,
    }


def _and_node_to_plcopen_kwargs(logic: AndNode) -> dict[str, Any]:
    coil = next((child for child in logic.inputs if isinstance(child, CoilNode)), None)
    if coil is None:
        return _flat_elements_to_plcopen_kwargs(flatten_serial_logic(logic))

    contacts: list[str] = []
    normally_closed: list[str] = []
    seal_in: str | None = None

    for child in logic.inputs:
        if isinstance(child, CoilNode):
            continue
        if isinstance(child, OrNode):
            or_symbols = _collect_contact_symbols(child)
            if coil.symbol in or_symbols and len(or_symbols) == 2:
                seal_in = coil.symbol
                contacts.extend(sym for sym in or_symbols if sym != coil.symbol)
            else:
                for item in flatten_serial_logic(child):
                    _apply_flat_element(item, contacts, normally_closed)
        elif isinstance(child, NotNode) and isinstance(child.input, ContactNode):
            normally_closed.append(child.input.symbol)
        elif isinstance(child, ContactNode):
            contacts.append(child.symbol)
        else:
            for item in flatten_serial_logic(child):
                _apply_flat_element(item, contacts, normally_closed)

    return {
        "contacts": contacts,
        "normally_closed": normally_closed,
        "coil": coil.symbol,
        "seal_in": seal_in,
    }


def network_to_plcopen_rung_kwargs(network: Network) -> dict[str, Any]:
    """Map an IR network to PLCopenProgram.add_rung() keyword arguments."""
    logic = network.logic
    if isinstance(logic, AndNode):
        return _and_node_to_plcopen_kwargs(logic)
    if isinstance(logic, CoilNode):
        return {"contacts": [], "normally_closed": [], "coil": logic.symbol, "seal_in": None}
    return _flat_elements_to_plcopen_kwargs(flatten_serial_logic(logic))


def flatten_serial_logic(node: LogicNode) -> list[dict[str, str]]:
    if isinstance(node, AndNode):
        items: list[dict[str, str]] = []
        for child in node.inputs:
            items.extend(flatten_serial_logic(child))
        return items
    if isinstance(node, OrNode):
        items = []
        for child in node.inputs:
            items.extend(flatten_serial_logic(child))
        return items
    if isinstance(node, NotNode) and isinstance(node.input, ContactNode):
        return [{"kind": "contact_nc", "symbol": node.input.symbol}]
    if isinstance(node, ContactNode):
        kind = "contact_nc" if node.negated else "contact_no"
        return [{"kind": kind, "symbol": node.symbol}]
    if isinstance(node, CoilNode):
        return [{"kind": "coil", "symbol": node.symbol}]
    if isinstance(node, (TimerNode, CounterNode, CompareNode, FbCallNode)):
        return []
    return []

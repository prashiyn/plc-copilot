"""Shared helpers for IR platform providers."""

from __future__ import annotations

import base64
from pathlib import Path
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
    if isinstance(node, (TimerNode, CounterNode)):
        return []
    return []

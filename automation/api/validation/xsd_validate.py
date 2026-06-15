"""Validate vendor export XML against committed XSD artifacts (Phase 5 P1)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from lxml import etree

from .schema_registry import (
    CALAOS_SUBSET_SCHEMA,
    L5X_V32_SCHEMA,
    resolve_calaos_schema_path,
    resolve_l5x_schema_path,
)

SCHEMAS_DIR = Path(__file__).resolve().parent / "schemas"


@lru_cache(maxsize=16)
def _load_schema(path: str) -> etree.XMLSchema:
    schema_path = Path(path)
    if not schema_path.is_file():
        raise FileNotFoundError(f"XSD schema not found: {schema_path}")
    return etree.XMLSchema(etree.parse(str(schema_path)))


def validate_xml_against_schema(content: bytes, schema_path: Path) -> list[str]:
    """Return validation error messages; empty list means valid."""
    schema = _load_schema(str(schema_path.resolve()))
    try:
        document = etree.fromstring(content)
    except etree.XMLSyntaxError as exc:
        return [f"XML syntax error: {exc}"]

    if not schema.validate(document):
        return [str(error) for error in schema.error_log]
    return []


def validate_l5x(content: bytes, *, target_major: int | None = None) -> list[str]:
    schema_path = resolve_l5x_schema_path(content, override_major=target_major)
    return validate_xml_against_schema(content, schema_path)


def validate_calaos_smbp(content: bytes) -> list[str]:
    return validate_xml_against_schema(content, resolve_calaos_schema_path())


def validation_schema_used(content: bytes, *, vendor: str, target_major: int | None = None) -> str:
    """Return schema filename used for diagnostics (RUNBOOK / support)."""
    if vendor == "rockwell":
        return resolve_l5x_schema_path(content, override_major=target_major).name
    if vendor == "schneider":
        return resolve_calaos_schema_path().name
    return "none"

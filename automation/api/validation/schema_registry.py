"""Schema manifest and version resolution for vendor export validation."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from lxml import etree

SCHEMAS_DIR = Path(__file__).resolve().parent / "schemas"
MANIFEST_PATH = SCHEMAS_DIR / "manifest.json"
L5X_V32_SCHEMA = SCHEMAS_DIR / "l5x-v32.xsd"
CALAOS_SUBSET_SCHEMA = SCHEMAS_DIR / "calaos-case-2.0-subset.xsd"

_L5X_SOFTWARE_REVISION = re.compile(r"SoftwareRevision=\"([^\"]+)\"")


@lru_cache(maxsize=1)
def load_schema_manifest() -> dict[str, Any]:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def list_registered_schemas() -> list[dict[str, Any]]:
    """Flatten manifest entries for CLI / docs."""
    manifest = load_schema_manifest()
    rows: list[dict[str, Any]] = []
    for provider_id, provider in manifest.get("providers", {}).items():
        for version in provider.get("versions", []):
            rows.append(
                {
                    "provider": provider_id,
                    "id": version.get("id"),
                    "file": version.get("file"),
                    "validationType": provider.get("validationType"),
                    "ciDefault": version.get("ciDefault", False),
                }
            )
    return rows


def detect_l5x_software_revision(content: bytes) -> str | None:
    """Read SoftwareRevision from RSLogix5000Content without full DOM walk."""
    try:
        root = etree.fromstring(content)
    except etree.XMLSyntaxError:
        match = _L5X_SOFTWARE_REVISION.search(content.decode("utf-8", errors="ignore"))
        return match.group(1) if match else None
    if root.tag == "RSLogix5000Content":
        return root.get("SoftwareRevision")
    return None


def resolve_l5x_schema_path(content: bytes, *, override_major: int | None = None) -> Path:
    """
    Pick the L5X XSD file for this export.

    Resolution order:
    1. explicit override_major (field / test hook for older Studio 5000 targets)
    2. major version from SoftwareRevision attribute
    3. manifest defaultSchema
    """
    if override_major is not None:
        candidate = SCHEMAS_DIR / f"l5x-v{override_major}.xsd"
        if candidate.is_file():
            return candidate

    revision = detect_l5x_software_revision(content)
    if revision:
        major = revision.split(".", 1)[0]
        if major.isdigit():
            candidate = SCHEMAS_DIR / f"l5x-v{major}.xsd"
            if candidate.is_file():
                return candidate

    manifest = load_schema_manifest()
    default_name = manifest["providers"]["rockwell_l5x"]["defaultSchema"]
    return SCHEMAS_DIR / default_name


def resolve_calaos_schema_path() -> Path:
    manifest = load_schema_manifest()
    default_name = manifest["providers"]["schneider_calaos"]["defaultSchema"]
    return SCHEMAS_DIR / default_name

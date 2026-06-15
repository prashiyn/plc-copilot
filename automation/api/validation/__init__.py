"""XML schema validation helpers for vendor export CI gates."""

from .schema_registry import (
    detect_l5x_software_revision,
    list_registered_schemas,
    load_schema_manifest,
    resolve_l5x_schema_path,
)
from .xsd_validate import (
    CALAOS_SUBSET_SCHEMA,
    L5X_V32_SCHEMA,
    validate_calaos_smbp,
    validate_l5x,
    validate_xml_against_schema,
    validation_schema_used,
)

__all__ = [
    "CALAOS_SUBSET_SCHEMA",
    "L5X_V32_SCHEMA",
    "detect_l5x_software_revision",
    "list_registered_schemas",
    "load_schema_manifest",
    "resolve_l5x_schema_path",
    "validate_calaos_smbp",
    "validate_l5x",
    "validate_xml_against_schema",
    "validation_schema_used",
]

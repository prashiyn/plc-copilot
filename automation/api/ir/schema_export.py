"""JSON Schema export for PlcProgram IR — used by Claude prompts (4e-2) and API clients."""

from typing import Any

from ..schemas.ir import PlcProgram


def ir_json_schema() -> dict[str, Any]:
    """Full Pydantic JSON Schema for PlcProgram."""
    return PlcProgram.model_json_schema()


def ir_schema_for_claude() -> dict[str, Any]:
    """Schema payload suitable for Claude structured-output system prompts."""
    schema = ir_json_schema()
    return {
        "title": schema.get("title", "PlcProgram"),
        "description": (
            "Vendor-neutral PLC program intermediate representation. "
            "All logic symbols must appear in vars. Timer/counter nodes must reference vars of matching kind."
        ),
        "schema": schema,
    }

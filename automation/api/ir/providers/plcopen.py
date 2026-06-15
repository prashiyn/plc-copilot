from __future__ import annotations

from typing import Any

from ...schemas.ir import PlcProgram
from ..serialize_helpers import file_result
from ..serializers.plcopen_from_ir import render_plcopen_bytes


class PlcopenProvider:
    def __init__(self, vendor: str = "generic") -> None:
        self.vendor = vendor  # type: ignore[assignment]

    def serialize(self, program: PlcProgram) -> dict[str, Any]:
        project_name = program.name
        controller = program.target.model
        content = render_plcopen_bytes(program)
        pattern = program.meta.pattern or "ir"
        return file_result(
            f"{project_name}.xml",
            content,
            "application/xml",
            pattern,
            program.target.vendor,
            controller,
            file_format="plcopen_xml",
        )

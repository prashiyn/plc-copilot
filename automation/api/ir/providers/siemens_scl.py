from __future__ import annotations

from typing import Any

from ...schemas.ir import PlcProgram
from ..serialize_helpers import file_result
from ..serializers.siemens_scl import render_siemens_scl


class SiemensSclProvider:
    vendor = "siemens"

    def serialize(self, program: PlcProgram) -> dict[str, Any]:
        scl_text = render_siemens_scl(program, program.target.model)
        content = scl_text.encode("utf-8")
        return file_result(
            f"{program.name}.scl",
            content,
            "text/plain",
            program.meta.pattern or "ir",
            self.vendor,
            program.target.model,
            file_format="scl",
            tier=2,
            disclaimer="source import, not a TIA project",
        )

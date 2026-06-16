from __future__ import annotations

from typing import Any

from ...schemas.ir import PlcProgram
from ..serialize_helpers import file_result
from ..serializers.schneider_calaos import render_calaos_smbp_from_program


PID_NATIVE_LIMITATIONS = [
    "PID analog loop exported as ST comment in ladder — configure PID function block manually in Machine Expert.",
]


class SchneiderCalaosProvider:
    vendor = "schneider"

    def serialize(self, program: PlcProgram) -> dict[str, Any]:
        xml = render_calaos_smbp_from_program(program, program.target.model)
        content = xml.encode("utf-8")
        metadata_extra = None
        if program.meta.pattern == "pid_loop":
            metadata_extra = {"limitations": PID_NATIVE_LIMITATIONS}
        return file_result(
            f"{program.name}.smbp",
            content,
            "application/xml",
            program.meta.pattern or "ir",
            self.vendor,
            program.target.model,
            file_format="machine_expert_basic_xml",
            metadata_extra=metadata_extra,
        )

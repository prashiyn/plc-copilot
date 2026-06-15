from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

from plc_automation.unified_interface import PLCAutomation, Platform

from ...schemas.ir import PlcProgram
from ..serialize_helpers import file_result

PLCOPEN_PLATFORM_MAP: dict[str, Platform] = {
    "schneider": Platform.UNIVERSAL,
    "rockwell": Platform.ROCKWELL,
    "siemens": Platform.SIEMENS,
    "mitsubishi": Platform.MITSUBISHI,
    "codesys": Platform.CODESYS,
    "generic": Platform.UNIVERSAL,
}


class PlcopenProvider:
    def __init__(self, vendor: str = "generic") -> None:
        self.vendor = vendor  # type: ignore[assignment]

    def serialize(self, program: PlcProgram) -> dict[str, Any]:
        if program.meta.pattern != "motor_startstop":
            raise ValueError("PLCopen IR export supports motor_startstop pattern only")

        project_name = program.name
        controller = program.target.model
        platform = PLCOPEN_PLATFORM_MAP.get(program.target.vendor, Platform.UNIVERSAL)
        automation = PLCAutomation(platform)
        automation.create_project(project_name, controller)
        automation.add_motor_startstop()
        automation.compile()

        with tempfile.TemporaryDirectory(prefix="ir-open-") as tmp:
            output = Path(tmp) / f"{project_name}.xml"
            automation.export_xml(str(output))
            content = output.read_bytes()
            return file_result(
                output.name,
                content,
                "application/xml",
                "motor_startstop",
                program.target.vendor,
                controller,
                file_format="plcopen_xml",
            )

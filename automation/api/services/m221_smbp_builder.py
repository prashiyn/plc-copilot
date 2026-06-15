import base64
import json
from typing import Any

from ..ir.serializers.schneider_calaos import CALAOS_TEMPLATE, render_calaos_smbp_from_data
from ..schemas.m221 import M221ProgramData

SAMPLES_DIR = CALAOS_TEMPLATE.parent
M221_TEMPLATE = CALAOS_TEMPLATE


def default_m221_program(project_name: str = "M221_Program") -> dict[str, Any]:
    return {
        "projectName": project_name,
        "inputs": [
            {"address": "%I0.0", "symbol": "START_BTN", "comment": "Start Button"},
            {"address": "%I0.1", "symbol": "STOP_BTN", "comment": "Stop Button"},
        ],
        "outputs": [
            {"address": "%Q0.0", "symbol": "MOTOR_RUN", "comment": "Motor Output"},
            {"address": "%Q0.1", "symbol": "RUN_LIGHT", "comment": "Running Indicator"},
        ],
        "memory": [
            {"address": "%M0", "symbol": "MOTOR_RUN", "comment": "Motor seal-in"},
        ],
        "timers": [],
        "rungs": [
            {
                "name": "Motor Start/Stop",
                "comment": "Seal-in motor control",
                "il": ["LD %I0.0", "OR %M0", "ANDN %I0.1", "ST %M0"],
                "ladder": "Motor start/stop with seal-in",
            },
            {
                "name": "Motor Output",
                "comment": "Drive motor contactor",
                "il": ["LD %M0", "ST %Q0.0"],
                "ladder": "Motor output follows run flag",
            },
            {
                "name": "Run Light",
                "comment": "Running indicator",
                "il": ["LD %M0", "ST %Q0.1"],
                "ladder": "Indicator follows motor",
            },
        ],
    }


def parse_program_data(raw: dict[str, Any] | str, project_name: str | None = None) -> M221ProgramData:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            raw = default_m221_program(project_name or "M221_Program")
    if not isinstance(raw, dict):
        raw = default_m221_program(project_name or "M221_Program")
    if project_name:
        raw = {**raw, "projectName": project_name}
    if not raw.get("rungs"):
        raw = default_m221_program(raw.get("projectName", project_name or "M221_Program"))
    return M221ProgramData.model_validate(raw)


class M221SmbpBuilder:
    def build(
        self,
        program_data: dict[str, Any] | str,
        plc_model: str,
        project_name: str | None = None,
    ) -> dict[str, Any]:
        data = parse_program_data(program_data, project_name)
        content = render_calaos_smbp_from_data(data, plc_model)
        content_bytes = content.encode("utf-8")

        return {
            "fileName": f"{data.projectName}.smbp",
            "mimeType": "application/xml",
            "contentBase64": base64.standard_b64encode(content_bytes).decode("ascii"),
            "programData": data.model_dump(),
            "metadata": {
                "platform": "schneider_m221",
                "format": "machine_expert_basic_xml",
                "plcModel": plc_model,
                "template": CALAOS_TEMPLATE.name,
            },
        }

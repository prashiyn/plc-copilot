import base64
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from api.services.ir_service import IrService

SAMPLES_DIR = Path(__file__).resolve().parents[2] / "samples"
GOLDEN_PLCOPEN = SAMPLES_DIR / "MotorControl_Universal.xml"


@pytest.fixture
def service():
    return IrService()


def _plcopen_variable_names(root: ET.Element) -> list[str]:
    names: list[str] = []
    for variable in root.iter("{http://www.plcopen.org/xml/tc6_0201}variable"):
        name = variable.get("name")
        if name:
            names.append(name)
    if not names:
        for variable in root.iter("variable"):
            name = variable.get("name")
            if name:
                names.append(name)
    return sorted(set(names))


def _plcopen_ld_symbols(root: ET.Element) -> dict[str, list[str]]:
    contacts: list[str] = []
    coils: list[str] = []
    for element in root.iter():
        tag = element.tag.split("}")[-1]
        if tag == "contact":
            var = element.findtext("variable")
            if var:
                contacts.append(var)
        if tag == "coil":
            var = element.findtext("variable")
            if var:
                coils.append(var)
    return {
        "contacts": sorted(contacts),
        "coils": sorted(coils),
    }


class TestPlcopenGolden:
    def test_generated_plcopen_matches_golden_structure(self, service):
        payload = service.get_pattern_ir(
            "motor_startstop",
            project_name="MotorControl_Universal",
            vendor="codesys",
            model="Generic",
        )
        program = payload["program"]
        program["target"] = {"vendor": "codesys", "model": "Generic"}
        result = service.serialize_plcopen(program)
        generated_root = ET.fromstring(base64.standard_b64decode(result["contentBase64"]))
        golden_root = ET.fromstring(GOLDEN_PLCOPEN.read_text(encoding="utf-8"))

        assert _plcopen_variable_names(generated_root) == _plcopen_variable_names(golden_root)
        assert _plcopen_ld_symbols(generated_root) == _plcopen_ld_symbols(golden_root)

        generated_text = ET.tostring(generated_root, encoding="unicode")
        for marker in (
            "plcopen.org/xml/tc6_0201",
            'name="MainProgram"',
            "START_BTN",
            "STOP_BTN",
            "MOTOR_RUN",
            "GREEN_LED",
        ):
            assert marker in generated_text

import base64
import xml.etree.ElementTree as ET

import pytest

from api.services.ir_service import IrService
from plc_file_handler.parsers.rockwell_parser import RockwellParser


@pytest.fixture
def service():
    return IrService()


def _motor_l5x_bytes(service: IrService) -> bytes:
    payload = service.get_pattern_ir(
        "motor_startstop",
        project_name="SchemaMotor",
        vendor="rockwell",
        model="1769-L33ER",
    )
    result = service.serialize(payload["program"])
    assert result["fileName"].endswith(".L5X")
    return base64.standard_b64decode(result["contentBase64"])


class TestL5xSchema:
    def test_l5x_is_well_formed_xml(self, service, tmp_path):
        raw = _motor_l5x_bytes(service)
        path = tmp_path / "SchemaMotor.L5X"
        path.write_bytes(raw)

        root = ET.fromstring(raw.decode("utf-8"))
        assert root.tag == "RSLogix5000Content"
        assert root.get("TargetType") == "Controller"

    def test_l5x_contains_required_controller_structure(self, service, tmp_path):
        raw = _motor_l5x_bytes(service)
        text = raw.decode("utf-8")

        for marker in (
            "<Controller",
            "<Tags>",
            "<Programs>",
            "<Routine",
            "MainProgram",
            "START_BTN",
            "MOTOR_RUN",
        ):
            assert marker in text

    def test_l5x_parses_with_rockwell_parser(self, service, tmp_path):
        raw = _motor_l5x_bytes(service)
        path = tmp_path / "SchemaMotor.L5X"
        path.write_bytes(raw)

        parsed = RockwellParser(str(path)).parse()
        tag_names = {tag["name"] for tag in parsed.get("tags", [])}
        assert {"START_BTN", "STOP_BTN", "MOTOR_RUN", "GREEN_LED"}.issubset(tag_names)
        assert parsed.get("platform", "").startswith("rockwell")

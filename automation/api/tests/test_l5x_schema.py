import base64

import pytest

from api.ir.patterns import PATTERN_CATALOG
from api.services.ir_service import IrService
from api.validation.xsd_validate import validate_l5x
from plc_file_handler.parsers.rockwell_parser import RockwellParser

ROCKWELL_PATTERNS = [
    pattern_id
    for pattern_id, meta in PATTERN_CATALOG.items()
    if "rockwell" in meta.get("vendors", [])
]


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


@pytest.fixture
def service():
    return IrService()


class TestL5xSchema:
    def test_l5x_is_well_formed_xml(self, service, tmp_path):
        raw = _motor_l5x_bytes(service)
        path = tmp_path / "SchemaMotor.L5X"
        path.write_bytes(raw)

        import xml.etree.ElementTree as ET

        root = ET.fromstring(raw.decode("utf-8"))
        assert root.tag == "RSLogix5000Content"
        assert root.get("TargetType") == "Controller"

    def test_l5x_contains_required_controller_structure(self, service):
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

    def test_motor_l5x_passes_v32_xsd(self, service):
        raw = _motor_l5x_bytes(service)
        errors = validate_l5x(raw)
        assert errors == [], errors

    @pytest.mark.parametrize("pattern", ROCKWELL_PATTERNS)
    def test_all_rockwell_patterns_pass_v32_xsd(self, service, pattern):
        payload = service.get_pattern_ir(
            pattern,
            project_name=f"Schema_{pattern}",
            vendor="rockwell",
            model="1769-L33ER",
            num_lights=4,
            delay_seconds=3,
            cycle_seconds=5,
        )
        result = service.serialize(payload["program"])
        raw = base64.standard_b64decode(result["contentBase64"])
        errors = validate_l5x(raw)
        assert errors == [], f"{pattern}: {errors}"

    def test_invalid_l5x_fails_xsd(self):
        errors = validate_l5x(b"<RSLogix5000Content><Controller></RSLogix5000Content>")
        assert errors

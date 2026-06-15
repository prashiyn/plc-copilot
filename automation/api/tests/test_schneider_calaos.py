import base64

import pytest

from api.ir.patterns import build_pattern
from api.ir.serializers.schneider_calaos import (
    CALAOS_STRUCTURE_MARKERS,
    CALAOS_TEMPLATE,
    calaos_structure_markers_present,
    render_calaos_smbp_from_program,
)
from api.ir.serializer import IrSerializer
from api.services.ir_service import IrService
from api.services.m221_program_service import M221ProgramService
from api.services.m221_smbp_builder import M221SmbpBuilder, default_m221_program
from plc_file_handler.parsers.schneider_parser import SchneiderParser

GOLDEN = CALAOS_TEMPLATE


@pytest.fixture
def service():
    return IrService()


@pytest.fixture
def serializer():
    return IrSerializer()


@pytest.fixture
def motor_program():
    return build_pattern(
        "motor_startstop",
        project_name="CalaosMotor",
        vendor="schneider",
        model="TM221CE16T",
    )


@pytest.fixture
def sequential_program():
    return build_pattern(
        "sequential_lights",
        project_name="CalaosSeq",
        vendor="schneider",
        model="TM221CE16T",
        num_lights=4,
        delay_seconds=3,
    )


class TestSchneiderCalaosRenderer:
    def test_motor_program_has_calaos_namespace(self, motor_program):
        xml = render_calaos_smbp_from_program(motor_program, "TM221CE16T")
        assert 'xmlns="http://www.schneider-electric.com/Calaos/Case/2.0"' in xml
        assert calaos_structure_markers_present(xml)

    def test_motor_program_matches_tankcontrol_structure(self, motor_program):
        xml = render_calaos_smbp_from_program(motor_program, "TM221CE16T")
        golden = GOLDEN.read_text(encoding="utf-8")
        for marker in CALAOS_STRUCTURE_MARKERS:
            assert marker in xml
            assert marker in golden

    def test_sequential_program_renders_calaos(self, sequential_program):
        xml = render_calaos_smbp_from_program(sequential_program, "TM221CE16T")
        assert "Calaos/Case/2.0" in xml
        assert "START_BTN" in xml
        assert "LIGHT1" in xml
        assert "SEQ_RUN" in xml

    def test_default_m221_json_uses_same_builder(self):
        result = M221SmbpBuilder().build(default_m221_program("JsonMotor"), "TM221CE16T")
        xml = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        assert result["metadata"]["format"] == "machine_expert_basic_xml"
        assert calaos_structure_markers_present(xml)


class TestSchneiderCalaosIntegration:
    def test_ir_serialize_motor_is_xml_not_zip(self, service, motor_program):
        result = service.serialize(motor_program.model_dump())
        raw = base64.standard_b64decode(result["contentBase64"])
        assert result["metadata"]["format"] == "machine_expert_basic_xml"
        assert result["mimeType"] == "application/xml"
        assert raw[:1] == b"<"
        assert b"PK" != raw[:2]

    def test_ir_serialize_sequential_uses_same_path(self, service, sequential_program):
        result = service.serialize(sequential_program.model_dump())
        xml = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        assert result["metadata"]["format"] == "machine_expert_basic_xml"
        assert "Calaos/Case/2.0" in xml

    def test_roundtrip_motor_and_sequential(self, service, motor_program, sequential_program):
        for program in (motor_program, sequential_program):
            result = service.roundtrip(program.model_dump())
            assert result["roundtrip"]["ok"] is True
            assert result["metadata"]["format"] == "machine_expert_basic_xml"

    def test_m221_ai_path_matches_ir_path(self, service, motor_program, monkeypatch):
        captured = {}

        def fake_generate_ir(self, description, vendor="schneider", model="TM221CE16T", project_name=None):
            captured["description"] = description
            return {
                "program": motor_program.model_dump(),
                "source": "claude",
                "attempts": 1,
                "pattern": None,
                "fallbackReason": None,
                "summary": {},
            }

        from api.services.claude_ir_service import ClaudeIrService

        monkeypatch.setattr(ClaudeIrService, "generate_program_ir", fake_generate_ir)

        ir_result = service.serialize(motor_program.model_dump())
        m221_result = M221ProgramService().generate_from_description(
            "Motor start stop",
            "TM221CE16T",
            "CalaosMotor",
        )

        ir_xml = base64.standard_b64decode(ir_result["contentBase64"]).decode("utf-8")
        m221_xml = base64.standard_b64decode(m221_result["contentBase64"]).decode("utf-8")
        assert captured["description"] == "Motor start stop"
        assert calaos_structure_markers_present(ir_xml)
        assert calaos_structure_markers_present(m221_xml)
        assert "LD %I0.0" in ir_xml
        assert "LD %I0.0" in m221_xml

    def test_generated_files_parse_with_schneider_parser(self, service, motor_program, tmp_path):
        result = service.serialize(motor_program.model_dump())
        path = tmp_path / result["fileName"]
        path.write_bytes(base64.standard_b64decode(result["contentBase64"]))
        project = SchneiderParser(str(path)).parse()
        assert project["platform"] == "schneider_m221"
        assert len(project["tags"]) >= 2

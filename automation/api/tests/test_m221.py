import base64

import pytest

from api.services.m221_program_service import M221ProgramService
from api.services.m221_smbp_builder import M221SmbpBuilder, default_m221_program
from plc_file_handler.parsers.schneider_parser import SchneiderParser

SAMPLES_DIR = __import__("pathlib").Path(__file__).resolve().parents[2] / "samples"
GOLDEN = SAMPLES_DIR / "tankcontrol.smbp"


@pytest.fixture
def builder():
    return M221SmbpBuilder()


@pytest.fixture
def service():
    return M221ProgramService()


class TestM221SmbpBuilder:
    def test_build_default_motor_program(self, builder, tmp_path):
        result = builder.build(default_m221_program("Motor_Test"), "TM221CE16T")
        raw = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")

        assert 'xmlns="http://www.schneider-electric.com/Calaos/Case/2.0"' in raw
        assert "<POU Name=" in raw
        assert "<Rungs>" in raw
        assert "<Device>" in raw
        assert "TM221CE16T" in raw
        assert "Motor_Test.smbp" in raw
        assert result["fileName"] == "Motor_Test.smbp"
        assert result["metadata"]["format"] == "machine_expert_basic_xml"

    def test_structure_matches_tankcontrol(self, builder):
        result = builder.build(default_m221_program("StructureTest"), "TM221CE16T")
        generated = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        golden = GOLDEN.read_text(encoding="utf-8")

        for marker in (
            'xmlns="http://www.schneider-electric.com/Calaos/Case/2.0"',
            "<FileHeader Company=\"Schneider Electric\"",
            "<Workspace>",
            "<Project>",
            "<body>",
            "<LD>",
            "<Rungs>",
            "<Configuration>",
            "<GlobalVars name=\"GlobalVariables\">",
        ):
            assert marker in generated
            assert marker in golden

    def test_build_parses_with_schneider_parser(self, builder, tmp_path):
        result = builder.build(default_m221_program("ParseTest"), "TM221CE16T")
        path = tmp_path / result["fileName"]
        path.write_bytes(base64.standard_b64decode(result["contentBase64"]))

        parser = SchneiderParser(str(path))
        project = parser.parse()
        assert project["platform"] == "schneider_m221"
        assert len(project["tags"]) >= 2

    def test_round_trip_via_program_service(self, service, tmp_path):
        payload = default_m221_program("ServiceTest")
        result = service.build_from_json(payload, "TM221CE24T", "ServiceTest")
        xml = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        assert "TM221CE24T" in xml
        assert result["programData"]["projectName"] == "ServiceTest"
        assert len(result["programData"]["rungs"]) >= 1

    def test_invalid_json_falls_back_to_default(self, builder):
        result = builder.build("{not json", "TM221CE16T", "Fallback")
        assert result["programData"]["projectName"] == "Fallback"
        xml = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        assert "START_BTN" in xml or "%I0.0" in xml


class TestM221GenerateMocked:
    def test_generate_from_description_uses_builder(self, service, monkeypatch):
        captured = {}

        from api.ir.patterns import build_pattern
        from api.services.claude_ir_service import ClaudeIrService

        def fake_generate_ir(self, description, vendor="schneider", model="TM221CE16T", project_name=None):
            captured["description"] = description
            captured["plc_model"] = model
            program = build_pattern(
                "motor_startstop",
                project_name=project_name or "AiMotor",
                vendor=vendor,
                model=model,
            )
            return {
                "program": program.model_dump(),
                "source": "claude",
                "attempts": 1,
                "pattern": None,
                "fallbackReason": None,
                "summary": {},
            }

        monkeypatch.setattr(ClaudeIrService, "generate_program_ir", fake_generate_ir)

        result = service.generate_from_description(
            "Motor start stop with seal-in",
            "TM221CE16T",
            "AiMotor",
        )
        assert captured["description"] == "Motor start stop with seal-in"
        assert result["programData"]["projectName"] == "AiMotor"
        assert result["ir"]["name"] == "AiMotor"
        assert result["metadata"]["irSource"] == "claude"
        xml = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        assert "Calaos/Case/2.0" in xml


class TestM221GoldenCompare:
    def test_generated_file_parseable_like_sample(self, builder):
        sample_parser = SchneiderParser(str(GOLDEN))
        sample = sample_parser.parse()

        built = builder.build(default_m221_program("GoldenCompare"), "TM221CE16T")
        import tempfile
        import os

        with tempfile.NamedTemporaryFile(suffix=".smbp", delete=False) as handle:
            handle.write(base64.standard_b64decode(built["contentBase64"]))
            temp_path = handle.name

        try:
            generated = SchneiderParser(temp_path).parse()
        finally:
            os.remove(temp_path)

        assert generated["platform"] == sample["platform"]
        assert len(generated["tags"]) >= 1

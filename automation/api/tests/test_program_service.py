import base64
import io
import zipfile
from pathlib import Path

import pytest

from api.ir.serializer import SAMPLES_DIR, SEQUENTIAL_TEMPLATE
from api.services.program_service import ProgramService

GOLDEN_PLCOPEN = SAMPLES_DIR / "MotorControl_Universal.xml"


@pytest.fixture
def service():
    return ProgramService()


class TestProgramGenerate:
    def test_motor_startstop_schneider_round_trip(self, service, tmp_path):
        result = service.generate({
            "platform": "schneider",
            "controller": "TM221CE24R",
            "projectName": "MotorTest",
            "source": {"type": "pattern", "pattern": "motor_startstop"},
        })
        assert result["fileName"] == "MotorTest.smbp"
        assert result["metadata"]["pattern"] == "motor_startstop"

        raw = base64.standard_b64decode(result["contentBase64"])
        out = tmp_path / result["fileName"]
        out.write_bytes(raw)
        xml = raw.decode("utf-8")
        assert "Calaos/Case/2.0" in xml
        assert "MotorTest.smbp" in xml
        assert result["metadata"]["format"] == "machine_expert_basic_xml"

        parsed = service.parse(str(out))
        assert parsed["platform"] == "schneider_m221"
        tag_names = {t.get("name") for t in parsed["project"]["tags"]}
        assert "START_BTN" in tag_names

    def test_motor_startstop_rockwell_round_trip(self, service, tmp_path):
        result = service.generate({
            "platform": "rockwell",
            "controller": "1769-L33ER",
            "projectName": "MotorRockwell",
            "source": {"type": "pattern", "pattern": "motor_startstop"},
        })
        assert result["fileName"] == "MotorRockwell.L5X"

        raw = base64.standard_b64decode(result["contentBase64"])
        out = tmp_path / result["fileName"]
        out.write_bytes(raw)
        assert out.read_text(encoding="utf-8").startswith("<?xml")

        parsed = service.parse(str(out))
        assert parsed["platform"] == "rockwell_logix"
        tag_names = {t["name"] for t in parsed["project"]["tags"]}
        assert {"START_BTN", "STOP_BTN", "MOTOR_RUN", "GREEN_LED"}.issubset(tag_names)

    def test_sequential_lights_schneider(self, service, tmp_path):
        assert SEQUENTIAL_TEMPLATE.is_file()
        result = service.generate({
            "platform": "schneider",
            "controller": "TM221CE16T",
            "projectName": "SeqLights",
            "source": {
                "type": "pattern",
                "pattern": "sequential_lights",
                "numLights": 4,
                "delaySeconds": 3,
            },
        })
        assert result["fileName"] == "SeqLights.smbp"
        raw = base64.standard_b64decode(result["contentBase64"])
        content = raw.decode("utf-8")
        assert "Calaos/Case/2.0" in content
        assert "SeqLights" in content
        assert result["metadata"]["format"] == "machine_expert_basic_xml"

        out = tmp_path / result["fileName"]
        out.write_bytes(raw)
        parsed = service.parse(str(out))
        assert parsed["platform"] == "schneider_m221"
        assert len(parsed["project"]["tags"]) >= 2

    def test_sequential_lights_rockwell(self, service, tmp_path):
        result = service.generate({
            "platform": "rockwell",
            "controller": "1769-L33ER",
            "projectName": "SeqRockwell",
            "source": {"type": "pattern", "pattern": "sequential_lights", "numLights": 4},
        })
        raw = base64.standard_b64decode(result["contentBase64"])
        out = tmp_path / result["fileName"]
        out.write_bytes(raw)
        parsed = service.parse(str(out))
        tag_names = {t["name"] for t in parsed["project"]["tags"]}
        assert "LIGHT1" in tag_names
        assert "LIGHT4" in tag_names


class TestProgramPlcopen:
    def test_motor_startstop_plcopen_matches_golden_structure(self, service):
        result = service.generate_plcopen({
            "name": "MotorControl_Universal",
            "platform": "universal",
            "pattern": "motor_startstop",
        })
        generated = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        golden = GOLDEN_PLCOPEN.read_text(encoding="utf-8")

        for marker in (
            'xmlns="http://www.plcopen.org/xml/tc6_0201"',
            'name="MainProgram"',
            "START_BTN",
            "STOP_BTN",
            "MOTOR_RUN",
            "GREEN_LED",
        ):
            assert marker in generated
            assert marker in golden

    def test_sequential_lights_plcopen_exports(self, service):
        result = service.generate_plcopen({
            "name": "Seq",
            "platform": "universal",
            "pattern": "sequential_lights",
            "numLights": 4,
            "delaySeconds": 3,
        })
        generated = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        assert "LIGHT1" in generated
        assert "LIGHT4" in generated
        assert "SEQ_RUN" in generated


class TestProgramParse:
    def test_parse_tankcontrol_sample(self, service):
        sample = SAMPLES_DIR / "tankcontrol.smbp"
        assert sample.is_file()
        result = service.parse(str(sample))
        assert result["format"] == "machine_expert_basic_xml"
        assert result["platform"] == "schneider_m221"
        assert len(result["project"]["tags"]) >= 2
        assert "START_BTN" in result["summary"] or any(
            t.get("name") == "START_BTN" for t in result["project"]["tags"]
        )

    def test_parse_generated_rockwell(self, service, tmp_path):
        gen_result = service.generate({
            "platform": "rockwell",
            "controller": "1769-L33ER",
            "projectName": "ParseMe",
            "source": {"type": "pattern", "pattern": "motor_startstop"},
        })
        raw = base64.standard_b64decode(gen_result["contentBase64"])
        path = tmp_path / "ParseMe.L5X"
        path.write_bytes(raw)
        result = service.parse(str(path))
        assert result["format"] == "studio5000_xml"
        assert len(result["project"]["programs"]) >= 1


class TestProgramGenerateClaudeIr:
    def test_claude_ir_source_attaches_metadata(self, service, monkeypatch):
        from api.ir.patterns import build_pattern
        from api.services.claude_ir_service import ClaudeIrService

        def fake_generate_ir(self, description, vendor="schneider", model="TM221CE24R", project_name=None, synthesis_mode="constrained"):
            program = build_pattern(
                "motor_startstop",
                project_name=project_name or "ClaudeMotor",
                vendor=vendor,
                model=model,
            )
            return {
                "program": program.model_dump(),
                "source": "pattern_fallback",
                "attempts": 2,
                "pattern": "motor_startstop",
                "fallbackReason": "validation_failed",
                "summary": {},
            }

        monkeypatch.setattr(ClaudeIrService, "generate_program_ir", fake_generate_ir)

        result = service.generate({
            "platform": "schneider",
            "controller": "TM221CE24R",
            "projectName": "ClaudeMotor",
            "source": {"type": "claude_ir", "description": "Motor with seal-in"},
        })
        assert result["fileName"] == "ClaudeMotor.smbp"
        assert result["metadata"]["ir"]["name"] == "ClaudeMotor"
        assert result["metadata"]["irSource"] == "pattern_fallback"
        assert result["metadata"]["irAttempts"] == 2
        assert result["metadata"]["irPattern"] == "motor_startstop"
        assert result["metadata"]["irFallbackReason"] == "validation_failed"


class TestProgramGenerateSiemens:
    def test_motor_startstop_siemens_scl(self, service):
        result = service.generate({
            "platform": "siemens",
            "controller": "S7-1200",
            "projectName": "SiemensMotor",
            "source": {"type": "pattern", "pattern": "motor_startstop"},
        })
        assert result["fileName"] == "SiemensMotor.scl"
        assert result["metadata"]["format"] == "scl"
        assert result["metadata"]["tier"] == 2
        scl = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        assert "START_BTN" in scl
        assert "STOP_BTN" in scl
        assert "MOTOR_RUN" in scl
        assert "not a TIA Portal project" in scl


class TestProgramGenerateMitsubishi:
    def test_motor_startstop_mitsubishi_zip(self, service):
        result = service.generate({
            "platform": "mitsubishi",
            "controller": "FX5U",
            "projectName": "MitsubishiApiMotor",
            "source": {"type": "pattern", "pattern": "motor_startstop"},
        })
        assert result["fileName"] == "MitsubishiApiMotor_mitsubishi.zip"
        assert result["metadata"]["format"] == "mitsubishi_tier2_zip"
        assert result["metadata"]["tier"] == 2
        assert result["metadata"]["limitations"]
        raw = base64.standard_b64decode(result["contentBase64"])
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            il_text = archive.read("MitsubishiApiMotor.il").decode("utf-8")
        assert "MOTOR_RUN=Y00" in il_text
        assert "not a GX Works project" in il_text

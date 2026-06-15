"""Phase 4i — sketch analysis → PlcProgram IR → vendor export."""

import base64
import json
from pathlib import Path

import pytest

from api.ir.sketch_adapter import SketchAdapterError, sketch_analysis_to_ir
from api.ir.validator import validate_program
from api.services.ir_service import IrService
from api.services.program_service import ProgramService

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "sketch"
MOTOR_FIXTURE = FIXTURES_DIR / "motor_startstop_analysis.json"


@pytest.fixture
def motor_analysis() -> dict:
    return json.loads(MOTOR_FIXTURE.read_text(encoding="utf-8"))


@pytest.fixture
def program_service():
    return ProgramService()


@pytest.fixture
def ir_service():
    return IrService()


class TestSketchAdapter:
    def test_motor_fixture_builds_valid_ir(self, motor_analysis):
        program = sketch_analysis_to_ir(
            motor_analysis,
            project_name="SketchMotor",
            vendor="schneider",
            model="TM221CE24R",
        )
        assert program.name == "SketchMotor"
        assert program.target.vendor == "schneider"
        assert program.meta.pattern is None
        assert program.meta.patternParams.get("source") == "sketch_analysis"
        symbols = {var.symbol for var in program.vars}
        assert {"START_BTN", "STOP_BTN", "MOTOR_RUN", "GREEN_LED"} <= symbols
        assert len(program.pous[0].networks) == 2

    def test_seal_in_rung_uses_or_logic(self, motor_analysis):
        program = sketch_analysis_to_ir(
            motor_analysis,
            project_name="SealIn",
            vendor="schneider",
            model="TM221CE24R",
        )
        rung1 = program.pous[0].networks[0].logic
        assert rung1.type == "and"
        assert any(node.type == "or" for node in rung1.inputs)

    def test_analysis_error_raises(self):
        with pytest.raises(SketchAdapterError, match="Failed to parse"):
            sketch_analysis_to_ir(
                {"error": "Failed to parse Claude response"},
                project_name="Bad",
                vendor="schneider",
                model="TM221CE24R",
            )

    def test_missing_rungs_raises(self):
        with pytest.raises(SketchAdapterError, match="at least one rung"):
            sketch_analysis_to_ir(
                {"tags_detected": [], "rungs": []},
                project_name="Empty",
                vendor="schneider",
                model="TM221CE24R",
            )


class TestSketchProgramGenerate:
    def test_schneider_sketch_analysis_returns_ir_metadata(self, program_service, motor_analysis, tmp_path):
        result = program_service.generate(
            {
                "platform": "schneider",
                "controller": "TM221CE24R",
                "projectName": "SketchSchneider",
                "source": {"type": "sketch_analysis", "analysis": motor_analysis},
            }
        )
        assert result["fileName"] == "SketchSchneider.smbp"
        assert result["metadata"]["source"] == "sketch_analysis"
        assert "ir" in result["metadata"]
        assert result["metadata"]["ir"]["name"] == "SketchSchneider"
        assert result["metadata"]["sketchConfidence"] == 0.9

        raw = base64.standard_b64decode(result["contentBase64"])
        out = tmp_path / result["fileName"]
        out.write_bytes(raw)
        parsed = program_service.parse(str(out))
        tag_names = {tag.get("name") for tag in parsed["project"]["tags"]}
        assert "START_BTN" in tag_names
        assert "MOTOR_RUN" in tag_names

    def test_rockwell_sketch_analysis_roundtrip(self, program_service, motor_analysis, tmp_path):
        rockwell_analysis = dict(motor_analysis)
        rockwell_analysis["target_platform"] = "rockwell"
        for tag in rockwell_analysis["tags_detected"]:
            tag.pop("address", None)

        result = program_service.generate(
            {
                "platform": "rockwell",
                "controller": "1769-L33ER",
                "projectName": "SketchRockwell",
                "source": {"type": "sketch_analysis", "analysis": rockwell_analysis},
            }
        )
        assert result["fileName"] == "SketchRockwell.L5X"
        assert result["metadata"]["ir"]["target"]["vendor"] == "rockwell"

        raw = base64.standard_b64decode(result["contentBase64"])
        out = tmp_path / result["fileName"]
        out.write_bytes(raw)
        parsed = program_service.parse(str(out))
        tag_names = {tag["name"] for tag in parsed["project"]["tags"]}
        assert {"START_BTN", "STOP_BTN", "MOTOR_RUN", "GREEN_LED"}.issubset(tag_names)

    def test_ir_service_roundtrip_from_sketch(self, ir_service, motor_analysis):
        program = sketch_analysis_to_ir(
            motor_analysis,
            project_name="SketchRoundtrip",
            vendor="schneider",
            model="TM221CE24R",
        )
        payload = validate_program(program).model_dump()
        result = ir_service.roundtrip(payload)
        assert result["roundtrip"]["ok"] is True
        assert result["fileName"].endswith(".smbp")


class TestSketchServiceIntegration:
    def test_generate_from_sketch_uses_ir_pipeline(self, motor_analysis, monkeypatch, tmp_path):
        from api.services import sketch_service

        class FakeAnalyzer:
            def analyze_sketch(self, image_path, platform):
                return motor_analysis

            def validate_analysis(self, analysis):
                return []

        monkeypatch.setattr(sketch_service, "SketchAnalyzer", FakeAnalyzer)

        image_path = tmp_path / "sketch.png"
        image_path.write_bytes(b"\x89PNG\r\n")

        result = sketch_service.SketchService().generate_from_sketch(
            str(image_path),
            project_name="ServiceSketch",
            controller="TM221CE24R",
            platform="schneider",
        )
        assert result["fileName"] == "ServiceSketch.smbp"
        assert result["metadata"]["source"] == "sketch_analysis"
        assert result["metadata"]["ir"]["name"] == "ServiceSketch"

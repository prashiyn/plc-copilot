"""Phase 5 P2 — export scope expansion tests."""

from __future__ import annotations

import base64
import io
import xml.etree.ElementTree as ET
import zipfile

import pytest

from api.ir.patterns import build_pattern
from api.ir.validator import EXPORT_PATTERNS
from api.services.ir_service import IrService
from api.services.program_service import ProgramService, SKETCH_EXPORT_PLATFORMS

PATTERNS = sorted(EXPORT_PATTERNS)
TIER2_VENDORS = ("siemens", "mitsubishi")
SKETCH_FIXTURE = (
    __import__("pathlib").Path(__file__).resolve().parent / "fixtures" / "sketch" / "motor_startstop_analysis.json"
)


@pytest.fixture
def service():
    return IrService()


@pytest.fixture
def program_service():
    return ProgramService()


@pytest.fixture
def motor_analysis():
    import json

    return json.loads(SKETCH_FIXTURE.read_text(encoding="utf-8"))


def _plcopen_symbols(content: bytes) -> set[str]:
    root = ET.fromstring(content)
    symbols: set[str] = set()
    for variable in root.iter():
        if variable.tag.split("}")[-1] == "variable":
            name = variable.get("name")
            if name:
                symbols.add(name)
        if variable.tag.split("}")[-1] in {"contact", "coil"}:
            var = variable.findtext("variable")
            if var:
                symbols.add(var)
    return symbols


def _pattern_kwargs(pattern: str) -> dict:
    if pattern == "sequential_lights":
        return {"num_lights": 4, "delay_seconds": 3}
    if pattern == "traffic_lights":
        return {"cycle_seconds": 5}
    return {}


def _build_pattern(pattern: str, vendor: str):
    return build_pattern(
        pattern,
        project_name=f"P2_{pattern}_{vendor}",
        vendor=vendor,
        model={"siemens": "S7-1200", "mitsubishi": "FX5U", "codesys": "Generic"}.get(vendor, "TM221CE24R"),
        **_pattern_kwargs(pattern),
    )


class TestTier2AllPatterns:
    @pytest.mark.parametrize("pattern", PATTERNS)
    def test_siemens_scl_exports_without_error(self, service, pattern):
        program = _build_pattern(pattern, "siemens")
        result = service.serialize(program.model_dump())
        scl = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        assert result["metadata"]["format"] == "scl"
        assert 'ORGANIZATION_BLOCK "Main"' in scl
        for var in program.vars:
            assert var.symbol in scl

    @pytest.mark.parametrize("pattern", PATTERNS)
    def test_siemens_roundtrip_ok(self, service, pattern):
        program = _build_pattern(pattern, "siemens")
        result = service.roundtrip(program.model_dump())
        assert result["roundtrip"]["ok"] is True
        assert not result["roundtrip"]["missingSymbols"]

    @pytest.mark.parametrize("pattern", PATTERNS)
    def test_mitsubishi_zip_exports_without_error(self, service, pattern):
        program = _build_pattern(pattern, "mitsubishi")
        result = service.serialize(program.model_dump())
        assert result["metadata"]["format"] == "mitsubishi_tier2_zip"
        raw = base64.standard_b64decode(result["contentBase64"])
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            names = set(archive.namelist())
            assert any(name.endswith(".st") for name in names)
            st_name = next(name for name in names if name.endswith(".st"))
            il_name = next(name for name in names if name.endswith(".il"))
            st_text = archive.read(st_name).decode("utf-8")
            il_text = archive.read(il_name).decode("utf-8")
        for var in program.vars:
            if var.kind in {"input", "output", "memory"}:
                assert var.symbol in il_text or var.symbol in st_text

    @pytest.mark.parametrize("pattern", PATTERNS)
    def test_mitsubishi_roundtrip_ok(self, service, pattern):
        program = _build_pattern(pattern, "mitsubishi")
        result = service.roundtrip(program.model_dump())
        assert result["roundtrip"]["ok"] is True
        assert not result["roundtrip"]["missingSymbols"]


class TestPlcopenAllPatterns:
    @pytest.mark.parametrize("pattern", PATTERNS)
    def test_plcopen_exports_all_pattern_variables(self, service, pattern):
        program = _build_pattern(pattern, "codesys")
        payload = program.model_dump()
        payload["target"] = {"vendor": "codesys", "model": "Generic"}
        result = service.serialize_plcopen(payload)
        content = base64.standard_b64decode(result["contentBase64"])
        symbols = _plcopen_symbols(content)
        for var in program.vars:
            assert var.symbol in symbols

    @pytest.mark.parametrize("pattern", PATTERNS)
    def test_program_service_plcopen_route(self, program_service, pattern):
        request = {
            "name": f"Plcopen_{pattern}",
            "platform": "universal",
            "pattern": pattern,
        }
        if pattern == "sequential_lights":
            request["numLights"] = 4
            request["delaySeconds"] = 3
        if pattern == "traffic_lights":
            request["cycleSeconds"] = 5
        result = program_service.generate_plcopen(request)
        assert result["metadata"]["format"] == "plcopen_xml"
        assert result["metadata"]["pattern"] == pattern

    def test_motor_plcopen_still_matches_golden_markers(self, program_service):
        result = program_service.generate_plcopen({
            "name": "MotorControl_Universal",
            "platform": "universal",
            "pattern": "motor_startstop",
        })
        generated = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        for marker in (
            'xmlns="http://www.plcopen.org/xml/tc6_0201"',
            'name="MainProgram"',
            "START_BTN",
            "STOP_BTN",
            "MOTOR_RUN",
            "GREEN_LED",
        ):
            assert marker in generated


class TestSketchTier2Export:
    @pytest.mark.parametrize("platform", sorted(SKETCH_EXPORT_PLATFORMS))
    def test_sketch_platform_allowed(self, platform):
        assert platform in SKETCH_EXPORT_PLATFORMS

    @pytest.mark.parametrize("platform", ["siemens", "mitsubishi"])
    def test_sketch_analysis_exports_tier2(self, program_service, motor_analysis, platform, tmp_path):
        controllers = {"siemens": "S7-1200", "mitsubishi": "FX5U"}
        result = program_service.generate({
            "platform": platform,
            "projectName": f"Sketch_{platform}",
            "controller": controllers[platform],
            "source": {"type": "sketch_analysis", "analysis": motor_analysis},
        })
        assert result["metadata"]["source"] == "sketch_analysis"
        assert result["metadata"]["platform"] == platform
        assert result["metadata"]["tier"] == 2
        raw = base64.standard_b64decode(result["contentBase64"])
        if platform == "siemens":
            assert b"ORGANIZATION_BLOCK" in raw
        else:
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                assert any(name.endswith(".st") for name in archive.namelist())

    def test_sketch_service_accepts_siemens(self, motor_analysis, monkeypatch, tmp_path):
        from api.services import sketch_service

        class FakeAnalyzer:
            def analyze_sketch(self, image_path, platform):
                return motor_analysis

            def validate_analysis(self, analysis):
                return []

        monkeypatch.setattr(sketch_service, "SketchAnalyzer", FakeAnalyzer)
        image_path = tmp_path / "sketch.png"
        image_path.write_bytes(b"png")
        result = sketch_service.SketchService().generate_from_sketch(
            str(image_path),
            project_name="SketchSiemens",
            controller="S7-1200",
            platform="siemens",
        )
        assert result["metadata"]["platform"] == "siemens"

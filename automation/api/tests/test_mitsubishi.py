import base64
import io
import zipfile

import pytest

from api.ir.patterns import build_pattern
from api.ir.serializers.mitsubishi import (
    build_mitsubishi_tier2_export,
    logic_to_mitsubishi_il,
    render_mitsubishi_csv,
)
from api.services.ir_service import IrService
from plc_file_handler.parsers.mitsubishi_parser import MitsubishiParser


@pytest.fixture
def service():
    return IrService()


@pytest.fixture
def motor_program():
    return build_pattern(
        "motor_startstop",
        project_name="MitsubishiMotor",
        vendor="mitsubishi",
        model="FX5U",
    )


@pytest.fixture
def mapped_bundle(motor_program):
    return build_mitsubishi_tier2_export(motor_program, "FX5U")


class TestMitsubishiRenderer:
    def test_bundle_contains_il_st_csv(self, mapped_bundle):
        assert mapped_bundle["ilFileName"] == "MitsubishiMotor.il"
        assert mapped_bundle["stFileName"] == "MitsubishiMotor.st"
        assert mapped_bundle["csvFileName"] == "MitsubishiMotor_device_comments.csv"
        assert "not a GX Works project" in mapped_bundle["il"]
        assert "START_BTN=X00" in mapped_bundle["il"]
        assert "STOP_BTN=X01" in mapped_bundle["il"]
        assert "MOTOR_RUN=Y00" in mapped_bundle["il"]
        assert "GREEN_LED=Y01" in mapped_bundle["il"]

    def test_motor_seal_in_il(self, motor_program, mapped_bundle):
        from api.ir.serializers.mitsubishi import _map_var
        from plc_file_handler.converters.platform_converter import PlatformConverter

        converter = PlatformConverter("schneider", "mitsubishi")
        mapped_vars = [_map_var(var, converter) for var in motor_program.vars]
        var_by_symbol = {var.symbol: var for var in motor_program.vars}
        network = motor_program.pous[0].networks[0]
        il_lines = logic_to_mitsubishi_il(network.logic, var_by_symbol, mapped_vars)
        assert il_lines == ["LD X00", "OR Y00", "ANI X01", "OUT Y00"]

    def test_motor_indicator_il(self, motor_program, mapped_bundle):
        from api.ir.serializers.mitsubishi import _map_var
        from plc_file_handler.converters.platform_converter import PlatformConverter

        converter = PlatformConverter("schneider", "mitsubishi")
        mapped_vars = [_map_var(var, converter) for var in motor_program.vars]
        var_by_symbol = {var.symbol: var for var in motor_program.vars}
        network = motor_program.pous[0].networks[1]
        il_lines = logic_to_mitsubishi_il(network.logic, var_by_symbol, mapped_vars)
        assert il_lines == ["LD Y00", "OUT Y01"]

    def test_st_assignments(self, mapped_bundle):
        st = mapped_bundle["st"]
        assert "Y00 := (X00 OR Y00) AND NOT X01;" in st
        assert "Y01 := Y00;" in st

    def test_csv_rows(self, motor_program):
        from api.ir.serializers.mitsubishi import _map_var
        from plc_file_handler.converters.platform_converter import PlatformConverter

        converter = PlatformConverter("schneider", "mitsubishi")
        mapped_vars = [_map_var(var, converter) for var in motor_program.vars]
        csv_text = render_mitsubishi_csv(mapped_vars)
        assert "Device,Symbol,Comment" in csv_text
        assert "X00,START_BTN,Start push button" in csv_text
        assert "Y00,MOTOR_RUN,Motor contactor" in csv_text

    def test_sequential_lights_rejected(self):
        program = build_pattern(
            "sequential_lights",
            project_name="Seq",
            vendor="mitsubishi",
            model="FX5U",
            num_lights=4,
            delay_seconds=3,
        )
        with pytest.raises(ValueError, match="motor_startstop"):
            build_mitsubishi_tier2_export(program, "FX5U")


class TestMitsubishiIntegration:
    def test_serialize_metadata(self, service, motor_program):
        result = service.serialize(motor_program.model_dump())
        assert result["fileName"] == "MitsubishiMotor_mitsubishi.zip"
        assert result["metadata"]["format"] == "mitsubishi_tier2_zip"
        assert result["metadata"]["tier"] == 2
        assert result["metadata"]["platform"] == "mitsubishi"
        assert result["metadata"]["formats"] == ["il", "st", "csv"]
        assert len(result["metadata"]["limitations"]) >= 3
        assert "GX Works" in result["metadata"]["disclaimer"]

    def test_zip_contents(self, service, motor_program):
        result = service.serialize(motor_program.model_dump())
        raw = base64.standard_b64decode(result["contentBase64"])
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            names = set(archive.namelist())
        assert names == {
            "MitsubishiMotor.il",
            "MitsubishiMotor.st",
            "MitsubishiMotor_device_comments.csv",
        }

    def test_roundtrip_symbol_presence(self, service, motor_program):
        result = service.roundtrip(motor_program.model_dump())
        assert result["roundtrip"]["ok"] is True
        assert result["roundtrip"]["platform"] == "mitsubishi_tier2"
        assert "START_BTN" in result["roundtrip"]["matchedSymbols"]
        assert "MOTOR_RUN" in result["roundtrip"]["matchedSymbols"]
        assert not result["roundtrip"]["missingSymbols"]

    def test_parser_reads_generated_zip(self, service, motor_program, tmp_path):
        serialized = service.serialize(motor_program.model_dump())
        path = tmp_path / serialized["fileName"]
        path.write_bytes(base64.standard_b64decode(serialized["contentBase64"]))
        parsed = MitsubishiParser(str(path)).parse()
        names = {tag["name"] for tag in parsed["tags"]}
        assert names == {"START_BTN", "STOP_BTN", "MOTOR_RUN", "GREEN_LED"}

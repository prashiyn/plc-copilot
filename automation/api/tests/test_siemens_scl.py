import base64

import pytest

from api.ir.patterns import build_pattern
from api.ir.serializers.siemens_scl import logic_expr, network_to_scl_statements, render_siemens_scl
from api.services.ir_service import IrService
from plc_file_handler.parsers.siemens_parser import SiemensParser


@pytest.fixture
def service():
    return IrService()


@pytest.fixture
def motor_program():
    return build_pattern(
        "motor_startstop",
        project_name="SclMotor",
        vendor="siemens",
        model="S7-1200",
    )


class TestSiemensSclRenderer:
    def test_motor_scl_contains_symbols_and_disclaimer(self, motor_program):
        scl = render_siemens_scl(motor_program, "S7-1200")
        assert "source import only, not a TIA Portal project" in scl
        assert "START_BTN AT %I0.0 : Bool" in scl
        assert "STOP_BTN AT %I0.1 : Bool" in scl
        assert "MOTOR_RUN AT %Q0.0 : Bool" in scl
        assert "GREEN_LED AT %Q0.1 : Bool" in scl
        assert 'ORGANIZATION_BLOCK "Main"' in scl

    def test_motor_seal_in_expression(self, motor_program):
        network = motor_program.pous[0].networks[0]
        statements = network_to_scl_statements(network)
        assert statements == ["MOTOR_RUN := (START_BTN OR MOTOR_RUN) AND NOT STOP_BTN;"]

    def test_indicator_rung_expression(self, motor_program):
        network = motor_program.pous[0].networks[1]
        statements = network_to_scl_statements(network)
        assert statements == ["GREEN_LED := MOTOR_RUN;"]

    def test_or_expression_parentheses(self):
        program = build_pattern("motor_startstop", project_name="OrTest", vendor="siemens", model="S7-1200")
        network = program.pous[0].networks[0]
        or_node = network.logic.inputs[0]
        assert logic_expr(or_node) == "(START_BTN OR MOTOR_RUN)"

    def test_sequential_lights_rejected(self):
        program = build_pattern(
            "sequential_lights",
            project_name="Seq",
            vendor="siemens",
            model="S7-1200",
            num_lights=4,
            delay_seconds=3,
        )
        with pytest.raises(ValueError, match="motor_startstop"):
            render_siemens_scl(program, "S7-1200")


class TestSiemensSclIntegration:
    def test_serialize_metadata(self, service, motor_program):
        result = service.serialize(motor_program.model_dump())
        assert result["fileName"] == "SclMotor.scl"
        assert result["metadata"]["format"] == "scl"
        assert result["metadata"]["tier"] == 2
        assert result["metadata"]["platform"] == "siemens"
        assert "source import" in result["metadata"]["disclaimer"]

    def test_roundtrip_symbol_presence(self, service, motor_program):
        result = service.roundtrip(motor_program.model_dump())
        assert result["roundtrip"]["ok"] is True
        assert result["roundtrip"]["platform"] == "siemens_scl"
        assert "START_BTN" in result["roundtrip"]["matchedSymbols"]
        assert "MOTOR_RUN" in result["roundtrip"]["matchedSymbols"]
        assert not result["roundtrip"]["missingSymbols"]

    def test_parser_reads_generated_scl(self, service, motor_program, tmp_path):
        serialized = service.serialize(motor_program.model_dump())
        path = tmp_path / serialized["fileName"]
        path.write_bytes(base64.standard_b64decode(serialized["contentBase64"]))
        parsed = SiemensParser(str(path)).parse()
        names = {tag["name"] for tag in parsed["tags"]}
        assert names == {"START_BTN", "STOP_BTN", "MOTOR_RUN", "GREEN_LED"}
        assert parsed["platform"] == "siemens_scl"

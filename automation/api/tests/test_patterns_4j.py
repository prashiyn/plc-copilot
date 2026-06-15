"""Phase 4j — expanded deterministic pattern library."""

import base64

import pytest

from api.ir.patterns import PATTERN_CATALOG, build_pattern, list_patterns
from api.ir.validator import IrValidationError, validate_program
from api.services.ir_service import IrService


@pytest.fixture
def service():
    return IrService()


class TestPatternCatalog:
    def test_catalog_lists_six_patterns(self):
        patterns = list_patterns()
        ids = {item["id"] for item in patterns}
        assert ids == set(PATTERN_CATALOG.keys())
        assert len(ids) == 6

    @pytest.mark.parametrize(
        "pattern",
        [
            "estop_motor",
            "tank_level",
            "conveyor_startstop",
            "traffic_lights",
        ],
    )
    def test_new_patterns_validate(self, pattern):
        program = build_pattern(
            pattern,
            project_name=f"Test_{pattern}",
            vendor="schneider",
            model="TM221CE24R",
        )
        validated = validate_program(program)
        assert validated.meta.pattern == pattern


class TestEstopMotor:
    def test_has_estop_nc_in_motor_rung(self):
        program = build_pattern(
            "estop_motor",
            project_name="EstopMotor",
            vendor="rockwell",
            model="1769-L33ER",
        )
        validated = validate_program(program)
        assert validated.meta.requireEstop is True
        symbols = {var.symbol for var in validated.vars}
        assert "ESTOP_BTN" in symbols
        rung1 = validated.pous[0].networks[0].logic
        assert rung1.type == "and"
        not_symbols = [
            node.input.symbol
            for node in rung1.inputs
            if node.type == "not" and node.input.type == "contact"
        ]
        assert "ESTOP_BTN" in not_symbols
        assert "STOP_BTN" in not_symbols


class TestTankLevel:
    def test_has_level_interlock_symbols(self):
        program = build_pattern(
            "tank_level",
            project_name="TankFill",
            vendor="schneider",
            model="TM221CE16T",
        )
        validated = validate_program(program)
        symbols = {var.symbol for var in validated.vars}
        assert {"TANK_LOW", "TANK_HIGH", "PUMP_RUN", "PUMP_OUTPUT", "AUTO_MODE"} <= symbols
        assert len(validated.pous[0].networks) == 3


class TestConveyorStartstop:
    def test_has_run_signal(self):
        program = build_pattern(
            "conveyor_startstop",
            project_name="Conveyor1",
            vendor="schneider",
            model="TM221CE24R",
        )
        validated = validate_program(program)
        symbols = {var.symbol for var in validated.vars}
        assert "CONVEYOR_RUN" in symbols
        assert "RUN_SIGNAL" in symbols


class TestTrafficLights:
    def test_three_phase_outputs(self):
        program = build_pattern(
            "traffic_lights",
            project_name="Intersection",
            vendor="rockwell",
            model="1769-L33ER",
            cycle_seconds=8,
        )
        validated = validate_program(program)
        symbols = {var.symbol for var in validated.vars}
        assert {"RED_LIGHT", "YELLOW_LIGHT", "GREEN_LIGHT"} <= symbols
        assert validated.meta.patternParams.get("cycleSeconds") == 8
        assert len(validated.pous[0].networks) == 4


class TestPatternRoundtrip:
    @pytest.mark.parametrize(
        ("pattern", "vendor", "model", "suffix"),
        [
            ("estop_motor", "schneider", "TM221CE24R", ".smbp"),
            ("estop_motor", "rockwell", "1769-L33ER", ".L5X"),
            ("estop_motor", "siemens", "S7-1200", ".scl"),
            ("estop_motor", "mitsubishi", "FX5U", ".zip"),
            ("conveyor_startstop", "schneider", "TM221CE24R", ".smbp"),
            ("conveyor_startstop", "rockwell", "1769-L33ER", ".L5X"),
            ("conveyor_startstop", "siemens", "S7-1200", ".scl"),
            ("tank_level", "schneider", "TM221CE16T", ".smbp"),
            ("tank_level", "rockwell", "1769-L33ER", ".L5X"),
            ("traffic_lights", "schneider", "TM221CE16T", ".smbp"),
            ("traffic_lights", "rockwell", "1769-L33ER", ".L5X"),
        ],
    )
    def test_pattern_roundtrip_matrix(self, service, pattern, vendor, model, suffix):
        payload = service.get_pattern_ir(
            pattern,
            project_name=f"Rt4j_{pattern}_{vendor}",
            vendor=vendor,
            model=model,
        )
        result = service.roundtrip(payload["program"])
        assert result["roundtrip"]["ok"] is True
        assert result["fileName"].endswith(suffix)


class TestPatternValidationRules:
    def test_estop_motor_rejects_missing_estop_symbol(self):
        program = build_pattern(
            "estop_motor",
            project_name="BadEstop",
            vendor="schneider",
            model="TM221CE24R",
        ).model_dump()
        program["vars"] = [v for v in program["vars"] if v["symbol"] != "ESTOP_BTN"]
        with pytest.raises(IrValidationError, match="E-stop motor pattern missing"):
            validate_program(program)

    def test_tank_level_rejects_missing_high_sensor(self):
        program = build_pattern(
            "tank_level",
            project_name="BadTank",
            vendor="schneider",
            model="TM221CE16T",
        ).model_dump()
        program["vars"] = [v for v in program["vars"] if v["symbol"] != "TANK_HIGH"]
        with pytest.raises(IrValidationError, match="Tank level pattern missing"):
            validate_program(program)

    def test_siemens_exports_tank_level(self):
        program = build_pattern(
            "tank_level",
            project_name="TankSiemens",
            vendor="siemens",
            model="S7-1200",
        )
        service = IrService()
        result = service.serialize(program.model_dump())
        scl = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        assert "PUMP_RUN" in scl
        assert "TANK_HIGH" in scl

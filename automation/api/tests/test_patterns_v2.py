"""Phase 5 P3 — pattern library v2 tests."""

import pytest

from api.ir.patterns import PATTERN_CATALOG, build_pattern, list_patterns
from api.ir.validator import IrValidationError, validate_program
from api.services.ir_service import IrService

V2_PATTERNS = ("motor_interlock", "pump_staging", "timed_motor")


@pytest.fixture
def service():
    return IrService()


class TestPatternCatalogV2:
    def test_catalog_lists_ten_patterns(self):
        patterns = list_patterns()
        assert len(patterns) == 10
        assert set(PATTERN_CATALOG.keys()) == set(patterns[i]["id"] for i in range(10))

    @pytest.mark.parametrize("pattern", V2_PATTERNS)
    def test_v2_pattern_validates(self, pattern):
        program = build_pattern(
            pattern,
            project_name=f"V2_{pattern}",
            vendor="schneider",
            model="TM221CE24R",
            run_seconds=5,
        )
        validated = validate_program(program)
        assert validated.meta.pattern == pattern


class TestMotorInterlock:
    def test_mutual_exclusion_symbols(self):
        program = build_pattern(
            "motor_interlock",
            project_name="Interlock",
            vendor="schneider",
            model="TM221CE24R",
        )
        symbols = {var.symbol for var in program.vars}
        assert {"MOTOR_A_MEM", "MOTOR_B_MEM", "MOTOR_A_RUN", "MOTOR_B_RUN"} <= symbols

    def test_rejects_missing_interlock_symbol(self):
        program = build_pattern(
            "motor_interlock",
            project_name="Bad",
            vendor="schneider",
            model="TM221CE24R",
        ).model_dump()
        program["vars"] = [v for v in program["vars"] if v["symbol"] != "MOTOR_B_MEM"]
        with pytest.raises(IrValidationError, match="Motor interlock pattern missing"):
            validate_program(program)


class TestPumpStaging:
    def test_lead_lag_outputs(self):
        program = build_pattern(
            "pump_staging",
            project_name="Staging",
            vendor="schneider",
            model="TM221CE24R",
        )
        symbols = {var.symbol for var in program.vars}
        assert {"PUMP_LEAD", "PUMP_LAG", "LEAD_RUN", "LAG_RUN"} <= symbols


class TestTimedMotor:
    def test_timer_variable_present(self):
        program = build_pattern(
            "timed_motor",
            project_name="Timed",
            vendor="schneider",
            model="TM221CE24R",
            run_seconds=8,
        )
        timer = next(var for var in program.vars if var.symbol == "RUN_TIMER")
        assert timer.kind == "timer"
        assert timer.dataType == "TON"
        assert program.meta.patternParams.get("runSeconds") == 8

    def test_siemens_export(self, service):
        program = build_pattern(
            "timed_motor",
            project_name="TimedSiemens",
            vendor="siemens",
            model="S7-1200",
            run_seconds=5,
        )
        result = service.serialize(program.model_dump())
        assert result["metadata"]["format"] == "scl"
        roundtrip = service.roundtrip(program.model_dump())
        assert roundtrip["roundtrip"]["ok"] is True


class TestPatternMatchV2:
    def test_detects_motor_interlock(self):
        from api.ir.pattern_match import detect_pattern_from_description

        pattern, _name, *_rest = detect_pattern_from_description(
            "Dual motor interlock with mutual exclusion"
        )
        assert pattern == "motor_interlock"

    def test_detects_pump_staging(self):
        from api.ir.pattern_match import detect_pattern_from_description

        pattern, _name, *_rest = detect_pattern_from_description(
            "Lead lag pump staging for tank fill"
        )
        assert pattern == "pump_staging"

    def test_detects_timed_motor(self):
        from api.ir.pattern_match import detect_pattern_from_description

        pattern, _name, *_rest = detect_pattern_from_description(
            "Timed motor with 10 second on-delay timer"
        )
        assert pattern == "timed_motor"

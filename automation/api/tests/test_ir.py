import base64
import tempfile
from pathlib import Path

import pytest

from api.ir.patterns import build_pattern, list_patterns
from api.ir.roundtrip import assert_roundtrip
from api.ir.validator import IrValidationError, validate_program
from api.services.ir_service import IrService
from plc_file_handler.parsers.rockwell_parser import RockwellParser
from plc_file_handler.parsers.schneider_parser import SchneiderParser


@pytest.fixture
def service():
    return IrService()


class TestIrPatterns:
    def test_catalog_lists_patterns(self):
        patterns = list_patterns()
        ids = {item["id"] for item in patterns}
        assert "motor_startstop" in ids
        assert "sequential_lights" in ids
        assert "estop_motor" in ids
        assert "tank_level" in ids
        assert len(ids) >= 6

    def test_motor_startstop_ir_validates(self):
        program = build_pattern(
            "motor_startstop",
            project_name="MotorTest",
            vendor="schneider",
            model="TM221CE24R",
        )
        validated = validate_program(program)
        assert validated.meta.pattern == "motor_startstop"
        assert len(validated.vars) == 4
        assert len(validated.pous[0].networks) == 2


class TestIrValidator:
    def test_rejects_duplicate_symbols(self):
        program = build_pattern(
            "motor_startstop",
            project_name="Dup",
            vendor="rockwell",
            model="1769-L33ER",
        ).model_dump()
        program["vars"].append(program["vars"][0])
        with pytest.raises(IrValidationError):
            validate_program(program)

    def test_rejects_undefined_logic_symbol(self):
        program = build_pattern(
            "motor_startstop",
            project_name="Bad",
            vendor="rockwell",
            model="1769-L33ER",
        ).model_dump()
        program["pous"][0]["networks"][0]["logic"]["inputs"].append(
            {"type": "contact", "symbol": "MISSING_TAG", "negated": False}
        )
        with pytest.raises(IrValidationError):
            validate_program(program)


class TestIrSchemaExtensions:
    def test_existing_patterns_still_validate(self):
        for pattern in (
            "motor_startstop",
            "sequential_lights",
            "estop_motor",
            "tank_level",
            "conveyor_startstop",
            "traffic_lights",
        ):
            program = build_pattern(
                pattern,
                project_name=f"StillValid_{pattern}",
                vendor="schneider",
                model="TM221CE24R",
            )
            validated = validate_program(program)
            assert validated.meta.pattern == pattern

    def test_timer_node_valid_program(self):
        program = {
            "name": "TimerTest",
            "target": {"vendor": "schneider", "model": "TM221CE24R"},
            "vars": [
                {"symbol": "START_BTN", "address": "%I0.0", "kind": "input", "dataType": "BOOL"},
                {"symbol": "DELAY_DONE", "address": "%M0", "kind": "memory", "dataType": "BOOL"},
                {
                    "symbol": "T_DELAY",
                    "address": "%TM0",
                    "kind": "timer",
                    "dataType": "TON",
                    "comment": "Start delay",
                },
            ],
            "pous": [
                {
                    "name": "MainProgram",
                    "networks": [
                        {
                            "label": "Rung 1",
                            "logic": {
                                "type": "and",
                                "inputs": [
                                    {"type": "contact", "symbol": "START_BTN"},
                                    {"type": "timer", "symbol": "T_DELAY", "timerType": "TON", "presetMs": 3000},
                                    {"type": "coil", "symbol": "DELAY_DONE"},
                                ],
                            },
                        }
                    ],
                }
            ],
            "meta": {"pattern": None, "requireEstop": False},
        }
        validated = validate_program(program)
        assert validated.vars[2].kind == "timer"

    def test_rejects_timer_node_with_non_timer_var(self):
        program = {
            "name": "BadTimer",
            "target": {"vendor": "rockwell", "model": "1769-L33ER"},
            "vars": [
                {"symbol": "START_BTN", "kind": "input", "dataType": "BOOL"},
                {"symbol": "T_DELAY", "kind": "memory", "dataType": "BOOL"},
            ],
            "pous": [
                {
                    "name": "MainProgram",
                    "networks": [
                        {
                            "logic": {
                                "type": "and",
                                "inputs": [
                                    {"type": "timer", "symbol": "T_DELAY", "timerType": "TON"},
                                ],
                            },
                        }
                    ],
                }
            ],
        }
        with pytest.raises(IrValidationError, match="kind timer"):
            validate_program(program)

    def test_rejects_timer_type_mismatch(self):
        program = {
            "name": "MismatchTimer",
            "target": {"vendor": "schneider", "model": "TM221CE24R"},
            "vars": [
                {"symbol": "T1", "address": "%TM0", "kind": "timer", "dataType": "TOF"},
            ],
            "pous": [
                {
                    "name": "MainProgram",
                    "networks": [
                        {
                            "logic": {
                                "type": "timer",
                                "symbol": "T1",
                                "timerType": "TON",
                            },
                        }
                    ],
                }
            ],
        }
        with pytest.raises(IrValidationError, match="does not match variable dataType"):
            validate_program(program)

    def test_counter_node_valid_program(self):
        program = {
            "name": "CounterTest",
            "target": {"vendor": "rockwell", "model": "1769-L33ER"},
            "vars": [
                {"symbol": "PULSE", "kind": "input", "dataType": "BOOL"},
                {"symbol": "C_PARTS", "kind": "counter", "dataType": "CTU"},
            ],
            "pous": [
                {
                    "name": "MainProgram",
                    "networks": [
                        {
                            "logic": {
                                "type": "counter",
                                "symbol": "C_PARTS",
                                "counterType": "CTU",
                                "preset": 100,
                            },
                        }
                    ],
                }
            ],
        }
        validated = validate_program(program)
        assert validated.vars[1].kind == "counter"

    def test_compare_node_valid_program(self):
        program = {
            "name": "CompareTest",
            "target": {"vendor": "siemens", "model": "S7-1200"},
            "vars": [
                {"symbol": "TEMP_PV", "address": "%IW0", "kind": "input", "dataType": "REAL"},
                {"symbol": "TEMP_SP", "address": "%MW0", "kind": "memory", "dataType": "REAL"},
                {"symbol": "TEMP_HIGH", "address": "%M0.0", "kind": "memory", "dataType": "BOOL"},
            ],
            "pous": [
                {
                    "name": "MainProgram",
                    "networks": [
                        {
                            "logic": {
                                "type": "compare",
                                "left": "TEMP_PV",
                                "right": "TEMP_SP",
                                "op": "GT",
                                "output": "TEMP_HIGH",
                            },
                        }
                    ],
                }
            ],
        }
        validated = validate_program(program)
        assert validated.pous[0].networks[0].logic.type == "compare"

    def test_fb_call_pid_valid_program(self):
        program = {
            "name": "PidTest",
            "target": {"vendor": "siemens", "model": "S7-1200"},
            "vars": [
                {"symbol": "LOOP_EN", "address": "%I0.0", "kind": "input", "dataType": "BOOL"},
                {"symbol": "TEMP_PV", "address": "%IW0", "kind": "input", "dataType": "REAL"},
                {"symbol": "TEMP_SP", "address": "%MW0", "kind": "memory", "dataType": "REAL"},
                {"symbol": "VALVE_CV", "address": "%QW0", "kind": "output", "dataType": "REAL"},
                {"symbol": "PID1", "address": "%MW10", "kind": "memory", "dataType": "REAL"},
            ],
            "pous": [
                {
                    "name": "MainProgram",
                    "networks": [
                        {
                            "logic": {
                                "type": "fb_call",
                                "kind": "PID",
                                "instance": "PID1",
                                "enable": "LOOP_EN",
                                "params": [
                                    {"name": "PV", "symbol": "TEMP_PV", "direction": "in"},
                                    {"name": "SP", "symbol": "TEMP_SP", "direction": "in"},
                                    {"name": "CV", "symbol": "VALVE_CV", "direction": "out"},
                                ],
                            },
                        }
                    ],
                }
            ],
        }
        validated = validate_program(program)
        assert validated.pous[0].networks[0].logic.kind == "PID"

    def test_rejects_compare_operand_datatype_mismatch(self):
        program = {
            "name": "BadCompare",
            "target": {"vendor": "siemens", "model": "S7-1200"},
            "vars": [
                {"symbol": "A", "kind": "input", "dataType": "REAL"},
                {"symbol": "B", "kind": "memory", "dataType": "INT"},
                {"symbol": "OUT", "kind": "memory", "dataType": "BOOL"},
            ],
            "pous": [
                {
                    "name": "MainProgram",
                    "networks": [
                        {
                            "logic": {
                                "type": "compare",
                                "left": "A",
                                "right": "B",
                                "op": "GE",
                                "output": "OUT",
                            },
                        }
                    ],
                }
            ],
        }
        with pytest.raises(IrValidationError, match="must share the same dataType"):
            validate_program(program)

    def test_require_estop_missing_symbol(self):
        program = build_pattern(
            "motor_startstop",
            project_name="NoEstop",
            vendor="schneider",
            model="TM221CE24R",
        ).model_dump()
        program["meta"]["requireEstop"] = True
        with pytest.raises(IrValidationError, match="requireEstop is set"):
            validate_program(program)

    def test_require_estop_valid_nc_contact(self):
        program = build_pattern(
            "motor_startstop",
            project_name="WithEstop",
            vendor="schneider",
            model="TM221CE24R",
        ).model_dump()
        program["vars"].append(
            {"symbol": "ESTOP_BTN", "address": "%I0.2", "kind": "input", "dataType": "BOOL"}
        )
        program["meta"]["requireEstop"] = True
        rung1 = program["pous"][0]["networks"][0]["logic"]
        rung1["inputs"].insert(1, {"type": "contact", "symbol": "ESTOP_BTN", "negated": True})
        validated = validate_program(program)
        assert validated.meta.requireEstop is True

    def test_schema_export_includes_timer_and_counter_nodes(self):
        from api.ir.schema_export import ir_json_schema, ir_schema_for_claude

        schema = ir_json_schema()
        schema_text = str(schema)
        assert "TimerNode" in schema_text or "timer" in schema_text
        assert "CounterNode" in schema_text or "counter" in schema_text

        claude_payload = ir_schema_for_claude()
        assert claude_payload["title"]
        assert "schema" in claude_payload
        assert claude_payload["schema"]["$defs"] is not None


class TestIrSerializeRoundtrip:
    @pytest.mark.parametrize(
        ("pattern", "vendor", "model", "suffix"),
        [
            ("motor_startstop", "schneider", "TM221CE24R", ".smbp"),
            ("motor_startstop", "rockwell", "1769-L33ER", ".L5X"),
            ("motor_startstop", "siemens", "S7-1200", ".scl"),
            ("motor_startstop", "mitsubishi", "FX5U", ".zip"),
            ("sequential_lights", "schneider", "TM221CE16T", ".smbp"),
            ("sequential_lights", "rockwell", "1769-L33ER", ".L5X"),
        ],
    )
    def test_pattern_roundtrip_matrix(self, service, pattern, vendor, model, suffix):
        payload = service.get_pattern_ir(
            pattern,
            project_name=f"Rt_{pattern}_{vendor}",
            vendor=vendor,
            model=model,
            num_lights=4,
            delay_seconds=3,
        )
        result = service.roundtrip(payload["program"])
        assert result["roundtrip"]["ok"] is True
        assert result["fileName"].endswith(suffix)

    def test_plcopen_motor_startstop_for_codesys(self, service):
        payload = service.get_pattern_ir(
            "motor_startstop",
            project_name="PlcopenMotor",
            vendor="codesys",
            model="Generic",
        )
        program = payload["program"]
        program["target"] = {"vendor": "codesys", "model": "Generic"}
        result = service.serialize(program)
        xml = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        assert "plcopen.org" in xml


class TestIrProgramServiceIntegration:
    def test_program_generate_includes_ir_metadata(self):
        from api.services.program_service import ProgramService

        svc = ProgramService()
        result = svc.generate(
            {
                "platform": "rockwell",
                "projectName": "IrMeta",
                "controller": "1769-L33ER",
                "source": {"type": "pattern", "pattern": "motor_startstop"},
            }
        )
        assert "ir" in result["metadata"]
        assert result["metadata"]["ir"]["meta"]["pattern"] == "motor_startstop"

    def test_program_generate_from_ir_source(self, tmp_path):
        from api.services.program_service import ProgramService

        svc = ProgramService()
        ir_payload = IrService().get_pattern_ir(
            "motor_startstop",
            project_name="DirectIr",
            vendor="schneider",
            model="TM221CE24R",
        )
        result = svc.generate(
            {
                "platform": "schneider",
                "projectName": "DirectIr",
                "controller": "TM221CE24R",
                "source": {"type": "ir", "program": ir_payload["program"]},
            }
        )
        path = tmp_path / result["fileName"]
        path.write_bytes(base64.standard_b64decode(result["contentBase64"]))
        parsed = SchneiderParser(str(path)).parse()
        assert parsed["platform"] == "schneider_m221"

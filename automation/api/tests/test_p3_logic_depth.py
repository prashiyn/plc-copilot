"""Phase 5 P3 — arbitrary synthesis, M221 direct IR export, PID/analog (v1.6 Phase A)."""

import base64

import pytest

from api.ir.pattern_match import detect_pattern_from_description
from api.ir.patterns import build_pattern
from api.ir.validator import validate_program
from api.services.claude_ir_service import (
    ClaudeIrService,
    IrSynthesisError,
    MAX_RETRIES,
)
from api.services.ir_service import IrService
from api.services.m221_program_service import M221ProgramService
from api.services.m221_smbp_builder import M221SmbpBuilder


class FakeClaude:
    def __init__(self, responses: list):
        self.responses = list(responses)
        self.calls = 0
        self.prompts: list[str] = []

    def ask_json(self, system: str, prompt: str, max_tokens: int = 3072, model: str | None = None):
        self.prompts.append(prompt)
        if self.calls >= len(self.responses):
            raise ValueError("No more mocked responses")
        item = self.responses[self.calls]
        self.calls += 1
        if isinstance(item, Exception):
            raise item
        return item


def _invalid_motor_ir() -> dict:
    program = build_pattern(
        "motor_startstop",
        project_name="Bad",
        vendor="schneider",
        model="TM221CE24R",
    ).model_dump()
    program["vars"] = [v for v in program["vars"] if v["symbol"] != "STOP_BTN"]
    return program


def _valid_pid_ir() -> dict:
    return build_pattern(
        "pid_loop",
        project_name="AnalogPid",
        vendor="siemens",
        model="S7-1200",
        setpoint=80.0,
    ).model_dump()


def _analog_multi_network_ir() -> dict:
    program = build_pattern(
        "pid_loop",
        project_name="AnalogCustom",
        vendor="siemens",
        model="S7-1200",
        setpoint=65.0,
    ).model_dump()
    program["meta"]["pattern"] = None
    program["pous"][0]["networks"].append(
        {
            "label": "Rung 3",
            "comment": "High temperature alarm",
            "logic": {
                "type": "compare",
                "left": "TEMP_PV",
                "right": "TEMP_SP",
                "op": "GT",
                "output": "LOOP_ACTIVE",
            },
        }
    )
    return program


class TestPidPatternMatch:
    @pytest.mark.parametrize(
        "description",
        [
            "PID closed loop for reactor temperature",
            "Temperature control with setpoint 90",
            "Analog control loop with process variable and setpoint of 42",
        ],
    )
    def test_pid_descriptions_map_to_pid_loop(self, description):
        pattern, _name, *_rest, setpoint = detect_pattern_from_description(description)
        assert pattern == "pid_loop"
        if "42" in description:
            assert setpoint == 42.0


class TestArbitrarySynthesis:
    def test_arbitrary_mode_raises_after_retries(self):
        fake = FakeClaude([_invalid_motor_ir()] * (MAX_RETRIES + 1))
        with pytest.raises(IrSynthesisError) as exc_info:
            ClaudeIrService(claude=fake).generate_program_ir(
                "Custom two-hand control with dual permissive inputs",
                synthesis_mode="arbitrary",
            )
        assert exc_info.value.attempts == MAX_RETRIES + 1
        assert fake.calls == MAX_RETRIES + 1

    def test_arbitrary_mode_uses_extended_system_prompt(self):
        motor = build_pattern(
            "motor_startstop",
            project_name="ArbitraryMotor",
            vendor="schneider",
            model="TM221CE24R",
        ).model_dump()
        fake = FakeClaude([motor])
        ClaudeIrService(claude=fake).generate_program_ir(
            "Custom motor logic",
            synthesis_mode="arbitrary",
        )
        assert fake.calls == 1

    def test_constrained_mode_still_falls_back(self):
        fake = FakeClaude([_invalid_motor_ir()] * (MAX_RETRIES + 1))
        result = ClaudeIrService(claude=fake).generate_program_ir(
            "Motor start stop",
            synthesis_mode="constrained",
        )
        assert result["source"] == "pattern_fallback"

    def test_constrained_mode_falls_back_to_pid_loop(self):
        fake = FakeClaude([_invalid_motor_ir()] * (MAX_RETRIES + 1))
        result = ClaudeIrService(claude=fake).generate_program_ir(
            "PID temperature control with setpoint 80",
            synthesis_mode="constrained",
        )
        assert result["source"] == "pattern_fallback"
        assert result["pattern"] == "pid_loop"
        assert result["program"]["meta"]["pattern"] == "pid_loop"

    def test_arbitrary_mode_accepts_analog_multi_network_ir(self):
        fake = FakeClaude([_analog_multi_network_ir()])
        result = ClaudeIrService(claude=fake).generate_program_ir(
            "Custom PID with high-temp compare alarm",
            synthesis_mode="arbitrary",
        )
        assert result["source"] == "claude"
        validated = validate_program(result["program"])
        assert validated.meta.pattern is None
        logic_types = [network.logic.type for network in validated.pous[0].networks]
        assert "fb_call" in logic_types
        assert "compare" in logic_types

    def test_arbitrary_mode_valid_pid_ir_passes_validation(self):
        fake = FakeClaude([_valid_pid_ir()])
        result = ClaudeIrService(claude=fake).generate_program_ir(
            "PID loop for tank temperature",
            synthesis_mode="arbitrary",
        )
        assert result["source"] == "claude"
        validate_program(result["program"])


class TestM221DirectIrExport:
    def test_generate_uses_ir_serializer_path(self, monkeypatch):
        from api.services.claude_ir_service import ClaudeIrService

        program = build_pattern(
            "motor_startstop",
            project_name="DirectMotor",
            vendor="schneider",
            model="TM221CE16T",
        )

        def fake_generate_ir(self, description, vendor="schneider", model="TM221CE16T", project_name=None, synthesis_mode="constrained"):
            return {
                "program": program.model_dump(),
                "source": "claude",
                "attempts": 1,
                "pattern": None,
                "fallbackReason": None,
                "synthesisMode": synthesis_mode,
                "summary": {},
            }

        monkeypatch.setattr(ClaudeIrService, "generate_program_ir", fake_generate_ir)

        service = M221ProgramService()
        result = service.generate_from_description("Motor", "TM221CE16T", "DirectMotor")
        assert result["metadata"]["exportPath"] == "ir_direct"
        assert result["metadata"]["platform"] == "schneider"
        assert "Calaos/Case/2.0" in base64.standard_b64decode(result["contentBase64"]).decode("utf-8")

    def test_direct_path_matches_ir_service_bytes(self, monkeypatch):
        from api.services.claude_ir_service import ClaudeIrService

        program = build_pattern(
            "motor_interlock",
            project_name="DirectInterlock",
            vendor="schneider",
            model="TM221CE24R",
        )

        def fake_generate_ir(self, description, vendor="schneider", model="TM221CE24R", project_name=None, synthesis_mode="constrained"):
            return {
                "program": program.model_dump(),
                "source": "claude",
                "attempts": 1,
                "pattern": None,
                "fallbackReason": None,
                "synthesisMode": synthesis_mode,
                "summary": {},
            }

        monkeypatch.setattr(ClaudeIrService, "generate_program_ir", fake_generate_ir)

        m221_result = M221ProgramService().generate_from_description("Interlock", "TM221CE24R")
        ir_result = IrService().serialize(program.model_dump())
        assert m221_result["contentBase64"] == ir_result["contentBase64"]
        assert m221_result["fileName"] == ir_result["fileName"]

    def test_legacy_json_builder_still_works(self):
        from api.services.m221_smbp_builder import default_m221_program

        result = M221SmbpBuilder().build(default_m221_program("Legacy"), "TM221CE16T")
        assert result["metadata"]["format"] == "machine_expert_basic_xml"

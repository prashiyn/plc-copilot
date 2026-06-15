"""Phase 5 P3 — arbitrary synthesis, M221 direct IR export."""

import base64

import pytest

from api.ir.patterns import build_pattern
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

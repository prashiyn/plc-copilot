import pytest

from api.services.ai_prompts import (
    APPLICATION_GENERATE_SYSTEM,
    CODE_OPTIMIZE_SYSTEM,
    HMI_SYSTEM,
    LIBRARY_SEARCH_SYSTEM,
    build_application_user_prompt,
    build_hmi_user_prompt,
    build_library_user_prompt,
    build_optimize_user_prompt,
    copilot_system_prompt,
    engineer_persona,
    engineer_system_prompt,
)


class TestCopilotPrompts:
    def test_generate_mode_includes_focus(self):
        prompt = copilot_system_prompt("generate")
        assert "GENERATE CODE" in prompt
        assert "production-ready PLC code" in prompt

    def test_explain_mode_suffix(self):
        assert "explanations" in copilot_system_prompt("explain").lower()

    def test_test_mode_suffix(self):
        assert "test cases" in copilot_system_prompt("test").lower()


class TestEngineerPrompts:
    def test_schneider_persona(self):
        persona = engineer_persona("schneider-specialist")
        assert persona["name"] == "Dr. James Peterson"
        assert "Schneider" in persona["specialty"]

    def test_unknown_persona_falls_back(self):
        persona = engineer_persona("unknown-id")
        assert persona["name"] == "PLC Engineering Assistant"

    def test_context_appended(self):
        system = engineer_system_prompt(
            "general-expert",
            {"projectType": "Conveyor", "plcPlatform": "M221", "issue": "Timer fault"},
        )
        assert "CONVERSATION CONTEXT" in system
        assert "Conveyor" in system
        assert "Timer fault" in system
        assert "Guidelines:" in system


class TestJsonFeaturePrompts:
    def test_application_prompt_includes_requirements(self):
        prompt = build_application_user_prompt(
            requirements="Motor start/stop",
            application_type="Motor Control",
            platform="schneider",
            controller="TM221CE24R",
            io_count="16",
            safety_level="standard",
        )
        assert "Motor start/stop" in prompt
        assert "application_name" in prompt
        assert APPLICATION_GENERATE_SYSTEM.startswith("You are an expert")

    def test_library_prompt_includes_query(self):
        prompt = build_library_user_prompt(
            query="motor interlock",
            platform="rockwell",
            application_type="Safety",
            requirements=["E-stop"],
            generate_custom=True,
        )
        assert "motor interlock" in prompt
        assert "custom blocks" in prompt.lower()
        assert LIBRARY_SEARCH_SYSTEM.endswith("JSON only.")

    def test_optimize_prompt_includes_code(self):
        prompt = build_optimize_user_prompt(
            code="LD %I0.0",
            platform="siemens",
            optimization_goals=["scan time"],
            current_issues="slow cycle",
        )
        assert "LD %I0.0" in prompt
        assert "scan time" in prompt
        assert "slow cycle" in prompt
        assert CODE_OPTIMIZE_SYSTEM.endswith("JSON only.")

    def test_hmi_prompt_includes_vendor_and_screen(self):
        prompt = build_hmi_user_prompt(
            vendor="rockwell-factorytalk",
            screen_type="motor-control",
            description="Motor panel with start/stop",
            project_name="Line1",
            tags=[{"name": "MOTOR_RUN", "address": "N7:0", "type": "BOOL", "comment": "Run"}],
        )
        assert "rockwell-factorytalk" in prompt
        assert "motor-control" in prompt
        assert "MOTOR_RUN" in prompt
        assert "Line1" in prompt
        assert HMI_SYSTEM.startswith("You are an expert HMI")

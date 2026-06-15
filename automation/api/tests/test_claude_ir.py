import pytest

from api.ir.pattern_match import detect_pattern_from_description, normalize_vendor
from api.ir.patterns import build_pattern
from api.ir.validator import validate_program
from api.services.claude_ir_service import ClaudeIrService, IrSynthesisError, MAX_RETRIES


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


def _valid_motor_ir() -> dict:
    return build_pattern(
        "motor_startstop",
        project_name="ClaudeMotor",
        vendor="schneider",
        model="TM221CE24R",
    ).model_dump()


def _invalid_motor_ir() -> dict:
    program = _valid_motor_ir()
    program["vars"] = [v for v in program["vars"] if v["symbol"] != "STOP_BTN"]
    return program


class TestPatternMatch:
    def test_detects_motor_from_description(self):
        pattern, name, _lights, _delay, _cycle, _run = detect_pattern_from_description(
            "Motor start stop circuit with START and STOP buttons."
        )
        assert pattern == "motor_startstop"

    def test_detects_sequential_lights(self):
        pattern, _name, num_lights, delay, _cycle, _run = detect_pattern_from_description(
            "3 sequential lights with 3-second delays."
        )
        assert pattern == "sequential_lights"
        assert num_lights == 3
        assert delay == 3

    def test_detects_estop_motor(self):
        pattern, _name, _lights, _delay, _cycle, _run = detect_pattern_from_description(
            "Motor with emergency stop E-stop button and seal-in."
        )
        assert pattern == "estop_motor"

    def test_detects_tank_level(self):
        pattern, _name, _lights, _delay, _cycle, _run = detect_pattern_from_description(
            "Tank level control with fill pump and high/low sensors."
        )
        assert pattern == "tank_level"

    def test_detects_conveyor(self):
        pattern, _name, _lights, _delay, _cycle, _run = detect_pattern_from_description(
            "Conveyor belt start stop with run signal."
        )
        assert pattern == "conveyor_startstop"

    def test_detects_traffic_lights(self):
        pattern, _name, _lights, _delay, cycle, _run = detect_pattern_from_description(
            "Traffic light sequence with 4 second cycle."
        )
        assert pattern == "traffic_lights"
        assert cycle == 4

    def test_detects_motor_interlock(self):
        pattern, _name, *_rest = detect_pattern_from_description(
            "Dual motor interlock with mutual exclusion"
        )
        assert pattern == "motor_interlock"

    def test_detects_pump_staging(self):
        pattern, _name, *_rest = detect_pattern_from_description(
            "Lead lag pump staging for tank"
        )
        assert pattern == "pump_staging"

    def test_detects_timed_motor(self):
        pattern, _name, *_rest = detect_pattern_from_description(
            "Timed motor with 7 second on-delay"
        )
        assert pattern == "timed_motor"

    def test_normalize_vendor_maps_rockwell_aliases(self):
        assert normalize_vendor("Allen-Bradley") == "rockwell"
        assert normalize_vendor("unknown-oem") == "generic"


class TestClaudeIrService:
    def test_valid_claude_response_produces_valid_ir(self):
        fake = FakeClaude([_valid_motor_ir()])
        result = ClaudeIrService(claude=fake).generate_program_ir(
            "Motor start stop with seal-in",
            vendor="schneider",
            model="TM221CE24R",
            project_name="ClaudeMotor",
        )
        assert result["source"] == "claude"
        assert result["attempts"] == 1
        assert result["pattern"] is None
        validated = validate_program(result["program"])
        assert validated.meta.pattern == "motor_startstop"

    def test_invalid_then_valid_retries(self):
        fake = FakeClaude([_invalid_motor_ir(), _valid_motor_ir()])
        result = ClaudeIrService(claude=fake).generate_program_ir(
            "Motor start stop",
            vendor="schneider",
            model="TM221CE24R",
        )
        assert result["source"] == "claude"
        assert result["attempts"] == 2
        assert fake.calls == 2
        assert "INVALID" in fake.prompts[1] or "Previous response" in fake.prompts[1]

    def test_arbitrary_mode_raises_on_exhausted_retries(self):
        fake = FakeClaude([_invalid_motor_ir()] * (MAX_RETRIES + 1))
        with pytest.raises(IrSynthesisError):
            ClaudeIrService(claude=fake).generate_program_ir(
                "Custom permissive logic with three inputs",
                synthesis_mode="arbitrary",
            )

    def test_exhausted_retries_use_pattern_fallback(self):
        fake = FakeClaude([_invalid_motor_ir()] * (MAX_RETRIES + 1))
        result = ClaudeIrService(claude=fake).generate_program_ir(
            "Motor start stop with START and STOP",
            vendor="schneider",
            model="TM221CE24R",
            project_name="FallbackMotor",
        )
        assert result["source"] == "pattern_fallback"
        assert result["pattern"] == "motor_startstop"
        assert result["attempts"] == MAX_RETRIES + 1
        assert result["fallbackReason"]
        assert fake.calls == MAX_RETRIES + 1
        validated = validate_program(result["program"])
        assert validated.name == "FallbackMotor"

    def test_claude_json_parse_error_falls_back(self):
        fake = FakeClaude([ValueError("No JSON found in model response")] * (MAX_RETRIES + 1))
        result = ClaudeIrService(claude=fake).generate_program_ir(
            "4 sequential lights with 2 second delay",
            vendor="schneider",
            model="TM221CE16T",
        )
        assert result["source"] == "pattern_fallback"
        assert result["pattern"] == "sequential_lights"
        validated = validate_program(result["program"])
        assert validated.meta.pattern == "sequential_lights"

    def test_normalizes_missing_target_fields(self):
        raw = _valid_motor_ir()
        del raw["target"]
        raw.pop("name", None)
        fake = FakeClaude([raw])
        result = ClaudeIrService(claude=fake).generate_program_ir(
            "Motor control",
            vendor="rockwell",
            model="1769-L33ER",
            project_name="Normalized",
        )
        assert result["program"]["target"]["vendor"] == "rockwell"
        assert result["program"]["target"]["model"] == "1769-L33ER"
        assert result["program"]["name"] == "Normalized"


class TestClaudeIrApi:
    @pytest.mark.asyncio
    async def test_generate_from_description_job(self, client, redis, auth_headers):
        from unittest.mock import patch

        from api.jobs.store import JobStore
        from api.jobs.tasks import process_job

        motor = _valid_motor_ir()
        expected = {
            "program": motor,
            "summary": {"name": motor["name"]},
            "source": "claude",
            "attempts": 1,
            "pattern": None,
            "fallbackReason": None,
        }

        with patch(
            "api.jobs.tasks.ClaudeIrService.generate_program_ir",
            return_value=expected,
        ):
            response = client.post(
                "/v1/ir/generate-from-description",
                headers=auth_headers,
                json={
                    "description": "Motor start stop circuit",
                    "vendor": "schneider",
                    "model": "TM221CE24R",
                    "projectName": "ApiMotor",
                },
            )
            assert response.status_code == 202
            job_id = response.json()["jobId"]
            await process_job(redis, job_id)
            job = await JobStore(redis).get(job_id)
            assert job["status"] == "completed"
            assert job["result"]["source"] == "claude"
            assert job["result"]["program"]["meta"]["pattern"] == "motor_startstop"

    def test_generate_from_description_requires_auth(self, client):
        response = client.post(
            "/v1/ir/generate-from-description",
            json={"description": "Motor start stop"},
        )
        assert response.status_code == 401

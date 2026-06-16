"""Phase A2 — pid_loop pattern, detection, and export."""

import base64

import pytest

from api.ir.pattern_match import detect_pattern_from_description
from api.ir.patterns import PATTERN_CATALOG, build_pattern, list_patterns
from api.ir.serializers.siemens_scl import render_siemens_scl
from api.ir.validator import validate_program
from api.jobs.store import JobStore
from api.jobs.tasks import process_job
from api.services.ir_service import IrService
from api.services.program_service import ProgramService


class TestPidLoopPattern:
    def test_catalog_lists_ten_patterns(self):
        patterns = list_patterns()
        assert len(patterns) == 10
        assert "pid_loop" in PATTERN_CATALOG

    def test_pid_loop_builds_valid_ir(self):
        program = build_pattern(
            "pid_loop",
            project_name="TempControl",
            vendor="siemens",
            model="S7-1200",
            setpoint=75.0,
        )
        validated = validate_program(program)
        assert validated.meta.pattern == "pid_loop"
        assert validated.meta.patternParams.get("setpoint") == 75.0
        symbols = {var.symbol for var in validated.vars}
        assert {"LOOP_EN", "TEMP_PV", "TEMP_SP", "VALVE_CV", "PID1"} <= symbols

    def test_pid_loop_has_fb_call_network(self):
        program = build_pattern(
            "pid_loop",
            project_name="Pid",
            vendor="schneider",
            model="TM221CE24R",
        )
        logic_types = [network.logic.type for network in program.pous[0].networks]
        assert "fb_call" in logic_types

    def test_pid_loop_clamps_setpoint(self):
        program = build_pattern(
            "pid_loop",
            project_name="Clamp",
            vendor="siemens",
            model="S7-1200",
            setpoint=5000.0,
        )
        assert program.meta.patternParams["setpoint"] == 1000.0


class TestPidLoopDetection:
    def test_detects_pid_keywords(self):
        pattern, _name, *_rest, setpoint = detect_pattern_from_description(
            "PID temperature control loop for tank heating"
        )
        assert pattern == "pid_loop"
        assert setpoint == 50.0

    def test_extracts_setpoint(self):
        pattern, _name, *_rest, setpoint = detect_pattern_from_description(
            "Closed loop PID with setpoint of 82.5 for reactor temperature"
        )
        assert pattern == "pid_loop"
        assert setpoint == 82.5


class TestPidLoopExport:
    def test_siemens_scl_contains_pid_comp(self):
        program = build_pattern(
            "pid_loop",
            project_name="PidExport",
            vendor="siemens",
            model="S7-1200",
            setpoint=60.0,
        )
        scl = render_siemens_scl(program, "S7-1200")
        assert "PID_Comp" in scl
        assert "TEMP_PV" in scl
        assert "TEMP_SP" in scl
        assert "VALVE_CV" in scl

    def test_program_service_generates_siemens_tier2(self):
        service = ProgramService()
        result = service.generate(
            {
                "platform": "siemens",
                "controller": "S7-1200",
                "projectName": "PidTier2",
                "source": {
                    "type": "pattern",
                    "pattern": "pid_loop",
                    "setpoint": 55.0,
                },
            }
        )
        content = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        assert "PID_Comp" in content
        assert result["metadata"]["ir"]["meta"]["pattern"] == "pid_loop"


@pytest.mark.asyncio
async def test_generate_pid_loop_api(client, redis, auth_headers):
    response = client.post(
        "/v1/programs/generate",
        headers=auth_headers,
        json={
            "platform": "siemens",
            "controller": "S7-1200",
            "projectName": "ApiPid",
            "source": {"type": "pattern", "pattern": "pid_loop", "setpoint": 70.0},
        },
    )
    assert response.status_code == 202, response.text
    job_id = response.json()["jobId"]
    await process_job(redis, job_id)
    job = await JobStore(redis).get(job_id)
    assert job["status"] == "completed", job
    result = job["result"]
    content = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
    assert "PID_Comp" in content
    assert result["metadata"]["ir"]["meta"]["pattern"] == "pid_loop"


class TestPidLoopGoldenExports:
    def test_rockwell_export_has_pid_limitation(self):
        program = build_pattern(
            "pid_loop",
            project_name="RwPid",
            vendor="rockwell",
            model="1769-L33ER",
        )
        result = IrService().serialize(program.model_dump())
        assert result["metadata"].get("limitations")

    def test_schneider_export_has_pid_limitation(self):
        program = build_pattern(
            "pid_loop",
            project_name="SePid",
            vendor="schneider",
            model="TM221CE24R",
        )
        result = IrService().serialize(program.model_dump())
        assert result["metadata"].get("limitations")


class TestPidLoopIrApi:
    def test_ir_pattern_endpoint(self):
        payload = IrService().get_pattern_ir(
            "pid_loop",
            project_name="IrPid",
            vendor="codesys",
            model="CODESYS Control",
            setpoint=42.0,
        )
        assert payload["summary"]["pattern"] == "pid_loop"
        assert payload["program"]["meta"]["patternParams"]["setpoint"] == 42.0

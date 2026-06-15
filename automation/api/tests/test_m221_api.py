import base64

import pytest

from api.jobs.store import JobStore
from api.jobs.tasks import process_job
from api.services.m221_smbp_builder import default_m221_program


@pytest.mark.asyncio
async def test_m221_build_api(client, redis, auth_headers):
    result = await _run_job(
        redis,
        client,
        "/v1/programs/m221/build",
        auth_headers,
        json={
            "programData": default_m221_program("ApiBuild"),
            "plcModel": "TM221CE16T",
            "projectName": "ApiBuild",
        },
    )
    xml = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
    assert "Calaos/Case/2.0" in xml
    assert result["programData"]["projectName"] == "ApiBuild"


@pytest.mark.asyncio
async def test_m221_generate_api(client, redis, auth_headers, monkeypatch):
    from api.ir.patterns import build_pattern
    from api.services.claude_ir_service import ClaudeIrService

    def fake_generate_ir(self, description, vendor="schneider", model="TM221CE16T", project_name=None):
        program = build_pattern(
            "motor_startstop",
            project_name=project_name or "ApiGenerate",
            vendor=vendor,
            model=model,
        )
        return {
            "program": program.model_dump(),
            "source": "claude",
            "attempts": 1,
            "pattern": None,
            "fallbackReason": None,
            "summary": {},
        }

    monkeypatch.setattr(ClaudeIrService, "generate_program_ir", fake_generate_ir)

    result = await _run_job(
        redis,
        client,
        "/v1/programs/m221/generate",
        auth_headers,
        json={
            "description": "Motor start stop circuit",
            "plcModel": "TM221CE16T",
            "projectName": "ApiGenerate",
        },
    )
    assert result["fileName"] == "ApiGenerate.smbp"
    assert result["metadata"]["irSource"] == "claude"
    assert result["ir"]["name"] == "ApiGenerate"
    xml = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
    assert "<Rungs>" in xml


async def _run_job(redis, client, path, auth_headers, json):
    response = client.post(path, headers=auth_headers, json=json)
    assert response.status_code == 202, response.text
    job_id = response.json()["jobId"]
    await process_job(redis, job_id)
    job = await JobStore(redis).get(job_id)
    assert job["status"] == "completed", job
    return job["result"]

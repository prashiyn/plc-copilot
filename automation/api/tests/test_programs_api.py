import base64
import io
import zipfile
from pathlib import Path

import pytest

from api.jobs.store import JobStore
from api.jobs.tasks import process_job

SAMPLES_DIR = Path(__file__).resolve().parents[2] / "samples"


async def _run_job(redis, client, method, url, auth_headers, **kwargs):
    if method == "POST":
        response = client.post(url, headers=auth_headers, **kwargs)
    else:
        raise ValueError(method)
    assert response.status_code == 202, response.text
    job_id = response.json()["jobId"]
    await process_job(redis, job_id)
    job = await JobStore(redis).get(job_id)
    assert job["status"] == "completed", job
    return job["result"]


@pytest.mark.asyncio
async def test_generate_motor_startstop_api(client, redis, auth_headers):
    result = await _run_job(
        redis,
        client,
        "POST",
        "/v1/programs/generate",
        auth_headers,
        json={
            "platform": "schneider",
            "controller": "TM221CE24R",
            "projectName": "ApiMotor",
            "source": {"type": "pattern", "pattern": "motor_startstop"},
        },
    )
    assert result["fileName"] == "ApiMotor.smbp"
    assert len(base64.standard_b64decode(result["contentBase64"])) > 100


@pytest.mark.asyncio
async def test_plcopen_api(client, redis, auth_headers):
    result = await _run_job(
        redis,
        client,
        "POST",
        "/v1/programs/plcopen",
        auth_headers,
        json={
            "name": "ApiPlcopen",
            "platform": "rockwell",
            "pattern": "motor_startstop",
        },
    )
    xml = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
    assert "plcopen.org" in xml
    assert result["metadata"]["format"] == "plcopen_xml"


@pytest.mark.asyncio
async def test_parse_sample_api(client, redis, auth_headers):
    sample = SAMPLES_DIR / "tankcontrol.smbp"
    with sample.open("rb") as handle:
        result = await _run_job(
            redis,
            client,
            "POST",
            "/v1/programs/parse",
            auth_headers,
            files={"file": ("tankcontrol.smbp", handle, "application/octet-stream")},
        )
    assert result["platform"] == "schneider_m221"
    assert "project" in result
    assert result["summary"]


def test_programs_require_auth(client):
    response = client.post(
        "/v1/programs/generate",
        json={
            "platform": "schneider",
            "projectName": "NoAuth",
            "source": {"type": "pattern", "pattern": "motor_startstop"},
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_generate_claude_ir_api(client, redis, auth_headers, monkeypatch):
    from api.ir.patterns import build_pattern
    from api.services.claude_ir_service import ClaudeIrService

    def fake_generate_ir(self, description, vendor="schneider", model="TM221CE24R", project_name=None):
        program = build_pattern(
            "motor_startstop",
            project_name=project_name or "ApiClaude",
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
        "POST",
        "/v1/programs/generate",
        auth_headers,
        json={
            "platform": "schneider",
            "controller": "TM221CE24R",
            "projectName": "ApiClaude",
            "source": {"type": "claude_ir", "description": "Start stop motor circuit"},
        },
    )
    assert result["fileName"] == "ApiClaude.smbp"
    assert result["metadata"]["ir"]["name"] == "ApiClaude"
    assert result["metadata"]["irSource"] == "claude"
    assert len(base64.standard_b64decode(result["contentBase64"])) > 100


@pytest.mark.asyncio
async def test_generate_siemens_scl_api(client, redis, auth_headers):
    result = await _run_job(
        redis,
        client,
        "POST",
        "/v1/programs/generate",
        auth_headers,
        json={
            "platform": "siemens",
            "controller": "S7-1200",
            "projectName": "ApiSiemens",
            "source": {"type": "pattern", "pattern": "motor_startstop"},
        },
    )
    assert result["fileName"] == "ApiSiemens.scl"
    assert result["metadata"]["format"] == "scl"
    assert result["metadata"]["tier"] == 2
    scl = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
    assert "MOTOR_RUN" in scl


@pytest.mark.asyncio
async def test_generate_mitsubishi_zip_api(client, redis, auth_headers):
    result = await _run_job(
        redis,
        client,
        "POST",
        "/v1/programs/generate",
        auth_headers,
        json={
            "platform": "mitsubishi",
            "controller": "FX5U",
            "projectName": "ApiMitsubishi",
            "source": {"type": "pattern", "pattern": "motor_startstop"},
        },
    )
    assert result["fileName"] == "ApiMitsubishi_mitsubishi.zip"
    assert result["metadata"]["format"] == "mitsubishi_tier2_zip"
    assert result["metadata"]["tier"] == 2
    assert result["metadata"]["limitations"]
    raw = base64.standard_b64decode(result["contentBase64"])
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        il_text = archive.read("ApiMitsubishi.il").decode("utf-8")
    assert "START_BTN=X00" in il_text

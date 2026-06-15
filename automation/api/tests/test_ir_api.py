import pytest

from api.jobs.store import JobStore
from api.jobs.tasks import process_job
from api.services.ir_service import IrService


@pytest.mark.asyncio
async def test_ir_patterns_api(client, auth_headers):
    response = client.get("/v1/ir/patterns", headers=auth_headers)
    assert response.status_code == 200
    patterns = response.json()["patterns"]
    assert any(item["id"] == "motor_startstop" for item in patterns)


@pytest.mark.asyncio
async def test_ir_schema_api(client, auth_headers):
    response = client.get("/v1/ir/schema", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["title"]
    assert "TimerNode" in str(body["schema"]) or "timer" in str(body["schema"])
    assert "requireEstop" in str(body["schema"])


@pytest.mark.asyncio
async def test_ir_validate_api(client, auth_headers):
    payload = IrService().get_pattern_ir(
        "motor_startstop",
        project_name="ValidateApi",
        vendor="rockwell",
        model="1769-L33ER",
    )
    response = client.post("/v1/ir/validate", headers=auth_headers, json={"program": payload["program"]})
    assert response.status_code == 200
    assert response.json()["valid"] is True


@pytest.mark.asyncio
async def test_ir_roundtrip_api(client, redis, auth_headers):
    payload = IrService().get_pattern_ir(
        "motor_startstop",
        project_name="RoundtripApi",
        vendor="schneider",
        model="TM221CE24R",
    )
    response = client.post("/v1/ir/roundtrip", headers=auth_headers, json={"program": payload["program"]})
    assert response.status_code == 202
    job_id = response.json()["jobId"]
    await process_job(redis, job_id)
    job = await JobStore(redis).get(job_id)
    assert job["status"] == "completed"
    assert job["result"]["roundtrip"]["ok"] is True

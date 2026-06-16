import base64
import io
import zipfile

import pytest

from api.jobs.store import JobStore
from api.jobs.tasks import process_job


@pytest.fixture
def mock_hmi(monkeypatch):
    class _Fake:
        def generate(self, **kwargs):
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w") as archive:
                archive.writestr("screen.vbs", "' test script")
                archive.writestr("tags.csv", "name,address,type,comment\n")
            return {
                "vendor": kwargs.get("vendor", "siemens-wincc"),
                "screenType": kwargs.get("screen_type", "process-overview"),
                "projectName": kwargs.get("project_name", "Demo"),
                "scriptFileName": "screen.vbs",
                "scriptContent": "' test script",
                "tagsCsv": "name,address,type,comment\n",
                "tags": [],
                "importGuide": "Import screen.vbs",
                "zipFileName": "Demo_hmi.zip",
                "contentBase64": base64.standard_b64encode(buffer.getvalue()).decode("ascii"),
                "mimeType": "application/zip",
            }

    fake = _Fake()
    monkeypatch.setattr("api.jobs.tasks.HmiService", lambda: fake)
    return fake


@pytest.fixture
def mock_copilot(monkeypatch):
    class _Fake:
        def copilot_chat(self, **kwargs):
            return {"text": "copilot ok", "usage": {"input_tokens": 1, "output_tokens": 2}}

        def engineer_chat(self, **kwargs):
            return {
                "text": "engineer ok",
                "usage": {"input_tokens": 1, "output_tokens": 2},
                "engineer": {"name": "Test", "role": "Engineer", "specialty": "PLC"},
            }

        def generate_application(self, **kwargs):
            return {"application": {"application_name": "TestApp"}}

        def library_search(self, **kwargs):
            return {"results": {"search_results": []}}

        def optimize_code(self, **kwargs):
            return {"analysis": {"summary": "ok"}}

    fake = _Fake()
    monkeypatch.setattr("api.jobs.tasks.AiCopilotService", lambda: fake)
    return fake


@pytest.mark.asyncio
async def test_copilot_chat_api(client, redis, auth_headers, mock_copilot):
    result = await _run_job(
        redis,
        client,
        "/v1/ai/copilot/chat",
        auth_headers,
        json={
            "messages": [{"sender": "user", "content": "Motor start stop"}],
            "mode": "generate",
            "uploadedImages": [],
        },
    )
    assert result["text"] == "copilot ok"


@pytest.mark.asyncio
async def test_engineer_chat_api(client, redis, auth_headers, mock_copilot):
    result = await _run_job(
        redis,
        client,
        "/v1/ai/engineer/chat",
        auth_headers,
        json={
            "messages": [{"sender": "user", "content": "Help"}],
            "engineerType": "schneider-specialist",
            "conversationContext": {"projectType": "Line"},
        },
    )
    assert result["text"] == "engineer ok"
    assert result["engineer"]["name"] == "Test"


@pytest.mark.asyncio
async def test_application_generate_api(client, redis, auth_headers, mock_copilot):
    result = await _run_job(
        redis,
        client,
        "/v1/ai/application/generate",
        auth_headers,
        json={"requirements": "Conveyor control", "platform": "schneider"},
    )
    assert result["application"]["application_name"] == "TestApp"


@pytest.mark.asyncio
async def test_library_search_api(client, redis, auth_headers, mock_copilot):
    result = await _run_job(
        redis,
        client,
        "/v1/ai/library/search",
        auth_headers,
        json={"query": "motor block", "platform": "schneider"},
    )
    assert "search_results" in result["results"]


@pytest.mark.asyncio
async def test_code_optimize_api(client, redis, auth_headers, mock_copilot):
    result = await _run_job(
        redis,
        client,
        "/v1/ai/code/optimize",
        auth_headers,
        json={"code": "LD %I0.0", "platform": "schneider"},
    )
    assert result["analysis"]["summary"] == "ok"


@pytest.mark.asyncio
async def test_hmi_generate_api(client, redis, auth_headers, mock_hmi):
    result = await _run_job(
        redis,
        client,
        "/v1/ai/hmi/generate",
        auth_headers,
        json={
            "vendor": "siemens-wincc",
            "screenType": "tank-level",
            "description": "Tank overview with level bar",
            "projectName": "WaterPlant",
        },
    )
    assert result["scriptFileName"] == "screen.vbs"
    assert result["zipFileName"] == "Demo_hmi.zip"
    assert result["contentBase64"]


async def _run_job(redis, client, path, auth_headers, json):
    response = client.post(path, headers=auth_headers, json=json)
    assert response.status_code == 202, response.text
    job_id = response.json()["jobId"]
    await process_job(redis, job_id)
    job = await JobStore(redis).get(job_id)
    assert job["status"] == "completed", job
    return job["result"]

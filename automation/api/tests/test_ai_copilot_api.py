import pytest

from api.jobs.store import JobStore
from api.jobs.tasks import process_job


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


async def _run_job(redis, client, path, auth_headers, json):
    response = client.post(path, headers=auth_headers, json=json)
    assert response.status_code == 202, response.text
    job_id = response.json()["jobId"]
    await process_job(redis, job_id)
    job = await JobStore(redis).get(job_id)
    assert job["status"] == "completed", job
    return job["result"]

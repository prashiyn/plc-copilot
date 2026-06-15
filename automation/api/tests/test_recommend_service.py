import pytest

from api.services.recommend_fallback import (
    analyze_error,
    generate_plc_recommendations,
    generate_solutions,
    rank_solutions,
    rectify_error_fallback,
)
from api.services.recommend_service import RecommendService, compute_required_io


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


def _sample_requirements(**overrides) -> dict:
    base = {
        "applicationName": "Conveyor",
        "applicationType": "material-handling",
        "ioRequirements": {
            "digitalInputs": 8,
            "digitalOutputs": 6,
            "analogInputs": 0,
            "analogOutputs": 0,
        },
        "budget": "500-1000",
        "environment": "indoor",
        "safetyRequirements": "basic",
        "expansionNeeded": False,
        "motionControl": False,
        "communicationProtocols": ["Modbus TCP"],
        "scanTimeRequirement": "standard",
    }
    base.update(overrides)
    return base


class TestComputeRequiredIo:
    def test_sums_io_points(self):
        req = _sample_requirements()
        assert compute_required_io(req) == 14

    def test_applies_expansion_buffer(self):
        req = _sample_requirements(expansionNeeded=True)
        assert compute_required_io(req) == 17


class TestPlcFallback:
    def test_returns_ranked_recommendations(self):
        result = generate_plc_recommendations(_sample_requirements(), required_io=14)
        assert 1 <= len(result) <= 3
        assert result[0]["score"] >= result[-1]["score"]
        assert all("manufacturer" in r and "model" in r for r in result)

    def test_includes_schneider_for_small_io(self):
        result = generate_plc_recommendations(_sample_requirements(), required_io=14)
        models = [r["model"] for r in result]
        assert "TM221C16R" in models


class TestSolutionFallback:
    def test_cheapest_criteria(self):
        solutions = generate_solutions("Small conveyor", None)
        ranked = rank_solutions(solutions, "cheapest")
        assert ranked[0]["cost"]["total"] <= ranked[-1]["cost"]["total"]

    def test_robust_criteria(self):
        solutions = generate_solutions("Safety system", None)
        ranked = rank_solutions(solutions, "robust")
        assert ranked[0]["robustness"]["score"] >= ranked[-1]["robustness"]["score"]


class TestRectifyFallback:
    def test_detects_schneider_timer_error(self):
        analysis = analyze_error("Timer format invalid for PT:=100", "schneider")
        assert analysis["errorType"] == "Timer Configuration Error"
        assert analysis["severity"] == "medium"

    def test_fixes_timer_format(self):
        code = "TON(IN:=Start, PT:=5000)"
        payload = {
            "programCode": code,
            "platform": "schneider",
            "errorMessage": "Timer format error",
            "plcModel": "TM221CE16T",
        }
        result = rectify_error_fallback(payload)
        assert result["success"] is True
        assert "T#5s" in result["solutions"][0]["correctedCode"]

    def test_general_fallback_when_unknown_error(self):
        payload = {
            "programCode": "LD %I0.0",
            "platform": "unknown",
            "errorMessage": "Something went wrong",
            "plcModel": "Generic",
        }
        result = rectify_error_fallback(payload)
        assert result["analysis"]["errorType"] == "Unknown Error"
        assert len(result["solutions"]) == 1


class TestRecommendService:
    def test_recommend_plc_ai_path(self):
        ai_response = [
            {
                "manufacturer": "Schneider Electric",
                "model": "TM221C16R",
                "series": "Modicon M221",
                "score": 90,
                "matchPercentage": 90,
                "price": 350,
                "reasons": ["fits"],
                "specifications": {
                    "ioPoints": 16,
                    "memory": "32 KB",
                    "scanTime": "0.5 ms",
                    "protocols": ["Modbus"],
                },
                "pros": ["cheap"],
                "cons": ["small"],
            }
        ]
        service = RecommendService(claude=FakeClaude([ai_response]))
        result = service.recommend_plc(_sample_requirements())
        assert result["source"] == "ai"
        assert result["recommendations"][0]["model"] == "TM221C16R"

    def test_recommend_plc_fallback_on_ai_failure(self):
        service = RecommendService(claude=FakeClaude([ValueError("api down")]))
        result = service.recommend_plc(_sample_requirements())
        assert result["source"] == "fallback"
        assert len(result["recommendations"]) >= 1

    def test_recommend_solution_ai_path(self):
        solutions = [
            {
                "name": "A",
                "platform": "Schneider Electric",
                "model": "TM221C16R",
                "description": "d",
                "cost": {"hardware": 1, "software": 0, "installation": 0, "maintenance": 0, "total": 600},
                "complexity": {"score": 3, "setupTime": "2h", "programmingDifficulty": "easy", "maintenanceLevel": "low"},
                "robustness": {"score": 6, "reliability": "99%", "safetyRating": "basic", "environmentalRating": "IP20", "mtbf": "1y"},
                "pros": [], "cons": [], "bestFor": [],
                "specifications": {"ioPoints": 16, "memoryKb": 32, "scanTime": "0.5ms", "communicationProtocols": [], "expandability": "low"},
            },
            {
                "name": "B",
                "platform": "Siemens",
                "model": "CPU 1214C",
                "description": "d",
                "cost": {"hardware": 1, "software": 0, "installation": 0, "maintenance": 0, "total": 2050},
                "complexity": {"score": 6, "setupTime": "8h", "programmingDifficulty": "med", "maintenanceLevel": "med"},
                "robustness": {"score": 9, "reliability": "99.9%", "safetyRating": "SIL2", "environmentalRating": "IP20", "mtbf": "2y"},
                "pros": [], "cons": [], "bestFor": [],
                "specifications": {"ioPoints": 14, "memoryKb": 125, "scanTime": "0.1ms", "communicationProtocols": [], "expandability": "high"},
            },
        ]
        service = RecommendService(claude=FakeClaude([solutions]))
        result = service.recommend_solution("Conveyor line", criteria="cheapest")
        assert result["source"] == "ai"
        assert result["recommended"]["name"] == "A"
        assert len(result["alternatives"]) >= 1

    def test_recommend_solution_fallback(self):
        service = RecommendService(claude=FakeClaude([ValueError("down")]))
        result = service.recommend_solution("Tank fill system", criteria="robust")
        assert result["source"] == "fallback"
        assert result["recommended"]["robustness"]["score"] >= 8

    def test_rectify_ai_path(self):
        ai_response = {
            "analysis": {
                "errorType": "Syntax Error",
                "severity": "medium",
                "affectedComponents": ["rung 1"],
                "rootCause": "missing semicolon",
            },
            "solutions": [
                {
                    "description": "Add semicolon",
                    "correctedCode": "LD %I0.0;",
                    "explanation": "IEC 61131-3 requires statement terminators",
                    "confidence": 92,
                }
            ],
            "recommendations": ["Review syntax"],
        }
        service = RecommendService(claude=FakeClaude([ai_response]))
        result = service.rectify_error(
            {
                "programCode": "LD %I0.0",
                "platform": "schneider",
                "errorMessage": "Syntax error",
                "plcModel": "TM221CE16T",
            }
        )
        assert result["source"] == "ai"
        assert result["solutions"][0]["confidence"] == 92

    def test_rectify_fallback(self):
        service = RecommendService(claude=FakeClaude([{"analysis": {}}]))
        result = service.rectify_error(
            {
                "programCode": "TON(IN:=X, PT:=100)",
                "platform": "schneider",
                "errorMessage": "Timer format invalid",
                "plcModel": "TM221CE16T",
            }
        )
        assert result["source"] == "fallback"
        assert "Timer" in result["analysis"]["errorType"]


class TestRecommendApi:
    @pytest.mark.asyncio
    async def test_recommend_plc_job(self, client, redis, auth_headers):
        from unittest.mock import MagicMock, patch

        from api.jobs.store import JobStore
        from api.jobs.tasks import process_job

        expected = {"recommendations": [{"model": "TM221C16R"}], "source": "ai"}
        mock_service = MagicMock()
        mock_service.recommend_plc.return_value = expected
        with patch("api.jobs.tasks.RecommendService", return_value=mock_service):
            response = client.post(
                "/v1/ai/recommend-plc",
                headers=auth_headers,
                json=_sample_requirements(),
            )
            assert response.status_code == 202
            job_id = response.json()["jobId"]
            await process_job(redis, job_id)
            job = await JobStore(redis).get(job_id)
            assert job["status"] == "completed"
            assert job["result"]["source"] == "ai"

    @pytest.mark.asyncio
    async def test_recommend_solution_job(self, client, redis, auth_headers):
        from unittest.mock import MagicMock, patch

        from api.jobs.store import JobStore
        from api.jobs.tasks import process_job

        expected = {
            "recommended": {"name": "Test"},
            "alternatives": [],
            "comparison": {"criteria": "Balanced", "reasoning": "r", "tradeoffs": []},
            "source": "fallback",
        }
        mock_service = MagicMock()
        mock_service.recommend_solution.return_value = expected
        with patch("api.jobs.tasks.RecommendService", return_value=mock_service):
            response = client.post(
                "/v1/ai/recommend-solution",
                headers=auth_headers,
                json={"projectDescription": "Conveyor", "criteria": "balanced"},
            )
            assert response.status_code == 202
            job_id = response.json()["jobId"]
            await process_job(redis, job_id)
            job = await JobStore(redis).get(job_id)
            assert job["result"]["source"] == "fallback"

    @pytest.mark.asyncio
    async def test_rectify_error_job(self, client, redis, auth_headers):
        from unittest.mock import MagicMock, patch

        from api.jobs.store import JobStore
        from api.jobs.tasks import process_job

        expected = {
            "success": True,
            "analysis": {"errorType": "Timer Configuration Error"},
            "solutions": [{"confidence": 95}],
            "recommendations": ["Check timers"],
            "source": "fallback",
        }
        mock_service = MagicMock()
        mock_service.rectify_error.return_value = expected
        with patch("api.jobs.tasks.RecommendService", return_value=mock_service):
            response = client.post(
                "/v1/ai/rectify-error",
                headers=auth_headers,
                json={
                    "programCode": "TON(IN:=X, PT:=100)",
                    "platform": "schneider",
                    "errorMessage": "Timer format",
                    "plcModel": "TM221CE16T",
                },
            )
            assert response.status_code == 202
            job_id = response.json()["jobId"]
            await process_job(redis, job_id)
            job = await JobStore(redis).get(job_id)
            assert job["result"]["success"] is True

    def test_recommend_plc_requires_auth(self, client):
        response = client.post("/v1/ai/recommend-plc", json=_sample_requirements())
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_recommend_plc_job_fallback_without_api_key(self, client, redis, auth_headers, monkeypatch):
        from api.jobs.store import JobStore
        from api.jobs.tasks import process_job

        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        response = client.post(
            "/v1/ai/recommend-plc",
            headers=auth_headers,
            json=_sample_requirements(),
        )
        assert response.status_code == 202
        job_id = response.json()["jobId"]
        await process_job(redis, job_id)
        job = await JobStore(redis).get(job_id)
        assert job["status"] == "completed"
        assert job["result"]["source"] == "fallback"
        assert len(job["result"]["recommendations"]) >= 1

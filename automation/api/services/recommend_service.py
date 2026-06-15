"""Claude-grounded PLC recommend / solution / rectify orchestration."""

from __future__ import annotations

import math
from typing import Any, Protocol

from .plc_catalog import build_catalog_text
from .recommend_fallback import (
    build_solution_response,
    generate_plc_recommendations,
    generate_solutions,
    rectify_error_fallback,
)


class ClaudeJsonClient(Protocol):
    def ask_json(
        self,
        system: str,
        prompt: str,
        max_tokens: int = 3072,
        model: str | None = None,
    ) -> Any: ...


def _io_requirements(requirements: dict[str, Any]) -> dict[str, int]:
    io = requirements.get("ioRequirements") or {}
    return {
        "digitalInputs": int(io.get("digitalInputs", 0)),
        "digitalOutputs": int(io.get("digitalOutputs", 0)),
        "analogInputs": int(io.get("analogInputs", 0)),
        "analogOutputs": int(io.get("analogOutputs", 0)),
    }


def compute_required_io(requirements: dict[str, Any]) -> int:
    io = _io_requirements(requirements)
    total = io["digitalInputs"] + io["digitalOutputs"] + io["analogInputs"] + io["analogOutputs"]
    if requirements.get("expansionNeeded"):
        return math.ceil(total * 1.2)
    return total


def _validate_plc_recommendations(parsed: Any) -> list[dict[str, Any]] | None:
    if not isinstance(parsed, list) or not parsed:
        return None
    valid: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        specs = item.get("specifications")
        if not isinstance(specs, dict):
            continue
        if not all(k in item for k in ("manufacturer", "model", "series", "price")):
            continue
        valid.append(item)
    return valid[:3] if valid else None


def _validate_solutions(parsed: Any) -> list[dict[str, Any]] | None:
    if not isinstance(parsed, list) or not parsed:
        return None
    valid: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        cost = item.get("cost")
        complexity = item.get("complexity")
        robustness = item.get("robustness")
        if not isinstance(cost, dict) or not isinstance(complexity, dict) or not isinstance(robustness, dict):
            continue
        if not all(isinstance(cost.get(k), (int, float)) for k in ("total",)):
            continue
        if not isinstance(complexity.get("score"), (int, float)):
            continue
        if not isinstance(robustness.get("score"), (int, float)):
            continue
        valid.append(item)
    return valid if len(valid) >= 2 else None


def _validate_rectify_response(parsed: Any) -> dict[str, Any] | None:
    if not isinstance(parsed, dict):
        return None
    analysis = parsed.get("analysis")
    solutions = parsed.get("solutions")
    recommendations = parsed.get("recommendations")
    if not isinstance(analysis, dict) or not isinstance(solutions, list) or not solutions:
        return None
    if not isinstance(recommendations, list):
        return None
    return {
        "success": True,
        "analysis": analysis,
        "solutions": solutions,
        "recommendations": recommendations,
    }


class RecommendService:
    def __init__(self, claude: ClaudeJsonClient | None = None) -> None:
        self._claude: ClaudeJsonClient | None = claude

    def _get_claude(self) -> ClaudeJsonClient:
        if self._claude is None:
            from .claude_service import ClaudeService

            self._claude = ClaudeService()
        return self._claude

    def recommend_plc(self, requirements: dict[str, Any]) -> dict[str, Any]:
        required_io = compute_required_io(requirements)
        try:
            recommendations = self._recommend_plcs_with_ai(requirements, required_io)
            return {"recommendations": recommendations, "source": "ai"}
        except Exception:
            recommendations = generate_plc_recommendations(requirements, required_io)
            return {"recommendations": recommendations, "source": "fallback"}

    def recommend_solution(
        self,
        project_description: str,
        criteria: str = "balanced",
        constraints: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            solutions = self._generate_solutions_with_ai(project_description, constraints)
            if solutions:
                response = build_solution_response(project_description, criteria, constraints, solutions)
                return {**response, "source": "ai"}
        except Exception:
            pass
        solutions = generate_solutions(project_description, constraints)
        response = build_solution_response(project_description, criteria, constraints, solutions)
        return {**response, "source": "fallback"}

    def rectify_error(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            ai_response = self._rectify_with_ai(payload)
            if ai_response:
                return {**ai_response, "source": "ai"}
        except Exception:
            pass
        return {**rectify_error_fallback(payload), "source": "fallback"}

    def _recommend_plcs_with_ai(self, requirements: dict[str, Any], required_io: int) -> list[dict[str, Any]]:
        system = (
            "You are a senior controls engineer. Recommend PLCs strictly from the "
            "provided catalog. Respond with JSON only — no prose, no markdown."
        )
        prompt = f"""CATALOG (manufacturer | series | model | specs):
{build_catalog_text()}

PROJECT REQUIREMENTS (JSON):
{requirements}

Estimated total I/O points needed: {required_io}.

Pick the 3 best-matching models FROM THE CATALOG ABOVE. Respond with a JSON array
of exactly 3 objects in this shape (price is a number in USD, matchPercentage 0-100):
[{{
  "manufacturer": "", "model": "", "series": "",
  "score": 0, "matchPercentage": 0, "price": 0,
  "reasons": ["why it fits this project"],
  "specifications": {{ "ioPoints": 0, "memory": "", "scanTime": "", "protocols": [""] }},
  "pros": [""], "cons": [""]
}}]"""
        parsed = self._get_claude().ask_json(system, prompt, max_tokens=3072)
        recommendations = _validate_plc_recommendations(parsed)
        if not recommendations:
            raise ValueError("Unexpected recommendation response")
        return recommendations

    def _generate_solutions_with_ai(
        self,
        project_description: str,
        constraints: dict[str, Any] | None,
    ) -> list[dict[str, Any]] | None:
        system = (
            "You are a senior controls engineer. Propose PLC solutions strictly from "
            "the provided catalog. Respond with JSON only — no prose, no markdown."
        )
        prompt = f"""CATALOG (manufacturer | series | model | specs):
{build_catalog_text()}

PROJECT: {project_description}
CONSTRAINTS (JSON): {constraints or {}}

Propose 4 distinct solutions FROM THE CATALOG. Respond with a JSON array of 4
objects EXACTLY in this shape (numbers are numeric, scores 1-10, costs in USD):
[{{
  "name": "", "platform": "", "model": "", "description": "",
  "cost": {{ "hardware": 0, "software": 0, "installation": 0, "maintenance": 0, "total": 0 }},
  "complexity": {{ "score": 0, "setupTime": "", "programmingDifficulty": "", "maintenanceLevel": "" }},
  "robustness": {{ "score": 0, "reliability": "", "safetyRating": "", "environmentalRating": "", "mtbf": "" }},
  "pros": [""], "cons": [""], "bestFor": [""],
  "specifications": {{ "ioPoints": 0, "memoryKb": 0, "scanTime": "", "communicationProtocols": [""], "expandability": "" }}
}}]"""
        parsed = self._get_claude().ask_json(system, prompt, max_tokens=4096)
        return _validate_solutions(parsed)

    def _rectify_with_ai(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        system = (
            "You are an expert PLC programmer debugging IEC 61131-3 code. Analyze the "
            "error and propose corrected code. Respond with JSON only — no prose, no markdown."
        )
        prompt = f"""PLATFORM: {payload.get('platform', '')}
PLC MODEL: {payload.get('plcModel', '')}
ERROR MESSAGE: {payload.get('errorMessage', '')}

PROGRAM CODE:
{payload.get('programCode', '')}

Respond with a JSON object EXACTLY in this shape (severity is one of
low|medium|high|critical; confidence is 0-100):
{{
  "analysis": {{
    "errorType": "", "severity": "medium",
    "affectedComponents": [""], "rootCause": ""
  }},
  "solutions": [
    {{ "description": "", "correctedCode": "", "explanation": "", "confidence": 0 }}
  ],
  "recommendations": [""]
}}"""
        parsed = self._get_claude().ask_json(system, prompt, max_tokens=4096)
        return _validate_rectify_response(parsed)

"""Claude → validated PlcProgram IR with retry and deterministic pattern fallback."""

from __future__ import annotations

import json
from typing import Any, Protocol

from ..ir.pattern_match import detect_pattern_from_description, normalize_vendor
from ..ir.patterns import build_pattern
from ..ir.schema_export import ir_schema_for_claude
from ..ir.validator import IrValidationError, program_summary, validate_program
from ..schemas.ir import PlcProgram, PlcVendor
from .claude_service import ClaudeService

MAX_RETRIES = 2

IR_SYSTEM_PROMPT = """You are a PLC intermediate-representation (IR) generator.
Return ONE JSON object: a PlcProgram for ladder-oriented logic.

Rules:
- Top-level keys: name, target {vendor, model}, vars[], pous[], meta (optional)
- Logic node types (discriminator "type"): contact, coil, and, or, not, timer, counter
- Every symbol used in logic MUST appear in vars with matching kind and dataType
- Timers: kind timer, dataType TON/TOF/TP; timer nodes must match var dataType
- Counters: kind counter, dataType CTU/CTD/CTUD
- Schneider addresses: %I0.x inputs, %Q0.x outputs, %M0 memory, %TM0 timers
- Motor start/stop: seal-in with START_BTN, STOP_BTN (NC), MOTOR_RUN output
- Do NOT emit vendor export formats (no L5X, no smbp XML, no SCL text)
- Output ONLY valid JSON — no markdown fences or commentary"""


class JsonAskClient(Protocol):
    def ask_json(
        self,
        system: str,
        prompt: str,
        max_tokens: int = 3072,
        model: str | None = None,
    ) -> Any: ...


class ClaudeIrService:
    def __init__(self, claude: JsonAskClient | None = None) -> None:
        self._claude = claude

    def generate_program_ir(
        self,
        description: str,
        *,
        vendor: str = "schneider",
        model: str = "TM221CE24R",
        project_name: str | None = None,
    ) -> dict[str, Any]:
        vendor_norm = normalize_vendor(vendor)
        pattern_hint, detected_name, num_lights, delay_seconds, cycle_seconds = detect_pattern_from_description(
            description
        )
        resolved_name = project_name or detected_name

        claude = self._claude or ClaudeService()
        last_errors: list[str] = []

        for attempt in range(MAX_RETRIES + 1):
            try:
                raw = claude.ask_json(
                    IR_SYSTEM_PROMPT,
                    _build_user_prompt(
                        description,
                        vendor=vendor_norm,
                        model=model,
                        project_name=resolved_name,
                        validation_errors=last_errors if attempt > 0 else None,
                    ),
                    max_tokens=4096,
                )
                if not isinstance(raw, dict):
                    raise ValueError("Claude response must be a JSON object (PlcProgram)")
                program = validate_program(
                    _normalize_program(raw, vendor=vendor_norm, model=model, project_name=resolved_name)
                )
                return _build_response(
                    program,
                    source="claude",
                    attempts=attempt + 1,
                    pattern=None,
                    fallback_reason=None,
                )
            except IrValidationError as exc:
                last_errors = list(exc.errors)
            except (ValueError, json.JSONDecodeError, TypeError) as exc:
                last_errors = [str(exc)]

        program = build_pattern(
            pattern_hint,
            project_name=resolved_name,
            vendor=vendor_norm,
            model=model,
            num_lights=num_lights,
            delay_seconds=delay_seconds,
            cycle_seconds=cycle_seconds,
        )
        validated = validate_program(program)
        reason = (
            f"Claude IR validation failed after {MAX_RETRIES + 1} attempts: "
            + "; ".join(last_errors[:3])
        )
        return _build_response(
            validated,
            source="pattern_fallback",
            attempts=MAX_RETRIES + 1,
            pattern=pattern_hint,
            fallback_reason=reason,
        )


def _build_user_prompt(
    description: str,
    *,
    vendor: PlcVendor,
    model: str,
    project_name: str,
    validation_errors: list[str] | None,
) -> str:
    schema_hint = json.dumps(ir_schema_for_claude()["schema"], indent=2)[:6000]
    parts = [
        f"Target vendor: {vendor}",
        f"Target model: {model}",
        f"Project name: {project_name}",
        "",
        "User requirement:",
        description.strip(),
        "",
        "PlcProgram JSON schema (follow this structure):",
        schema_hint,
    ]
    if validation_errors:
        parts.extend(
            [
                "",
                "Previous response was INVALID. Fix these issues:",
                *[f"- {err}" for err in validation_errors],
                "",
                "Return corrected PlcProgram JSON only.",
            ]
        )
    else:
        parts.append("")
        parts.append("Return the PlcProgram JSON object only.")
    return "\n".join(parts)


def _normalize_program(
    raw: dict[str, Any],
    *,
    vendor: PlcVendor,
    model: str,
    project_name: str,
) -> dict[str, Any]:
    program = dict(raw)
    program["name"] = str(program.get("name") or project_name)
    target = dict(program.get("target") or {})
    target["vendor"] = normalize_vendor(str(target.get("vendor") or vendor))
    target["model"] = str(target.get("model") or model)
    program["target"] = target
    if program.get("meta") is None:
        program["meta"] = {}
    return program


def _build_response(
    program: PlcProgram,
    *,
    source: str,
    attempts: int,
    pattern: str | None,
    fallback_reason: str | None,
) -> dict[str, Any]:
    return {
        "program": program.model_dump(),
        "summary": program_summary(program),
        "source": source,
        "attempts": attempts,
        "pattern": pattern,
        "fallbackReason": fallback_reason,
    }

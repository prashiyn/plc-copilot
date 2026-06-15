import json
import re
from typing import Any

import anthropic

from ..config import get_settings

PLC_SYSTEM_PROMPT = """You are an expert PLC programmer specializing in industrial automation.
You generate production-ready PLC programs following IEC 61131-3 standards.

IMPORTANT RULES:
1. Generate ONLY the program code in the requested JSON format, no explanations
2. Use proper I/O addressing for the specified PLC model
3. Include safety interlocks and emergency stop logic
4. Add meaningful comments for each rung/network
5. Follow the specific syntax for the target PLC platform
6. Include proper timer and counter configurations
7. Implement seal-in circuits for latching operations
8. Add overload protection where applicable

For Schneider M221 PLCs:
- Use %I0.x for digital inputs
- Use %Q0.x for digital outputs
- Use %M0-1023 for memory bits
- Use %TM0-254 for timers (TON, TOF, TP)
- Use %C0-254 for counters"""


class ClaudeService:
    def __init__(self) -> None:
        settings = get_settings()
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY not configured")
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model = settings.claude_model

    def chat(
        self,
        *,
        system: str | None,
        messages: list[dict[str, Any]],
        max_tokens: int = 4096,
        model: str | None = None,
    ) -> dict[str, Any]:
        response = self.client.messages.create(
            model=model or self.model,
            max_tokens=max_tokens,
            system=system or "",
            messages=messages,
        )
        text = ""
        for block in response.content:
            if block.type == "text":
                text += block.text
        return {
            "text": text,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        }

    def ask_json(self, system: str, prompt: str, max_tokens: int = 3072, model: str | None = None) -> Any:
        result = self.chat(
            system=system,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            model=model,
        )
        text = result["text"]
        match = re.search(r"\[[\s\S]*\]", text) or re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise ValueError("No JSON found in model response")
        return json.loads(match.group(0))

    def generate_m221_program(self, description: str, plc_model: str) -> str:
        prompt = f"""You are a Schneider Electric M221 PLC programming expert.
Generate a complete ladder logic program for the {plc_model} PLC.

USER REQUIREMENT:
{description}

Generate the I/O assignment and ladder logic rungs in this exact JSON format (no markdown, no explanation, ONLY JSON):
{{
  "projectName": "ProjectName",
  "inputs": [{{"address": "%I0.0", "symbol": "START_BTN", "comment": "Start Button NO"}}],
  "outputs": [{{"address": "%Q0.0", "symbol": "MOTOR", "comment": "Motor Output"}}],
  "memory": [{{"address": "%M0", "symbol": "RUN_FLAG", "comment": "Running Flag"}}],
  "timers": [],
  "rungs": [{{"name": "Motor Start/Stop", "comment": "Seal-in", "il": ["LD %I0.0"], "ladder": "..."}}]
}}

PLC Model {plc_model} specifications:
- Use %I0.x for digital inputs, %Q0.x for outputs, %M0-1023 memory, %TM0-254 timers."""

        result = self.chat(
            system=PLC_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4096,
        )
        text = result["text"]
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            return match.group(0)
        return text

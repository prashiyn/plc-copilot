"""BFF-facing AI features with prompts owned in Python."""

from __future__ import annotations

from typing import Any, Protocol

from .ai_prompts import (
    APPLICATION_GENERATE_SYSTEM,
    CODE_OPTIMIZE_SYSTEM,
    LIBRARY_SEARCH_SYSTEM,
    build_application_user_prompt,
    build_library_user_prompt,
    build_optimize_user_prompt,
    copilot_system_prompt,
    engineer_persona,
    engineer_system_prompt,
)


class ClaudeChatClient(Protocol):
    def chat(
        self,
        *,
        system: str | None,
        messages: list[dict[str, Any]],
        max_tokens: int = 4096,
        model: str | None = None,
    ) -> dict[str, Any]: ...

    def ask_json(self, system: str, prompt: str, max_tokens: int = 3072, model: str | None = None) -> Any: ...


def _message_role(msg: dict[str, Any]) -> str:
    if msg.get("role") in ("user", "assistant"):
        return str(msg["role"])
    sender = msg.get("sender")
    if sender == "user":
        return "user"
    return "assistant"


def _build_copilot_user_content(
    messages: list[dict[str, Any]],
    uploaded_images: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    if not messages:
        raise ValueError("messages array required")
    last = messages[-1]
    content: list[dict[str, Any]] = []
    for img in uploaded_images or []:
        data = img.get("data")
        if not data:
            continue
        content.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": img.get("mediaType") or img.get("media_type") or "image/jpeg",
                    "data": data,
                },
            }
        )
    content.append({"type": "text", "text": str(last.get("content", ""))})
    return content


class AiCopilotService:
    def __init__(self, claude: ClaudeChatClient | None = None) -> None:
        if claude is None:
            from .claude_service import ClaudeService

            claude = ClaudeService()
        self._claude = claude

    def copilot_chat(
        self,
        *,
        messages: list[dict[str, Any]],
        mode: str = "generate",
        uploaded_images: list[dict[str, Any]] | None = None,
        max_tokens: int = 4096,
    ) -> dict[str, Any]:
        system = copilot_system_prompt(mode)
        user_content = _build_copilot_user_content(messages, uploaded_images)
        return self._claude.chat(
            system=system,
            messages=[{"role": "user", "content": user_content}],
            max_tokens=max_tokens,
        )

    def engineer_chat(
        self,
        *,
        messages: list[dict[str, Any]],
        engineer_type: str = "general-expert",
        conversation_context: dict[str, Any] | None = None,
        max_tokens: int = 4096,
    ) -> dict[str, Any]:
        if not messages:
            raise ValueError("messages array required")
        system = engineer_system_prompt(engineer_type, conversation_context)
        claude_messages = [
            {"role": _message_role(msg), "content": str(msg.get("content", ""))} for msg in messages
        ]
        result = self._claude.chat(system=system, messages=claude_messages, max_tokens=max_tokens)
        persona = engineer_persona(engineer_type)
        result["engineer"] = {
            "name": persona["name"],
            "role": persona["role"],
            "specialty": persona["specialty"],
        }
        return result

    def generate_application(
        self,
        *,
        requirements: str,
        application_type: str | None = None,
        platform: str = "schneider",
        controller: str | None = None,
        io_count: str | None = None,
        safety_level: str = "standard",
        max_tokens: int = 8192,
    ) -> dict[str, Any]:
        prompt = build_application_user_prompt(
            requirements=requirements,
            application_type=application_type,
            platform=platform,
            controller=controller,
            io_count=io_count,
            safety_level=safety_level,
        )
        application = self._claude.ask_json(APPLICATION_GENERATE_SYSTEM, prompt, max_tokens=max_tokens)
        return {"application": application}

    def library_search(
        self,
        *,
        query: str,
        platform: str = "schneider",
        application_type: str | None = None,
        requirements: list[str] | None = None,
        generate_custom: bool = False,
        max_tokens: int = 6144,
    ) -> dict[str, Any]:
        prompt = build_library_user_prompt(
            query=query,
            platform=platform,
            application_type=application_type,
            requirements=requirements or [],
            generate_custom=generate_custom,
        )
        results = self._claude.ask_json(LIBRARY_SEARCH_SYSTEM, prompt, max_tokens=max_tokens)
        return {"results": results}

    def optimize_code(
        self,
        *,
        code: str,
        platform: str = "schneider",
        optimization_goals: list[str] | None = None,
        current_issues: str = "",
        max_tokens: int = 8192,
    ) -> dict[str, Any]:
        prompt = build_optimize_user_prompt(
            code=code,
            platform=platform,
            optimization_goals=optimization_goals or [],
            current_issues=current_issues,
        )
        analysis = self._claude.ask_json(CODE_OPTIMIZE_SYSTEM, prompt, max_tokens=max_tokens)
        return {"analysis": analysis}

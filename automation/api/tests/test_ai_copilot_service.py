import pytest

from api.services.ai_copilot_service import AiCopilotService


class FakeClaude:
    def __init__(self) -> None:
        self.last_system: str | None = None
        self.last_messages: list | None = None
        self.last_prompt: str | None = None
        self.last_max_tokens: int | None = None

    def chat(self, *, system, messages, max_tokens=4096, model=None):
        self.last_system = system
        self.last_messages = messages
        self.last_max_tokens = max_tokens
        return {
            "text": "assistant reply",
            "usage": {"input_tokens": 10, "output_tokens": 20},
        }

    def ask_json(self, system, prompt, max_tokens=3072, model=None):
        self.last_system = system
        self.last_prompt = prompt
        self.last_max_tokens = max_tokens
        return {"ok": True, "feature": system[:20]}


class TestAiCopilotService:
    def test_copilot_chat_builds_multimodal_last_message(self):
        claude = FakeClaude()
        service = AiCopilotService(claude)
        result = service.copilot_chat(
            messages=[{"sender": "user", "content": "Create motor logic"}],
            mode="generate",
            uploaded_images=[{"data": "abc123", "mediaType": "image/png"}],
        )
        assert result["text"] == "assistant reply"
        assert claude.last_system is not None
        assert "production-ready PLC code" in claude.last_system
        assert claude.last_messages is not None
        content = claude.last_messages[0]["content"]
        assert any(block.get("type") == "image" for block in content)
        assert any(block.get("type") == "text" for block in content)

    def test_engineer_chat_maps_sender_roles(self):
        claude = FakeClaude()
        service = AiCopilotService(claude)
        result = service.engineer_chat(
            messages=[
                {"sender": "user", "content": "Help with M221"},
                {"sender": "engineer", "content": "Sure"},
            ],
            engineer_type="schneider-specialist",
            conversation_context={"projectType": "Packaging"},
        )
        assert result["engineer"]["name"] == "Dr. James Peterson"
        assert claude.last_messages == [
            {"role": "user", "content": "Help with M221"},
            {"role": "assistant", "content": "Sure"},
        ]
        assert "Packaging" in (claude.last_system or "")

    def test_generate_application_uses_python_prompts(self):
        claude = FakeClaude()
        service = AiCopilotService(claude)
        out = service.generate_application(requirements="Tank level control", platform="siemens")
        assert "application" in out
        assert claude.last_prompt is not None
        assert "Tank level control" in claude.last_prompt
        assert claude.last_system.endswith("JSON only.")

    def test_library_search_returns_results_wrapper(self):
        claude = FakeClaude()
        service = AiCopilotService(claude)
        out = service.library_search(query="PID block", requirements=["analog"])
        assert "results" in out
        assert "PID block" in (claude.last_prompt or "")

    def test_optimize_code_returns_analysis_wrapper(self):
        claude = FakeClaude()
        service = AiCopilotService(claude)
        out = service.optimize_code(code="PROGRAM Main", optimization_goals=["readability"])
        assert "analysis" in out
        assert "PROGRAM Main" in (claude.last_prompt or "")

    def test_copilot_chat_requires_messages(self):
        service = AiCopilotService(FakeClaude())
        with pytest.raises(ValueError, match="messages"):
            service.copilot_chat(messages=[])

    def test_engineer_chat_requires_messages(self):
        service = AiCopilotService(FakeClaude())
        with pytest.raises(ValueError, match="messages"):
            service.engineer_chat(messages=[])

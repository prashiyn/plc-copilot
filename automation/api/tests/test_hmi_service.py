import base64
import io
import zipfile

import pytest

from api.services.ai_prompts import build_hmi_user_prompt
from api.services.hmi_service import HmiService, tags_to_csv


class FakeClaude:
    def __init__(self, response: dict):
        self.response = response
        self.last_prompt = ""

    def ask_json(self, system: str, prompt: str, max_tokens: int = 4096, model: str | None = None):
        self.last_prompt = prompt
        return self.response


class TestHmiPrompts:
    def test_build_hmi_user_prompt_includes_vendor_and_screen(self):
        prompt = build_hmi_user_prompt(
            vendor="siemens-wincc",
            screen_type="tank-level",
            description="Tank overview with level bar",
            project_name="WaterPlant",
            tags=[{"name": "TANK_LEVEL", "address": "%IW0", "type": "REAL", "comment": "PV"}],
        )
        assert "siemens-wincc" in prompt
        assert "tank-level" in prompt
        assert "TANK_LEVEL" in prompt
        assert "WaterPlant" in prompt


class TestHmiService:
    def test_generate_returns_zip_artifact(self):
        fake = FakeClaude(
            {
                "scriptFileName": "main_screen.vbs",
                "scriptContent": "' WinCC screen script\nSub Main()\nEnd Sub",
                "tags": [
                    {"name": "PUMP_RUN", "address": "%Q0.0", "type": "BOOL", "comment": "Pump"},
                ],
                "importGuide": "Open WinCC and import main_screen.vbs",
            }
        )
        result = HmiService(claude=fake).generate(
            vendor="siemens-wincc",
            screen_type="process-overview",
            description="Main overview with pump status",
            project_name="DemoPlant",
        )
        assert result["scriptFileName"] == "main_screen.vbs"
        assert "WinCC" in result["importGuide"]
        assert "PUMP_RUN" in result["tagsCsv"]

        raw = base64.standard_b64decode(result["contentBase64"])
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            names = set(archive.namelist())
            assert "main_screen.vbs" in names
            assert "tags.csv" in names
            assert any(name.endswith("_README_IMPORT.txt") for name in names)

    def test_tags_to_csv_header(self):
        csv_text = tags_to_csv([{"name": "TAG1", "address": "%M0", "type": "BOOL", "comment": "Test"}])
        assert csv_text.startswith("name,address,type,comment")
        assert "TAG1" in csv_text

    def test_missing_script_content_raises(self):
        fake = FakeClaude({"scriptFileName": "x.vbs", "scriptContent": "", "tags": []})
        with pytest.raises(ValueError, match="scriptContent"):
            HmiService(claude=fake).generate(
                vendor="ignition",
                screen_type="custom",
                description="Screen",
                project_name="Proj",
            )

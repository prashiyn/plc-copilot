"""CLI --from-json uses the same IR pipeline as ProgramService."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from plc_file_handler.cli import _load_generation_source

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "sketch"
MOTOR_ANALYSIS = FIXTURES / "motor_startstop_analysis.json"


class TestCliJsonLoader:
    def test_sketch_analysis_json(self):
        source = _load_generation_source(str(MOTOR_ANALYSIS), "schneider")
        assert source["type"] == "sketch_analysis"
        assert "rungs" in source["analysis"]

    def test_legacy_tags_rungs_json(self, tmp_path):
        legacy = {
            "tags": [
                {"name": "START_BTN", "address": "%I0.0", "type": "BOOL"},
                {"name": "MOTOR_RUN", "address": "%Q0.0", "type": "BOOL"},
            ],
            "rungs": [
                {
                    "rung_number": 0,
                    "elements": [
                        {"type": "contact_no", "label": "START_BTN", "address": "%I0.0", "branch": 0},
                        {"type": "coil", "label": "MOTOR_RUN", "address": "%Q0.0", "branch": 0},
                    ],
                }
            ],
        }
        path = tmp_path / "legacy.json"
        path.write_text(json.dumps(legacy), encoding="utf-8")
        source = _load_generation_source(str(path), "rockwell")
        assert source["type"] == "sketch_analysis"
        assert source["analysis"]["target_platform"] == "rockwell"
        assert source["analysis"]["tags_detected"][0]["type"] == "INPUT"

    def test_invalid_json_raises(self, tmp_path):
        path = tmp_path / "bad.json"
        path.write_text('{"foo": 1}', encoding="utf-8")
        with pytest.raises(ValueError, match="JSON must be"):
            _load_generation_source(str(path), "schneider")

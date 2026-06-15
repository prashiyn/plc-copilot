import json

import pytest

from api.tests.golden_utils import IR_FIXTURES_DIR, IR_FIXTURE_CASES, build_ir_program


class TestGoldenIrFixtures:
    @pytest.mark.parametrize("case", IR_FIXTURE_CASES, ids=lambda case: case["id"])
    def test_ir_fixture_matches_build_pattern(self, case):
        fixture_path = IR_FIXTURES_DIR / f"{case['id']}.json"
        assert fixture_path.is_file(), f"Missing golden IR fixture: {fixture_path}"

        expected = json.loads(fixture_path.read_text(encoding="utf-8"))
        actual = build_ir_program(case)
        assert actual == expected

import pytest

from api.services.ir_service import IrService
from api.tests.golden_utils import EXPORT_CASES, export_hash, load_export_manifest


@pytest.fixture
def service():
    return IrService()


class TestGoldenExportHashes:
    def test_manifest_exists(self):
        manifest = load_export_manifest()
        assert manifest["version"] == 1
        assert manifest["exports"]

    @pytest.mark.parametrize("case", EXPORT_CASES, ids=lambda case: case["id"])
    def test_export_hash_matches_manifest(self, service, case):
        manifest = load_export_manifest()
        entry = manifest["exports"][case["id"]]
        actual_hash = export_hash(service, case)
        assert actual_hash == entry["sha256"], (
            f"Golden export hash mismatch for {case['id']}. "
            "Run: cd automation && uv run python api/tests/update_golden_fixtures.py"
        )

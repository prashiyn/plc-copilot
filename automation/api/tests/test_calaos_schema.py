"""Phase 5 P1 — Calaos/Case 2.0 subset XSD validation."""

import base64
from pathlib import Path

import pytest

from api.ir.patterns import PATTERN_CATALOG
from api.services.ir_service import IrService
from api.validation.xsd_validate import validate_calaos_smbp

SAMPLES_DIR = Path(__file__).resolve().parents[2] / "samples"
GOLDEN_CALAOS = SAMPLES_DIR / "tankcontrol.smbp"

SCHNEIDER_PATTERNS = [
    pattern_id
    for pattern_id, meta in PATTERN_CATALOG.items()
    if "schneider" in meta.get("vendors", [])
]


@pytest.fixture
def service():
    return IrService()


class TestCalaosGoldenSample:
    def test_tankcontrol_sample_passes_subset_xsd(self):
        errors = validate_calaos_smbp(GOLDEN_CALAOS.read_bytes())
        assert errors == [], errors

    def test_sample_has_calaos_namespace(self):
        text = GOLDEN_CALAOS.read_text(encoding="utf-8")
        assert "Calaos/Case/2.0" in text
        assert "<ProjectDescriptor" not in text


class TestCalaosGeneratedExports:
    @pytest.mark.parametrize("pattern", SCHNEIDER_PATTERNS)
    def test_pattern_export_passes_subset_xsd(self, service, pattern):
        payload = service.get_pattern_ir(
            pattern,
            project_name=f"Schema_{pattern}",
            vendor="schneider",
            model="TM221CE24R",
            num_lights=4,
            delay_seconds=3,
            cycle_seconds=5,
        )
        result = service.serialize(payload["program"])
        raw = base64.standard_b64decode(result["contentBase64"])
        errors = validate_calaos_smbp(raw)
        assert errors == [], f"{pattern}: {errors}"

    def test_invalid_xml_fails_validation(self):
        errors = validate_calaos_smbp(b"<Project><unclosed>")
        assert errors

"""Tests for schema manifest and L5X version resolution."""

import base64

import pytest

from api.services.ir_service import IrService
from api.validation.schema_registry import (
    detect_l5x_software_revision,
    list_registered_schemas,
    load_schema_manifest,
    resolve_l5x_schema_path,
)
from api.validation.xsd_validate import validate_l5x


@pytest.fixture
def motor_l5x_bytes():
    service = IrService()
    payload = service.get_pattern_ir(
        "motor_startstop",
        project_name="RevMotor",
        vendor="rockwell",
        model="1769-L33ER",
    )
    result = service.serialize(payload["program"])
    return base64.standard_b64decode(result["contentBase64"])


class TestSchemaManifest:
    def test_manifest_loads(self):
        manifest = load_schema_manifest()
        assert manifest["version"] == 1
        assert "rockwell_l5x" in manifest["providers"]
        assert "schneider_calaos" in manifest["providers"]

    def test_registered_schemas_includes_v32(self):
        rows = list_registered_schemas()
        rockwell = [row for row in rows if row["provider"] == "rockwell_l5x"]
        assert any(row["file"] == "l5x-v32.xsd" for row in rockwell)


class TestL5xVersionResolution:
    def test_detects_software_revision(self, motor_l5x_bytes):
        revision = detect_l5x_software_revision(motor_l5x_bytes)
        assert revision == "32.00"

    def test_resolves_v32_schema_by_default(self, motor_l5x_bytes):
        path = resolve_l5x_schema_path(motor_l5x_bytes)
        assert path.name == "l5x-v32.xsd"

    def test_override_major_selects_schema_when_present(self, motor_l5x_bytes):
        path = resolve_l5x_schema_path(motor_l5x_bytes, override_major=32)
        assert path.name == "l5x-v32.xsd"

    def test_missing_older_schema_falls_back_to_default(self, motor_l5x_bytes):
        path = resolve_l5x_schema_path(motor_l5x_bytes, override_major=28)
        assert path.name == "l5x-v32.xsd"

    def test_validate_with_target_major_still_passes_current_export(self, motor_l5x_bytes):
        errors = validate_l5x(motor_l5x_bytes, target_major=32)
        assert errors == []

"""Phase 4b′ — IR platform provider registry."""

import base64

import pytest

from api.ir.patterns import build_pattern
from api.ir.registry import (
    ensure_providers_registered,
    expected_vendors,
    get_plcopen_provider,
    get_provider,
    list_providers,
    register_provider,
    reset_providers_for_tests,
)
from api.ir.providers.schneider_calaos import SchneiderCalaosProvider
from api.ir.serializer import IrSerializer
from api.services.ir_service import IrService


@pytest.fixture(autouse=True)
def _fresh_registry():
    reset_providers_for_tests()
    ensure_providers_registered()
    yield
    reset_providers_for_tests()


class TestProviderRegistry:
    def test_builtin_vendors_registered(self):
        registered = {item["vendor"] for item in list_providers()}
        assert registered == set(expected_vendors())

    def test_list_providers_includes_provider_class_names(self):
        providers = {item["vendor"]: item["provider"] for item in list_providers()}
        assert providers["schneider"] == "SchneiderCalaosProvider"
        assert providers["rockwell"] == "RockwellProvider"
        assert providers["siemens"] == "SiemensSclProvider"
        assert providers["mitsubishi"] == "MitsubishiProvider"
        assert providers["codesys"] == "PlcopenProvider"
        assert providers["generic"] == "PlcopenProvider"

    def test_get_provider_returns_vendor_specific_instance(self):
        assert get_provider("schneider").vendor == "schneider"
        assert get_provider("codesys").vendor == "codesys"
        assert get_provider("generic").vendor == "generic"

    def test_unknown_vendor_falls_back_to_generic(self):
        assert get_provider("unknown-oem").vendor == "generic"

    def test_register_provider_rejects_vendor_mismatch(self):
        with pytest.raises(ValueError, match="does not match"):
            register_provider("rockwell", SchneiderCalaosProvider())

    def test_custom_provider_override(self):
        class StubProvider:
            vendor = "schneider"

            def serialize(self, program):
                return {"fileName": "stub.smbp", "mimeType": "text/plain", "contentBase64": "", "metadata": {}}

        register_provider("schneider", StubProvider())
        assert type(get_provider("schneider")) is StubProvider


class TestIrSerializerUsesRegistry:
    @pytest.mark.parametrize(
        ("vendor", "pattern", "suffix"),
        [
            ("schneider", "motor_startstop", ".smbp"),
            ("rockwell", "motor_startstop", ".L5X"),
            ("siemens", "motor_startstop", ".scl"),
            ("mitsubishi", "motor_startstop", ".zip"),
        ],
    )
    def test_serialize_routes_through_registered_provider(self, vendor, pattern, suffix):
        program = build_pattern(
            pattern,
            project_name=f"Registry_{vendor}",
            vendor=vendor,
            model="TM221CE24R" if vendor == "schneider" else "1769-L33ER",
        )
        result = IrSerializer().serialize(program)
        assert result["fileName"].endswith(suffix)
        assert result["metadata"]["platform"] == vendor

    def test_sequential_lights_rockwell_still_supported(self):
        program = build_pattern(
            "sequential_lights",
            project_name="RegistrySeq",
            vendor="rockwell",
            model="1769-L33ER",
            num_lights=4,
            delay_seconds=3,
        )
        result = IrSerializer().serialize(program)
        assert result["fileName"] == "RegistrySeq.L5X"
        assert result["metadata"]["pattern"] == "sequential_lights"

    def test_serialize_plcopen_uses_generic_provider(self):
        payload = IrService().get_pattern_ir(
            "motor_startstop",
            project_name="RegistryPlcopen",
            vendor="codesys",
            model="Generic",
        )
        program = payload["program"]
        program["target"] = {"vendor": "codesys", "model": "Generic"}
        result = IrService().serialize_plcopen(program)
        xml = base64.standard_b64decode(result["contentBase64"]).decode("utf-8")
        assert "plcopen.org" in xml
        assert get_plcopen_provider().vendor == "generic"

    def test_ensure_providers_registered_is_idempotent(self):
        first = list(list_providers())
        ensure_providers_registered()
        second = list(list_providers())
        assert first == second
        assert len(first) == len(expected_vendors())

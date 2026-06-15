"""Platform provider registry for IR serialization."""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from ..schemas.ir import PlcProgram, PlcVendor

_BUILTIN_VENDORS: frozenset[PlcVendor] = frozenset({
    "schneider",
    "rockwell",
    "siemens",
    "mitsubishi",
    "codesys",
    "generic",
})


@runtime_checkable
class PlatformProvider(Protocol):
    vendor: PlcVendor

    def serialize(self, program: PlcProgram) -> dict[str, Any]: ...


class ProviderRegistryError(LookupError):
    pass


_providers: dict[PlcVendor, PlatformProvider] = {}
_registered = False


def register_provider(vendor: PlcVendor, provider: PlatformProvider) -> None:
    if provider.vendor != vendor:
        raise ValueError(
            f"Provider vendor {provider.vendor!r} does not match registration key {vendor!r}"
        )
    _providers[vendor] = provider


def get_provider(vendor: str) -> PlatformProvider:
    ensure_providers_registered()
    key = vendor if vendor in _providers else "generic"
    provider = _providers.get(key)
    if provider is None:
        raise ProviderRegistryError(f"No IR provider registered for vendor: {vendor}")
    return provider


def get_plcopen_provider() -> PlatformProvider:
    ensure_providers_registered()
    provider = _providers.get("generic")
    if provider is None:
        raise ProviderRegistryError("PLCopen provider is not registered")
    return provider


def list_providers() -> list[dict[str, str]]:
    ensure_providers_registered()
    return [
        {"vendor": vendor, "provider": type(_providers[vendor]).__name__}
        for vendor in sorted(_providers.keys())
    ]


def expected_vendors() -> frozenset[PlcVendor]:
    return _BUILTIN_VENDORS


def ensure_providers_registered() -> None:
    global _registered
    if _registered:
        return
    from .providers import register_builtin_providers

    register_builtin_providers()
    _registered = True


def reset_providers_for_tests() -> None:
    """Clear registry state — test helper only."""
    global _registered
    _providers.clear()
    _registered = False

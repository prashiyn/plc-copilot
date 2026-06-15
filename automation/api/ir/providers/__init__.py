"""Built-in IR platform providers."""

from __future__ import annotations

from ..registry import register_provider
from .mitsubishi import MitsubishiProvider
from .plcopen import PlcopenProvider
from .rockwell import RockwellProvider
from .schneider_calaos import SchneiderCalaosProvider
from .siemens_scl import SiemensSclProvider

_PLCOPEN_GENERIC = PlcopenProvider("generic")
_PLCOPEN_CODESYS = PlcopenProvider("codesys")


def register_builtin_providers() -> None:
    register_provider("schneider", SchneiderCalaosProvider())
    register_provider("rockwell", RockwellProvider())
    register_provider("siemens", SiemensSclProvider())
    register_provider("mitsubishi", MitsubishiProvider())
    register_provider("codesys", _PLCOPEN_CODESYS)
    register_provider("generic", _PLCOPEN_GENERIC)

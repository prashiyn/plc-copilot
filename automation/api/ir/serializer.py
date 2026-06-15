from pathlib import Path
from typing import Any

from ..schemas.ir import PlcProgram
from .registry import ensure_providers_registered, get_plcopen_provider, get_provider
from .serializers.schneider_calaos import CALAOS_TEMPLATE

SAMPLES_DIR = Path(__file__).resolve().parents[2] / "samples"
SEQUENTIAL_TEMPLATE = CALAOS_TEMPLATE


class IrSerializer:
    def serialize(self, program: PlcProgram) -> dict[str, Any]:
        ensure_providers_registered()
        provider = get_provider(program.target.vendor)
        return provider.serialize(program)

    def serialize_plcopen(self, program: PlcProgram) -> dict[str, Any]:
        ensure_providers_registered()
        return get_plcopen_provider().serialize(program)

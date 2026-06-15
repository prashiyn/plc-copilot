from __future__ import annotations

import io
import zipfile
from typing import Any

from ...schemas.ir import PlcProgram
from ..serialize_helpers import file_result
from ..serializers.mitsubishi import build_mitsubishi_tier2_export


class MitsubishiProvider:
    vendor = "mitsubishi"

    def serialize(self, program: PlcProgram) -> dict[str, Any]:
        bundle = build_mitsubishi_tier2_export(program, program.target.model)
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr(bundle["ilFileName"], bundle["il"])
            archive.writestr(bundle["stFileName"], bundle["st"])
            archive.writestr(bundle["csvFileName"], bundle["csv"])
        content = buffer.getvalue()
        return file_result(
            f"{program.name}_mitsubishi.zip",
            content,
            "application/zip",
            program.meta.pattern or "ir",
            self.vendor,
            program.target.model,
            file_format="mitsubishi_tier2_zip",
            tier=2,
            disclaimer="source import, not a GX Works project",
            metadata_extra={
                "files": [bundle["ilFileName"], bundle["stFileName"], bundle["csvFileName"]],
                "formats": ["il", "st", "csv"],
                "limitations": bundle["limitations"],
            },
        )

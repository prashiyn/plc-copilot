"""
Siemens TIA Portal Parser
Supports PLC AutoPilot Tier-2 `.scl` source exports for symbol-level round-trip checks.
Full `.ap*` / `.zap*` parsing is not implemented.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Dict


class SiemensParser:
    """Parser for Siemens exports (.scl source) and TIA project files (.zap*, .ap*)."""

    _VAR_LINE = re.compile(
        r"^\s*(\w+)\s*(?:AT\s+(%[IQMT][\w.]+))?\s*:\s*(\w+)\s*;",
        re.IGNORECASE | re.MULTILINE,
    )

    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        self.project_data: Dict = {}

    def parse(self) -> Dict:
        if self.file_path.suffix.lower() == ".scl":
            text = self.file_path.read_text(encoding="utf-8")
            return self._parse_scl(text)
        raise NotImplementedError(
            "Siemens binary project parser not implemented. "
            "Use `.scl` source exports or TIA Portal Openness API for full projects."
        )

    def _parse_scl(self, text: str) -> Dict:
        tags = []
        seen: set[str] = set()
        for match in self._VAR_LINE.finditer(text):
            name, address, data_type = match.groups()
            if name in seen:
                continue
            seen.add(name)
            tags.append(
                {
                    "name": name,
                    "address": address or "",
                    "type": data_type,
                }
            )

        ob_match = re.search(r'ORGANIZATION_BLOCK\s+"([^"]+)"', text, re.IGNORECASE)
        program_name = ob_match.group(1) if ob_match else "Main"

        return {
            "platform": "siemens_scl",
            "format": "scl",
            "project_name": self.file_path.stem,
            "tags": tags,
            "programs": [{"name": program_name, "language": "SCL"}],
            "source_text": text,
        }

    def get_summary(self) -> str:
        if self.file_path.suffix.lower() == ".scl":
            data = self.parse()
            tag_names = ", ".join(tag["name"] for tag in data.get("tags", [])[:8])
            suffix = "..." if len(data.get("tags", [])) > 8 else ""
            return f"Siemens SCL source: {len(data.get('tags', []))} symbols ({tag_names}{suffix})"
        return "Siemens parser: binary TIA projects not supported; use `.scl` exports."

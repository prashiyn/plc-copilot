"""
Mitsubishi GX Works Parser
Supports PLC AutoPilot Tier-2 `.il`, `.csv`, and bundled `.zip` exports for symbol-level round-trip checks.
Native `.gxw` / `.gx3` parsing is not implemented.
"""

from __future__ import annotations

import csv
import io
import re
import zipfile
from pathlib import Path
from typing import Dict


class MitsubishiParser:
    """Parser for Mitsubishi Tier-2 source exports and GX Works project files."""

    _SYMBOL_MAP_LINE = re.compile(r"^\s*;\s*(\w+)\s*=\s*(\w+)\s*$", re.MULTILINE)

    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        self.project_data: Dict = {}

    def parse(self) -> Dict:
        suffix = self.file_path.suffix.lower()
        if suffix == ".zip":
            return self._parse_zip()
        if suffix == ".il":
            return self._parse_bundle(self.file_path.read_text(encoding="utf-8"), "")
        if suffix == ".csv":
            return self._parse_bundle("", self.file_path.read_text(encoding="utf-8"))
        raise NotImplementedError(
            "Mitsubishi binary project parser not implemented. "
            "Use Tier-2 `.zip`, `.il`, or `.csv` exports from PLC AutoPilot."
        )

    def _parse_zip(self) -> Dict:
        il_text = ""
        csv_text = ""
        with zipfile.ZipFile(self.file_path) as archive:
            for name in archive.namelist():
                payload = archive.read(name).decode("utf-8")
                lower = name.lower()
                if lower.endswith(".il"):
                    il_text = payload
                elif lower.endswith(".csv"):
                    csv_text = payload
        return self._parse_bundle(il_text, csv_text)

    def _parse_bundle(self, il_text: str, csv_text: str) -> Dict:
        tags: list[dict[str, str]] = []
        seen: set[str] = set()

        for match in self._SYMBOL_MAP_LINE.finditer(il_text):
            name, device = match.groups()
            if name in seen:
                continue
            seen.add(name)
            tags.append({"name": name, "address": device, "type": "BOOL"})

        if csv_text.strip():
            reader = csv.DictReader(io.StringIO(csv_text))
            for row in reader:
                symbol = (row.get("Symbol") or "").strip()
                device = (row.get("Device") or "").strip()
                comment = (row.get("Comment") or "").strip()
                if not symbol or symbol in seen:
                    continue
                seen.add(symbol)
                tags.append(
                    {
                        "name": symbol,
                        "address": device,
                        "type": "BOOL",
                        "comment": comment,
                    }
                )

        return {
            "platform": "mitsubishi_tier2",
            "format": "il",
            "project_name": self.file_path.stem.replace("_mitsubishi", ""),
            "tags": tags,
            "programs": [{"name": "Main", "language": "IL"}],
            "source_text": il_text,
        }

    def get_summary(self) -> str:
        suffix = self.file_path.suffix.lower()
        if suffix in {".zip", ".il", ".csv"}:
            data = self.parse()
            tag_names = ", ".join(tag["name"] for tag in data.get("tags", [])[:8])
            suffix_hint = "..." if len(data.get("tags", [])) > 8 else ""
            return f"Mitsubishi Tier-2 source: {len(data.get('tags', []))} symbols ({tag_names}{suffix_hint})"
        return "Mitsubishi parser: native GX Works projects not supported; use Tier-2 `.zip` exports."

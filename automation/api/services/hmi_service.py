"""HMI screen generator — AI-backed importable script + tag CSV artifacts."""

from __future__ import annotations

import base64
import csv
import io
import re
import zipfile
from typing import Any, Protocol

from .ai_prompts import HMI_SYSTEM, build_hmi_user_prompt, hmi_vendor_config


class JsonAskClient(Protocol):
    def ask_json(self, system: str, prompt: str, max_tokens: int = 4096, model: str | None = None) -> Any: ...


def _safe_base_name(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "_", name.strip()) or "HMI_Project"
    return cleaned[:80]


def tags_to_csv(tags: list[dict[str, str]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(["name", "address", "type", "comment"])
    for tag in tags:
        writer.writerow([
            tag.get("name", ""),
            tag.get("address", ""),
            tag.get("type", "BOOL"),
            tag.get("comment", ""),
        ])
    return buffer.getvalue()


def build_hmi_zip(
    *,
    project_name: str,
    script_file_name: str,
    script_content: str,
    tags_csv: str,
    import_guide: str,
) -> bytes:
    base = _safe_base_name(project_name)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(script_file_name, script_content)
        archive.writestr("tags.csv", tags_csv)
        readme = (
            f"HMI Import Package — {project_name}\n"
            f"{'=' * 40}\n\n"
            f"{import_guide.strip()}\n\n"
            f"Files:\n"
            f"  - {script_file_name}\n"
            f"  - tags.csv\n"
        )
        archive.writestr(f"{base}_README_IMPORT.txt", readme)
    return buffer.getvalue()


class HmiService:
    def __init__(self, claude: JsonAskClient | None = None) -> None:
        if claude is None:
            from .claude_service import ClaudeService

            claude = ClaudeService()
        self._claude = claude

    def generate(
        self,
        *,
        vendor: str,
        screen_type: str,
        description: str,
        project_name: str,
        tags: list[dict[str, str]] | None = None,
        max_tokens: int = 8192,
    ) -> dict[str, Any]:
        if not description.strip():
            raise ValueError("description is required")
        if not project_name.strip():
            raise ValueError("project_name is required")

        prompt = build_hmi_user_prompt(
            vendor=vendor,
            screen_type=screen_type,
            description=description,
            project_name=project_name,
            tags=tags,
        )
        raw = self._claude.ask_json(HMI_SYSTEM, prompt, max_tokens=max_tokens)
        if not isinstance(raw, dict):
            raise ValueError("HMI response must be a JSON object")

        cfg = hmi_vendor_config(vendor)
        script_content = str(raw.get("scriptContent", "")).strip()
        if not script_content:
            raise ValueError("HMI response missing scriptContent")

        script_file_name = str(raw.get("scriptFileName") or f"{_safe_base_name(project_name)}{cfg['extension']}")
        import_guide = str(
            raw.get("importGuide")
            or f"Import {script_file_name} into {cfg['name']} and link tags from tags.csv."
        ).strip()

        response_tags = raw.get("tags")
        tag_rows: list[dict[str, str]] = []
        if isinstance(response_tags, list):
            for item in response_tags:
                if isinstance(item, dict) and item.get("name"):
                    tag_rows.append({
                        "name": str(item.get("name", "")),
                        "address": str(item.get("address", "")),
                        "type": str(item.get("type", "BOOL")),
                        "comment": str(item.get("comment", "")),
                    })
        if tags and not tag_rows:
            tag_rows = [
                {
                    "name": str(t.get("name", "")),
                    "address": str(t.get("address", "")),
                    "type": str(t.get("type", "BOOL")),
                    "comment": str(t.get("comment", "")),
                }
                for t in tags
                if t.get("name")
            ]

        tags_csv = tags_to_csv(tag_rows)
        zip_bytes = build_hmi_zip(
            project_name=project_name,
            script_file_name=script_file_name,
            script_content=script_content,
            tags_csv=tags_csv,
            import_guide=import_guide,
        )
        zip_name = f"{_safe_base_name(project_name)}_hmi.zip"

        return {
            "vendor": vendor,
            "screenType": screen_type,
            "projectName": project_name,
            "scriptFileName": script_file_name,
            "scriptContent": script_content,
            "tagsCsv": tags_csv,
            "tags": tag_rows,
            "importGuide": import_guide,
            "zipFileName": zip_name,
            "contentBase64": base64.standard_b64encode(zip_bytes).decode("ascii"),
            "mimeType": "application/zip",
        }

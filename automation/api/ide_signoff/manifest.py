"""Load and persist IDE sign-off manifest (automated + manual lab results)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .checks import IdeSignoffCheckResult
from .matrix import IDE_SIGNOFF_CASES, IdeSignoffCase

FIXTURES_DIR = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "ide_signoff"
MANIFEST_PATH = FIXTURES_DIR / "manifest.json"
EXPORTS_DIR = FIXTURES_DIR / "exports"


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def default_manual_block() -> dict[str, Any]:
    return {
        "status": "pending",
        "importErrors": None,
        "compiles": None,
        "testedBy": None,
        "testedAt": None,
        "ideVersion": None,
        "notes": None,
        "issues": [],
    }


def build_case_entry(case: IdeSignoffCase, check: IdeSignoffCheckResult | None = None) -> dict[str, Any]:
    export_file = f"{case.id}{case.file_extension}"
    automated: dict[str, Any] = {
        "status": "pending",
        "checks": [],
        "lastRun": None,
        "failures": [],
    }
    if check is not None:
        automated = {
            "status": "passed" if check.passed else "failed",
            "checks": check.checks,
            "lastRun": _utc_now(),
            "failures": check.failures,
        }

    return {
        "platform": case.platform,
        "ide": case.ide,
        "ideVersionHint": case.ide_version_hint,
        "pattern": case.pattern,
        "tier": case.tier,
        "importType": case.import_type,
        "exportCaseId": case.export_case_id,
        "exportFile": export_file,
        "manualSteps": case.manual_steps,
        "automated": automated,
        "manual": default_manual_block(),
    }


def load_manifest() -> dict[str, Any]:
    if not MANIFEST_PATH.is_file():
        return {"version": 1, "cases": {}}
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def write_manifest(manifest: dict[str, Any]) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def merge_automated_results(results: list[IdeSignoffCheckResult]) -> dict[str, Any]:
    manifest = load_manifest()
    manifest["version"] = 1
    cases: dict[str, Any] = manifest.setdefault("cases", {})

    result_by_id = {item.case_id: item for item in results}
    for case in IDE_SIGNOFF_CASES:
        existing = cases.get(case.id, {})
        manual = existing.get("manual") or default_manual_block()
        check = result_by_id.get(case.id)
        cases[case.id] = build_case_entry(case, check)
        cases[case.id]["manual"] = manual

    manifest["updatedAt"] = _utc_now()
    write_manifest(manifest)
    return manifest


def all_automated_passed(manifest: dict[str, Any] | None = None) -> bool:
    data = manifest or load_manifest()
    cases = data.get("cases", {})
    if len(cases) != len(IDE_SIGNOFF_CASES):
        return False
    return all(cases[c.id]["automated"]["status"] == "passed" for c in IDE_SIGNOFF_CASES)


def all_manual_passed(manifest: dict[str, Any] | None = None) -> bool:
    data = manifest or load_manifest()
    cases = data.get("cases", {})
    return bool(cases) and all(
        cases[c.id]["manual"]["status"] == "passed" for c in IDE_SIGNOFF_CASES
    )


def record_manual_signoff(
    case_id: str,
    *,
    status: str,
    tested_by: str,
    ide_version: str,
    compiles: bool,
    import_errors: str | None = None,
    notes: str | None = None,
    issues: list[str] | None = None,
) -> dict[str, Any]:
    if status not in {"passed", "failed", "pending"}:
        raise ValueError("status must be passed, failed, or pending")

    manifest = load_manifest()
    cases = manifest.setdefault("cases", {})
    if case_id not in cases:
        from .matrix import signoff_case_by_id

        case = signoff_case_by_id(case_id)
        cases[case_id] = build_case_entry(case)

    manual = cases[case_id].setdefault("manual", default_manual_block())
    manual.update(
        {
            "status": status,
            "importErrors": import_errors,
            "compiles": compiles,
            "testedBy": tested_by,
            "testedAt": _utc_now() if status != "pending" else None,
            "ideVersion": ide_version,
            "notes": notes,
            "issues": issues or [],
        }
    )
    manifest["updatedAt"] = _utc_now()
    write_manifest(manifest)
    return manifest

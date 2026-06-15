"""Run automated IDE sign-off and write lab export bundle."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from api.services.ir_service import IrService

from .checks import IdeSignoffCheckResult, run_case_checks
from .manifest import EXPORTS_DIR, merge_automated_results, write_manifest
from .matrix import IDE_SIGNOFF_CASES


@dataclass
class IdeSignoffReport:
    passed: bool
    results: list[IdeSignoffCheckResult] = field(default_factory=list)

    @property
    def failed_cases(self) -> list[IdeSignoffCheckResult]:
        return [item for item in self.results if not item.passed]


def run_automated_signoff(service: IrService | None = None) -> IdeSignoffReport:
    svc = service or IrService()
    results = [run_case_checks(svc, case) for case in IDE_SIGNOFF_CASES]
    return IdeSignoffReport(
        passed=all(item.passed for item in results),
        results=results,
    )


def write_signoff_bundle(output_dir: Path | None = None) -> Path:
    svc = IrService()
    target = output_dir or EXPORTS_DIR
    target.mkdir(parents=True, exist_ok=True)

    for case in IDE_SIGNOFF_CASES:
        check = run_case_checks(svc, case)
        if not check.passed:
            raise RuntimeError(
                f"Cannot write bundle; sign-off case failed: {case.id} — {check.failures}"
            )
        export_path = target / f"{case.id}{case.file_extension}"
        export_path.write_bytes(check.content)

    return target


def write_signoff_manifest(service: IrService | None = None) -> dict:
    report = run_automated_signoff(service)
    return merge_automated_results(report.results)

"""Phase 5 P0 — IDE import sign-off automated gates."""

import pytest

from api.ide_signoff.checks import run_case_checks
from api.ide_signoff.manifest import (
    EXPORTS_DIR,
    all_automated_passed,
    build_case_entry,
    load_manifest,
    merge_automated_results,
    record_manual_signoff,
)
from api.ide_signoff.matrix import IDE_SIGNOFF_CASES, signoff_case_by_id
from api.ide_signoff.runner import run_automated_signoff, write_signoff_bundle
from api.services.ir_service import IrService


@pytest.fixture
def service():
    return IrService()


class TestIdeSignoffMatrix:
    def test_matrix_covers_all_export_platforms(self):
        export_ids = {case.export_case_id for case in IDE_SIGNOFF_CASES}
        assert "motor_startstop_schneider" in export_ids
        assert "motor_startstop_rockwell" in export_ids
        assert "motor_startstop_siemens" in export_ids
        assert "motor_startstop_mitsubishi" in export_ids
        assert "plcopen_motor_codesys" in export_ids
        assert len(IDE_SIGNOFF_CASES) == 7

    def test_lookup_by_id(self):
        case = signoff_case_by_id("signoff_rockwell_motor")
        assert case.ide == "Studio 5000 Logix Designer"
        assert case.file_extension == ".L5X"


class TestIdeSignoffAutomatedChecks:
    @pytest.mark.parametrize("case", IDE_SIGNOFF_CASES, ids=lambda case: case.id)
    def test_automated_gate_passes(self, service, case):
        result = run_case_checks(service, case)
        assert result.passed, f"{case.id} failures: {result.failures}"
        assert result.checks == [
            "serialize",
            "ir_validate",
            "roundtrip",
            "format_structure",
            "golden_hash",
        ]
        assert result.content
        assert "<ProjectDescriptor" not in result.content.decode("utf-8", errors="ignore")

    def test_full_report_passes(self, service):
        report = run_automated_signoff(service)
        assert report.passed
        assert len(report.results) == len(IDE_SIGNOFF_CASES)
        assert not report.failed_cases


class TestIdeSignoffManifest:
    def test_build_case_entry_shape(self):
        case = IDE_SIGNOFF_CASES[0]
        entry = build_case_entry(case)
        assert entry["automated"]["status"] == "pending"
        assert entry["manual"]["status"] == "pending"
        assert entry["exportFile"].endswith(case.file_extension)
        assert entry["manualSteps"]

    def test_merge_automated_results_writes_manifest(self, service, tmp_path, monkeypatch):
        from api.ide_signoff import manifest as manifest_module

        manifest_path = tmp_path / "manifest.json"
        monkeypatch.setattr(manifest_module, "MANIFEST_PATH", manifest_path)

        report = run_automated_signoff(service)
        data = merge_automated_results(report.results)
        assert manifest_path.is_file()
        assert all_automated_passed(data)
        for case in IDE_SIGNOFF_CASES:
            assert data["cases"][case.id]["automated"]["status"] == "passed"


class TestIdeSignoffBundle:
    def test_write_signoff_bundle_creates_exports(self, service, tmp_path, monkeypatch):
        from api.ide_signoff import manifest as manifest_module

        exports_dir = tmp_path / "exports"
        monkeypatch.setattr(manifest_module, "EXPORTS_DIR", exports_dir)

        path = write_signoff_bundle(exports_dir)
        files = sorted(p.name for p in path.iterdir())
        assert len(files) == len(IDE_SIGNOFF_CASES)
        assert "signoff_schneider_motor.smbp" in files
        assert "signoff_rockwell_motor.L5X" in files
        assert "signoff_mitsubishi_motor.zip" in files

        schneider = (path / "signoff_schneider_motor.smbp").read_text(encoding="utf-8")
        assert "Calaos/Case/2.0" in schneider
        assert "<ProjectDescriptor" not in schneider


class TestIdeSignoffCommittedArtifacts:
    def test_committed_manifest_automated_passed(self):
        data = load_manifest()
        assert data["version"] == 1
        assert "cases" in data
        assert all_automated_passed(data)

    def test_committed_exports_exist(self):
        for case in IDE_SIGNOFF_CASES:
            export_path = EXPORTS_DIR / f"{case.id}{case.file_extension}"
            assert export_path.is_file(), f"Missing lab export: {export_path.name}"
            assert export_path.stat().st_size > 0


class TestIdeSignoffManualRecording:
    def test_record_manual_signoff(self, tmp_path, monkeypatch):
        from api.ide_signoff import manifest as manifest_module

        manifest_path = tmp_path / "manifest.json"
        monkeypatch.setattr(manifest_module, "MANIFEST_PATH", manifest_path)

        report = run_automated_signoff()
        merge_automated_results(report.results)

        record_manual_signoff(
            "signoff_schneider_motor",
            status="passed",
            tested_by="Lab Tester",
            ide_version="1.2.0.5",
            compiles=True,
            notes="Opened and compiled cleanly.",
        )
        data = load_manifest()
        manual = data["cases"]["signoff_schneider_motor"]["manual"]
        assert manual["status"] == "passed"
        assert manual["compiles"] is True
        assert manual["testedBy"] == "Lab Tester"

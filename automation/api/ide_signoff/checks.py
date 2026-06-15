"""Automated pre-import checks proxying IDE import readiness."""

from __future__ import annotations

import base64
import io
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from api.ir.roundtrip import assert_roundtrip
from api.ir.serializers.schneider_calaos import CALAOS_STRUCTURE_MARKERS, calaos_structure_markers_present
from api.ir.validator import validate_program
from api.schemas.ir import PlcProgram
from api.services.ir_service import IrService
from api.tests.golden_utils import EXPORT_CASES, export_hash, load_export_manifest, serialize_export_case
from api.validation.xsd_validate import validate_calaos_smbp, validate_l5x
from plc_file_handler.parsers.rockwell_parser import RockwellParser

from .matrix import IdeSignoffCase


@dataclass
class IdeSignoffCheckResult:
    case_id: str
    passed: bool
    checks: list[str] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)
    file_name: str = ""
    export_format: str = ""
    content: bytes = b""


def _export_case_dict(case: IdeSignoffCase) -> dict[str, Any]:
    for entry in EXPORT_CASES:
        if entry["id"] == case.export_case_id:
            return entry
    raise KeyError(f"No golden export case for {case.export_case_id}")


def _serialize_case(service: IrService, case: IdeSignoffCase) -> tuple[bytes, str, str, dict[str, Any]]:
    export_case = _export_case_dict(case)
    content, export_format = serialize_export_case(service, export_case)
    if export_case.get("plcopen"):
        file_name = f"{export_case['projectName']}.xml"
    elif export_format == "l5x":
        file_name = f"{export_case['projectName']}.L5X"
    elif export_format == "scl":
        file_name = f"{export_case['projectName']}.scl"
    elif export_format == "mitsubishi_tier2_zip":
        file_name = f"{export_case['projectName']}.zip"
    else:
        file_name = f"{export_case['projectName']}.smbp"

    payload = service.get_pattern_ir(
        case.pattern,
        project_name=export_case["projectName"],
        vendor=case.vendor,
        model=case.model,
        num_lights=int(export_case.get("numLights", 4)),
        delay_seconds=int(export_case.get("delaySeconds", 3)),
    )
    if export_case.get("plcopen"):
        program = payload["program"]
        program["target"] = {"vendor": case.vendor, "model": case.model}
    else:
        program = payload["program"]

    return content, export_format, file_name, program


def _check_no_legacy_schneider_descriptor(text: str) -> None:
    if "<ProjectDescriptor" in text:
        raise AssertionError("Export uses legacy <ProjectDescriptor> XML (not Calaos)")


def _check_schneider_calaos(text: str) -> None:
    _check_no_legacy_schneider_descriptor(text)
    if not calaos_structure_markers_present(text):
        raise AssertionError("Missing Calaos/Case 2.0 structure markers")
    for marker in CALAOS_STRUCTURE_MARKERS:
        if marker not in text:
            raise AssertionError(f"Missing Calaos marker: {marker}")
    xsd_errors = validate_calaos_smbp(text.encode("utf-8"))
    if xsd_errors:
        raise AssertionError(f"Calaos XSD: {xsd_errors[0]}")


def _check_rockwell_l5x(content: bytes, file_path: str, pattern: str) -> None:
    text = content.decode("utf-8")
    root = ET.fromstring(text)
    if root.tag != "RSLogix5000Content":
        raise AssertionError(f"Unexpected L5X root tag: {root.tag}")
    if root.get("TargetType") != "Controller":
        raise AssertionError("L5X TargetType must be Controller")
    for marker in ("<Controller", "<Tags>", "<Programs>", "<Routine", "MainProgram"):
        if marker not in text:
            raise AssertionError(f"Missing L5X marker: {marker}")

    parsed = RockwellParser(file_path).parse()
    tag_names = {tag["name"] for tag in parsed.get("tags", [])}
    if pattern == "motor_startstop":
        required = {"START_BTN", "STOP_BTN", "MOTOR_RUN"}
    elif pattern == "sequential_lights":
        required = {"START_BTN", "LIGHT1", "SEQ_RUN"}
    else:
        required = set()
    if required and not required.issubset(tag_names):
        missing = sorted(required - tag_names)
        raise AssertionError(f"Missing expected Rockwell tags: {missing}")

    xsd_errors = validate_l5x(content)
    if xsd_errors:
        raise AssertionError(f"L5X XSD: {xsd_errors[0]}")


def _check_siemens_scl(text: str) -> None:
    for marker in (
        'ORGANIZATION_BLOCK "Main"',
        "END_ORGANIZATION_BLOCK",
        "BEGIN",
        "END_VAR",
        "START_BTN",
        "MOTOR_RUN",
    ):
        if marker not in text:
            raise AssertionError(f"Missing SCL marker: {marker}")


def _check_mitsubishi_zip(content: bytes) -> None:
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        names = set(archive.namelist())
    required_suffixes = (".il", ".st", ".csv")
    for suffix in required_suffixes:
        if not any(name.endswith(suffix) for name in names):
            raise AssertionError(f"Mitsubishi ZIP missing *{suffix} member")


def _check_plcopen_xml(text: str) -> None:
    root = ET.fromstring(text)
    xml_text = ET.tostring(root, encoding="unicode")
    for marker in (
        "plcopen.org/xml/tc6_0201",
        'name="MainProgram"',
        "START_BTN",
        "MOTOR_RUN",
    ):
        if marker not in xml_text:
            raise AssertionError(f"Missing PLCopen marker: {marker}")


def _check_format_structure(content: bytes, export_format: str, file_path: str, pattern: str) -> None:
    if export_format == "machine_expert_basic_xml":
        _check_schneider_calaos(content.decode("utf-8"))
    elif export_format == "l5x":
        _check_rockwell_l5x(content, file_path, pattern)
    elif export_format == "scl":
        _check_siemens_scl(content.decode("utf-8"))
    elif export_format == "mitsubishi_tier2_zip":
        _check_mitsubishi_zip(content)
    elif export_format == "plcopen_xml":
        _check_plcopen_xml(content.decode("utf-8"))
    else:
        raise AssertionError(f"Unsupported export format for sign-off: {export_format}")


def run_case_checks(service: IrService, case: IdeSignoffCase) -> IdeSignoffCheckResult:
    result = IdeSignoffCheckResult(case_id=case.id, passed=False)
    export_case = _export_case_dict(case)

    try:
        content, export_format, file_name, program = _serialize_case(service, case)
        result.file_name = file_name
        result.export_format = export_format
        result.content = content
        result.checks.append("serialize")

        validated = validate_program(program)
        result.checks.append("ir_validate")

        with tempfile.TemporaryDirectory(prefix="ide-signoff-") as tmp:
            path = Path(tmp) / file_name
            path.write_bytes(content)
            roundtrip = assert_roundtrip(validated, str(path))
            if not roundtrip["ok"]:
                raise AssertionError(
                    f"Round-trip failed: missing={roundtrip.get('missingSymbols')}"
                )
            result.checks.append("roundtrip")
            _check_format_structure(content, export_format, str(path), case.pattern)
            result.checks.append("format_structure")

        manifest = load_export_manifest()
        expected = manifest["exports"][case.export_case_id]["sha256"]
        actual = export_hash(service, export_case)
        if actual != expected:
            raise AssertionError(
                f"Golden hash mismatch (expected {expected}, got {actual})"
            )
        result.checks.append("golden_hash")

        result.passed = True
    except AssertionError as exc:
        result.failures.append(str(exc))
    except Exception as exc:  # pragma: no cover - surfaced as failure message
        result.failures.append(f"{type(exc).__name__}: {exc}")

    return result

import base64
import tempfile
from pathlib import Path
from typing import Any

from ..schemas.ir import PatternName, PlcProgram
from ..ir.patterns import build_pattern, list_patterns
from ..ir.schema_export import ir_schema_for_claude
from ..ir.roundtrip import assert_roundtrip
from ..ir.serializer import IrSerializer
from ..ir.validator import IrValidationError, program_summary, validate_program


class IrService:
    def __init__(self) -> None:
        self._serializer = IrSerializer()

    def list_patterns(self) -> list[dict[str, object]]:
        return list_patterns()

    def get_json_schema(self) -> dict[str, object]:
        return ir_schema_for_claude()

    def get_pattern_ir(
        self,
        pattern: PatternName,
        *,
        project_name: str,
        vendor: str,
        model: str,
        num_lights: int = 4,
        delay_seconds: int = 3,
        cycle_seconds: int = 5,
        run_seconds: int = 5,
    ) -> dict[str, Any]:
        program = build_pattern(
            pattern,
            project_name=project_name,
            vendor=vendor,
            model=model,
            num_lights=num_lights,
            delay_seconds=delay_seconds,
            cycle_seconds=cycle_seconds,
            run_seconds=run_seconds,
        )
        validated = validate_program(program)
        return {
            "program": validated.model_dump(),
            "summary": program_summary(validated),
        }

    def validate(self, program: dict[str, Any]) -> dict[str, Any]:
        validated = validate_program(program)
        return {
            "valid": True,
            "summary": program_summary(validated),
            "program": validated.model_dump(),
        }

    def serialize(self, program: dict[str, Any]) -> dict[str, Any]:
        validated = validate_program(program)
        result = self._serializer.serialize(validated)
        result["program"] = validated.model_dump()
        result["summary"] = program_summary(validated)
        return result

    def serialize_plcopen(self, program: dict[str, Any]) -> dict[str, Any]:
        validated = validate_program(program)
        result = self._serializer.serialize_plcopen(validated)
        result["program"] = validated.model_dump()
        result["summary"] = program_summary(validated)
        return result

    def roundtrip(self, program: dict[str, Any]) -> dict[str, Any]:
        serialized = self.serialize(program)
        raw = base64.standard_b64decode(serialized["contentBase64"])
        with tempfile.TemporaryDirectory(prefix="ir-rt-") as tmp:
            path = Path(tmp) / serialized["fileName"]
            path.write_bytes(raw)
            report = assert_roundtrip(PlcProgram.model_validate(serialized["program"]), str(path))
        return {
            **serialized,
            "roundtrip": report,
        }

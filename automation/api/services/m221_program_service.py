from typing import Any

from ..ir.m221_adapter import ir_program_to_m221_data
from ..schemas.ir import PlcProgram
from ..schemas.m221 import M221ProgramData
from .claude_ir_service import ClaudeIrService
from .ir_service import IrService
from .m221_smbp_builder import M221SmbpBuilder, parse_program_data


class M221ProgramService:
    def __init__(self, claude_ir: ClaudeIrService | None = None) -> None:
        self._builder = M221SmbpBuilder()
        self._claude_ir = claude_ir
        self._ir = IrService()

    def build_from_json(
        self,
        program_data: dict[str, Any],
        plc_model: str,
        project_name: str | None = None,
    ) -> dict[str, Any]:
        return self._builder.build(program_data, plc_model, project_name)

    def generate_from_description(
        self,
        description: str,
        plc_model: str,
        project_name: str | None = None,
        *,
        synthesis_mode: str = "constrained",
    ) -> dict[str, Any]:
        claude_ir = self._claude_ir or ClaudeIrService()
        ir_result = claude_ir.generate_program_ir(
            description,
            vendor="schneider",
            model=plc_model,
            project_name=project_name,
            synthesis_mode=synthesis_mode,  # type: ignore[arg-type]
        )
        program = PlcProgram.model_validate(ir_result["program"])
        serialize_result = self._ir.serialize(ir_result["program"])
        program_data = ir_program_to_m221_data(program)

        build_result = {
            "fileName": serialize_result["fileName"],
            "mimeType": serialize_result["mimeType"],
            "contentBase64": serialize_result["contentBase64"],
            "programData": program_data,
            "ir": ir_result["program"],
            "metadata": {
                **serialize_result.get("metadata", {}),
                "ir": ir_result["program"],
                "irSource": ir_result["source"],
                "irAttempts": ir_result["attempts"],
                "synthesisMode": ir_result.get("synthesisMode", synthesis_mode),
                "exportPath": "ir_direct",
            },
        }
        if ir_result.get("pattern"):
            build_result["metadata"]["irPattern"] = ir_result["pattern"]
        if ir_result.get("fallbackReason"):
            build_result["metadata"]["irFallbackReason"] = ir_result["fallbackReason"]
        return build_result

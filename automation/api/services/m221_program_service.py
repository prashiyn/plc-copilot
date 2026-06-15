from typing import Any

from ..ir.m221_adapter import plc_program_to_m221_data
from ..schemas.ir import PlcProgram
from ..schemas.m221 import M221ProgramData
from .claude_ir_service import ClaudeIrService
from .m221_smbp_builder import M221SmbpBuilder, parse_program_data


class M221ProgramService:
    def __init__(self, claude_ir: ClaudeIrService | None = None) -> None:
        self._builder = M221SmbpBuilder()
        self._claude_ir = claude_ir

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
    ) -> dict[str, Any]:
        claude_ir = self._claude_ir or ClaudeIrService()
        ir_result = claude_ir.generate_program_ir(
            description,
            vendor="schneider",
            model=plc_model,
            project_name=project_name,
        )
        program = PlcProgram.model_validate(ir_result["program"])
        m221_data = plc_program_to_m221_data(program)
        data = parse_program_data(m221_data, project_name or program.name)
        if project_name:
            data = M221ProgramData.model_validate({**data.model_dump(), "projectName": project_name})

        build_result = self._builder.build(data.model_dump(), plc_model, data.projectName)
        build_result["ir"] = ir_result["program"]
        build_result["metadata"] = {
            **build_result.get("metadata", {}),
            "ir": ir_result["program"],
            "irSource": ir_result["source"],
            "irAttempts": ir_result["attempts"],
        }
        if ir_result.get("pattern"):
            build_result["metadata"]["irPattern"] = ir_result["pattern"]
        if ir_result.get("fallbackReason"):
            build_result["metadata"]["irFallbackReason"] = ir_result["fallbackReason"]
        return build_result

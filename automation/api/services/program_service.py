from pathlib import Path
from typing import Any

from plc_file_handler.parsers.rockwell_parser import RockwellParser
from plc_file_handler.parsers.schneider_parser import SchneiderParser
from plc_file_handler.utils import detect_plc_format

from ..ir.sketch_adapter import sketch_analysis_to_ir
from .claude_ir_service import ClaudeIrService
from .ir_service import IrService

SKETCH_EXPORT_PLATFORMS = frozenset({"schneider", "rockwell", "siemens", "mitsubishi"})

class ProgramService:
    def __init__(self) -> None:
        self._ir = IrService()

    def generate(self, request: dict[str, Any]) -> dict[str, Any]:
        platform = request["platform"]
        project_name = request["projectName"]
        controller = request.get("controller", "TM221CE24R")
        source = request["source"]

        if source["type"] == "pattern":
            pattern = source["pattern"]
            ir_payload = self._ir.get_pattern_ir(
                pattern,
                project_name=project_name,
                vendor=platform,
                model=controller,
                num_lights=source.get("numLights", 4),
                delay_seconds=source.get("delaySeconds", 3),
                cycle_seconds=source.get("cycleSeconds", 5),
                run_seconds=source.get("runSeconds", 5),
            )
            result = self._ir.serialize(ir_payload["program"])
            result["metadata"]["ir"] = ir_payload["program"]
            return result

        if source["type"] == "ir":
            program = dict(source["program"])
            program.setdefault("name", project_name)
            program.setdefault("target", {"vendor": platform, "model": controller})
            result = self._ir.serialize(program)
            result["metadata"]["ir"] = result["program"]
            return result

        if source["type"] == "claude_ir":
            ir_result = ClaudeIrService().generate_program_ir(
                source["description"],
                vendor=platform,
                model=controller,
                project_name=project_name,
                synthesis_mode=source.get("synthesisMode", "constrained"),
            )
            result = self._ir.serialize(ir_result["program"])
            result["metadata"]["ir"] = ir_result["program"]
            result["metadata"]["irSource"] = ir_result["source"]
            result["metadata"]["irAttempts"] = ir_result["attempts"]
            if ir_result.get("pattern"):
                result["metadata"]["irPattern"] = ir_result["pattern"]
            if ir_result.get("fallbackReason"):
                result["metadata"]["irFallbackReason"] = ir_result["fallbackReason"]
            return result

        if source["type"] == "sketch_analysis":
            return self._generate_from_sketch_analysis(
                platform,
                project_name,
                controller,
                source["analysis"],
            )

        raise ValueError(f"Unsupported source type: {source['type']}")

    def generate_plcopen(self, request: dict[str, Any]) -> dict[str, Any]:
        name = request["name"]
        pattern = request.get("pattern", "motor_startstop")
        platform_key = request.get("platform", "universal")
        controller = request.get("controller", "TM221CE24R")

        vendor = platform_key if platform_key != "universal" else "generic"
        ir_payload = self._ir.get_pattern_ir(
            pattern,
            project_name=name,
            vendor=vendor,
            model=controller,
            num_lights=int(request.get("numLights", 4)),
            delay_seconds=int(request.get("delaySeconds", 3)),
            cycle_seconds=int(request.get("cycleSeconds", 5)),
            run_seconds=int(request.get("runSeconds", 5)),
        )
        program = dict(ir_payload["program"])
        program["target"] = {"vendor": vendor, "model": controller}
        result = self._ir.serialize_plcopen(program)
        result["metadata"]["ir"] = ir_payload["program"]
        result["metadata"]["format"] = "plcopen_xml"
        return result

    def parse(self, file_path: str) -> dict[str, Any]:
        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f"File not found: {file_path}")

        fmt = detect_plc_format(str(path))
        platform = fmt.platform

        if platform == "schneider" or path.suffix.lower() == ".smbp":
            parser = SchneiderParser(str(path))
            project = parser.parse()
            summary = parser.get_summary()
        elif platform == "rockwell" or path.suffix.lower() == ".l5x":
            parser = RockwellParser(str(path))
            project = parser.parse()
            summary = parser.get_summary()
        else:
            raise ValueError(f"Unsupported file format for parsing: {fmt.platform}/{fmt.format_type}")

        return {
            "platform": project.get("platform", platform),
            "format": fmt.format_type,
            "project": project,
            "summary": summary.strip(),
        }

    def _generate_from_sketch_analysis(
        self,
        platform: str,
        project_name: str,
        controller: str,
        analysis: dict[str, Any],
    ) -> dict[str, Any]:
        if platform not in SKETCH_EXPORT_PLATFORMS:
            raise ValueError(
                f"Unsupported sketch generation platform: {platform}; "
                f"supported: {', '.join(sorted(SKETCH_EXPORT_PLATFORMS))}"
            )

        program = sketch_analysis_to_ir(
            analysis,
            project_name=project_name,
            vendor=platform,
            model=controller,
        )
        result = self._ir.serialize(program.model_dump())
        result["metadata"]["ir"] = program.model_dump()
        result["metadata"]["source"] = "sketch_analysis"
        if "confidence" in analysis:
            result["metadata"]["sketchConfidence"] = analysis["confidence"]
        return result

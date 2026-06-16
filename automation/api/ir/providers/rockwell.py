from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any

from plc_file_handler.generators.rockwell_generator import RockwellGenerator

from ...schemas.ir import FbCallNode, PlcProgram
from ..patterns import build_pattern
from ..serialize_helpers import file_result, network_to_rockwell_elements
from ..serializers.analog_fb import render_pid_fb_statement

PID_NATIVE_LIMITATIONS = [
    "PID analog loop uses a structured-text function block stub in export — import the PID AOI/FB manually in Studio 5000.",
]


class RockwellProvider:
    vendor = "rockwell"

    def serialize(self, program: PlcProgram) -> dict[str, Any]:
        if program.meta.pattern == "sequential_lights":
            params = program.meta.patternParams or {}
            program = build_pattern(
                "sequential_lights",
                project_name=program.name,
                vendor="rockwell",
                model=program.target.model,
                num_lights=int(params.get("numLights", 4)),
                delay_seconds=int(params.get("delaySeconds", 3)),
            )
        return self._serialize_program(program)

    def _serialize_program(self, program: PlcProgram) -> dict[str, Any]:
        project_name = program.name
        controller = program.target.model
        with tempfile.TemporaryDirectory(prefix="ir-rw-") as tmp:
            gen = RockwellGenerator(project_name=project_name, processor_type=controller)
            for var in program.vars:
                gen.add_tag(var.symbol, var.dataType, "Controller", var.comment or "")
            rung_number = 0
            for network in program.pous[0].networks:
                if isinstance(network.logic, FbCallNode) and network.logic.kind == "PID":
                    st = render_pid_fb_statement(network.logic, self.vendor)
                    gen.add_rung(
                        rung_number,
                        "NOP();",
                        f"PID ST import: {st}",
                    )
                    rung_number += 1
                    continue
                logic = gen.from_elements(network_to_rockwell_elements(network, program.vars))
                gen.add_rung(
                    rung_number,
                    logic,
                    network.comment or network.label or f"Rung {rung_number}",
                )
                rung_number += 1
            output = Path(tmp) / f"{project_name}.L5X"
            gen.generate(str(output))
            content = output.read_bytes()
            metadata_extra = None
            if program.meta.pattern == "pid_loop":
                metadata_extra = {"limitations": PID_NATIVE_LIMITATIONS}
            return file_result(
                output.name,
                content,
                "application/xml",
                program.meta.pattern or "ir",
                self.vendor,
                controller,
                metadata_extra=metadata_extra,
            )

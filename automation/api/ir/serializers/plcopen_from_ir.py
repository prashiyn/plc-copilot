"""Render PLCopen TC6 XML directly from PlcProgram IR (Phase 5 P2)."""

from __future__ import annotations

from plc_automation.plcopen_xml import PLCopenXMLGenerator

from ...schemas.ir import FbCallNode, PlcProgram
from ..serialize_helpers import network_to_plcopen_rung_kwargs
from ..serializers.analog_fb import render_pid_fb_statement

_PLCOPEN_TYPE_MAP = {
    "BOOL": "BOOL",
    "INT": "INT",
    "DINT": "DINT",
    "REAL": "REAL",
    "TIME": "TIME",
    "TON": "TIME",
    "TOF": "TIME",
    "TP": "TIME",
    "CTU": "INT",
    "CTD": "INT",
    "CTUD": "INT",
}


def render_plcopen_xml(program: PlcProgram) -> str:
    generator = PLCopenXMLGenerator(
        company_name="PLCAutoPilot",
        product_name="AI Code Generator",
        product_version="1.5",
    )
    project = generator.create_project(program.name)
    pou_name = program.pous[0].name if program.pous else "MainProgram"
    pou = project.add_program(pou_name)

    for var in program.vars:
        plc_type = _PLCOPEN_TYPE_MAP.get(var.dataType, "BOOL")
        pou.add_variable(var.symbol, plc_type, var.address)

    st_blocks: list[str] = []
    if program.pous:
        for network in program.pous[0].networks:
            kwargs = network_to_plcopen_rung_kwargs(network)
            if (
                kwargs.get("coil")
                or kwargs.get("contacts")
                or kwargs.get("normally_closed")
            ):
                pou.add_rung(
                    contacts=kwargs.get("contacts") or None,
                    normally_closed=kwargs.get("normally_closed") or None,
                    coil=kwargs.get("coil"),
                    seal_in=kwargs.get("seal_in"),
                )
            elif isinstance(network.logic, FbCallNode) and network.logic.kind == "PID":
                st_blocks.append(render_pid_fb_statement(network.logic, program.target.vendor))

    pou.finalize()
    xml = generator.to_xml_string(pretty=True)
    if st_blocks:
        comment = "\n".join(f"  <!-- ST: {line} -->" for line in st_blocks)
        xml = xml.replace("</project>", f"{comment}\n</project>", 1)
    return xml


def render_plcopen_bytes(program: PlcProgram) -> bytes:
    return render_plcopen_xml(program).encode("utf-8")

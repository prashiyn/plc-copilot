"""Vendor PID function-block statement rendering from IR FbCallNode."""

from __future__ import annotations

from ...schemas.ir import FbCallNode

_VENDOR_PID_FB: dict[str, str] = {
    "siemens": "PID_Comp",
    "schneider": "PID",
    "rockwell": "PID",
    "codesys": "PID",
    "generic": "PID",
    "mitsubishi": "PID",
}


def _param_map(node: FbCallNode) -> dict[str, str]:
    return {param.name: param.symbol for param in node.params}


def render_pid_fb_statement(node: FbCallNode, vendor: str) -> str:
    """Emit a single ST-style PID FB invocation for Tier-2 / comment import."""
    if node.kind != "PID":
        raise ValueError(f"Unsupported function block kind: {node.kind}")

    params = _param_map(node)
    pv = params.get("PV", "TEMP_PV")
    sp = params.get("SP", "TEMP_SP")
    cv = params.get("CV", "VALVE_CV")
    enable = node.enable or "TRUE"
    instance = node.instance
    fb_type = _VENDOR_PID_FB.get(vendor, "PID")

    if vendor == "siemens":
        return (
            f"{fb_type}(REQ := {enable}, "
            f"PV_PER := {pv}, "
            f"SP_INT := REAL_TO_INT({sp}), "
            f"LMN_PER := {cv}, "
            f"PID_Instance := {instance})"
        )

    return (
        f"{fb_type}_{instance}(ENABLE := {enable}, "
        f"PV := {pv}, "
        f"SP := {sp}, "
        f"CV => {cv})"
    )

"""Map natural-language descriptions to deterministic IR patterns (fallback for Claude IR)."""

import re

from ..schemas.ir import PatternName, PlcVendor

_DEFAULT_PROJECT = "PLCAutoProgram"


def detect_pattern_from_description(description: str) -> tuple[PatternName, str, int, int, int]:
    """
    Infer the closest vetted pattern from user text.

    Returns:
        (pattern_name, project_name, num_lights, delay_seconds, cycle_seconds)
    """
    lower = description.lower()
    light_match = re.search(r"(\d+)\s+(?:sequential\s+)?lights?", description, re.I)
    time_match = re.search(r"(\d+)\s+seconds?", description, re.I)
    cycle_match = re.search(r"(\d+)\s+second\s+cycle", description, re.I)
    name_match = re.search(r"(?:project|program|name):\s*([^\n.]+)", description, re.I)

    pattern: PatternName = "motor_startstop"

    if any(kw in lower for kw in ("traffic light", "traffic lights", "red light", "red/yellow/green")):
        pattern = "traffic_lights"
    elif any(kw in lower for kw in ("tank", "level control", "fill pump", "pump level")) or (
        "level" in lower and "pump" in lower
    ):
        pattern = "tank_level"
    elif any(kw in lower for kw in ("e-stop", "estop", "e stop", "emergency stop")) and "motor" in lower:
        pattern = "estop_motor"
    elif "conveyor" in lower or "belt" in lower:
        pattern = "conveyor_startstop"
    elif light_match or "sequential" in lower or (
        "light" in lower and "traffic" not in lower and "motor" not in lower
    ):
        pattern = "sequential_lights"
    elif "motor" in lower or ("start" in lower and "stop" in lower):
        pattern = "motor_startstop"

    num_lights = 4
    if light_match:
        num_lights = min(8, max(2, int(light_match.group(1))))

    delay_seconds = 3
    if time_match and pattern != "traffic_lights":
        delay_seconds = min(60, max(1, int(time_match.group(1))))

    cycle_seconds = 5
    if cycle_match:
        cycle_seconds = min(60, max(1, int(cycle_match.group(1))))
    elif time_match and pattern == "traffic_lights":
        cycle_seconds = min(60, max(1, int(time_match.group(1))))

    if name_match:
        project_name = name_match.group(1).strip()
        project_name = re.sub(r"[^a-zA-Z0-9_]", "_", project_name) or _DEFAULT_PROJECT
    else:
        project_name = _DEFAULT_PROJECT

    return pattern, project_name, num_lights, delay_seconds, cycle_seconds


def normalize_vendor(vendor: str) -> PlcVendor:
    key = vendor.lower().strip()
    allowed: set[str] = {
        "schneider",
        "rockwell",
        "siemens",
        "mitsubishi",
        "codesys",
        "generic",
    }
    if key in allowed:
        return key  # type: ignore[return-value]
    if "allen" in key or "bradley" in key:
        return "rockwell"
    return "generic"

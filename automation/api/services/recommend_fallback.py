"""Deterministic fallbacks for PLC recommend / solution / rectify routes."""

from __future__ import annotations

import re
from typing import Any, Literal

Severity = Literal["low", "medium", "high", "critical"]


def generate_plc_recommendations(requirements: dict[str, Any], required_io: int) -> list[dict[str, Any]]:
    all_plcs: list[dict[str, Any]] = []

    if required_io <= 20:
        all_plcs.append(
            {
                "manufacturer": "Schneider Electric",
                "model": "TM221C16R",
                "series": "Modicon M221",
                "score": 0,
                "matchPercentage": 0,
                "price": 350,
                "reasons": [
                    "Optimal for applications with up to 20 I/O points",
                    "Free EcoStruxure Machine Expert Basic software",
                    "Compact design perfect for space-constrained installations",
                    "Excellent cost-performance ratio for small applications",
                ],
                "specifications": {
                    "ioPoints": 16,
                    "memory": "32 KB",
                    "scanTime": "0.5 ms/kInstruction",
                    "protocols": ["Modbus TCP", "Ethernet"],
                },
                "pros": [
                    "Lowest initial investment",
                    "Easy programming interface",
                    "Quick commissioning time",
                    "Low maintenance costs",
                ],
                "cons": [
                    "Limited expansion capabilities",
                    "Basic safety features only",
                    "Not suitable for high-speed applications",
                ],
            }
        )

    if required_io <= 40:
        all_plcs.append(
            {
                "manufacturer": "Schneider Electric",
                "model": "TM241CE40T",
                "series": "Modicon M241",
                "score": 0,
                "matchPercentage": 0,
                "price": 750,
                "reasons": [
                    "Ideal for medium-sized applications up to 40 I/O",
                    "Excellent expansion possibilities",
                    "Integrated motion control capabilities",
                    "Industrial-grade reliability",
                ],
                "specifications": {
                    "ioPoints": 40,
                    "memory": "256 KB",
                    "scanTime": "0.2 ms/kInstruction",
                    "protocols": ["Modbus TCP", "Ethernet/IP", "CANopen"],
                },
                "pros": [
                    "Great expansion options (14 modules)",
                    "Motion control support",
                    "Wide protocol compatibility",
                    "Future-proof solution",
                ],
                "cons": [
                    "Higher upfront cost",
                    "Requires programming knowledge",
                    "Larger physical footprint",
                ],
            }
        )

    if required_io <= 30:
        all_plcs.append(
            {
                "manufacturer": "Siemens",
                "model": "S7-1200 CPU 1214C",
                "series": "SIMATIC S7-1200",
                "score": 0,
                "matchPercentage": 0,
                "price": 950,
                "reasons": [
                    "Industry-leading diagnostics and troubleshooting",
                    "Integrated web server for remote monitoring",
                    "Superior motion control capabilities",
                    "Global support and extensive ecosystem",
                ],
                "specifications": {
                    "ioPoints": 14,
                    "memory": "125 KB",
                    "scanTime": "0.1 ms/kInstruction",
                    "protocols": ["Profinet", "Profibus", "Modbus TCP", "Ethernet/IP"],
                },
                "pros": [
                    "Excellent diagnostic tools",
                    "TIA Portal integration",
                    "High reliability (99.9%)",
                    "Advanced security features",
                ],
                "cons": [
                    "TIA Portal license required ($450)",
                    "Steeper learning curve",
                    "Higher total cost",
                ],
            }
        )

    safety = str(requirements.get("safetyRequirements", ""))
    budget = str(requirements.get("budget", ""))
    if required_io >= 30 and ("SIL" in safety or "over" in budget):
        all_plcs.append(
            {
                "manufacturer": "Allen-Bradley",
                "model": "CompactLogix 5380",
                "series": "CompactLogix 5000",
                "score": 0,
                "matchPercentage": 0,
                "price": 2800,
                "reasons": [
                    "Maximum reliability for mission-critical applications",
                    "SIL 3 safety certification available",
                    "Best-in-class motion and drive integration",
                    "Extensive I/O and expansion capabilities",
                ],
                "specifications": {
                    "ioPoints": 32,
                    "memory": "3 MB",
                    "scanTime": "0.02 ms/kInstruction",
                    "protocols": ["EtherNet/IP", "ControlNet", "DeviceNet", "Modbus TCP"],
                },
                "pros": [
                    "Highest reliability (99.99%)",
                    "SIL 3 / PLe capable",
                    "Advanced diagnostics",
                    "Redundancy options",
                ],
                "cons": [
                    "Premium pricing",
                    "Studio 5000 license required ($1200)",
                    "Complex programming",
                ],
            }
        )

    if required_io <= 32:
        all_plcs.append(
            {
                "manufacturer": "Mitsubishi Electric",
                "model": "FX5U-32M",
                "series": "MELSEC FX5U",
                "score": 0,
                "matchPercentage": 0,
                "price": 650,
                "reasons": [
                    "Excellent value for money",
                    "Fast scan times for responsive control",
                    "Good motion control capabilities",
                    "Compact and efficient design",
                ],
                "specifications": {
                    "ioPoints": 32,
                    "memory": "200 KB",
                    "scanTime": "0.15 ms/kInstruction",
                    "protocols": ["CC-Link", "Ethernet", "Modbus TCP"],
                },
                "pros": [
                    "Competitive pricing",
                    "High-speed processing",
                    "User-friendly software",
                    "Reliable performance",
                ],
                "cons": [
                    "Less common in Western markets",
                    "Limited local support in some regions",
                    "Documentation primarily Japanese",
                ],
            }
        )

    io_req = requirements.get("ioRequirements") or {}
    comm_protocols = requirements.get("communicationProtocols") or []
    motion_control = bool(requirements.get("motionControl"))
    expansion_needed = bool(requirements.get("expansionNeeded"))
    scan_time_req = str(requirements.get("scanTimeRequirement", ""))

    budget_map = {
        "under-500": 500,
        "500-1000": 1000,
        "1000-2500": 2500,
        "2500-5000": 5000,
        "over-5000": 10000,
    }
    max_budget = budget_map.get(str(requirements.get("budget", "")), 5000)

    for plc in all_plcs:
        score = 0.0
        io_points = plc["specifications"]["ioPoints"]
        if io_points >= required_io:
            excess = io_points - required_io
            if excess < 10:
                score += 30
            elif excess < 20:
                score += 25
            else:
                score += 20
        else:
            score += 10

        price = plc["price"]
        if price <= max_budget:
            score += 25
        else:
            score += max(0, 25 - ((price - max_budget) / max_budget) * 25)

        if comm_protocols:
            matched = [
                p
                for p in comm_protocols
                if any(p.lower() in proto.lower() for proto in plc["specifications"]["protocols"])
            ]
            score += (len(matched) / len(comm_protocols)) * 20
        else:
            score += 15

        if motion_control:
            if "M241" in plc["model"] or "Siemens" in plc["manufacturer"] or "Rockwell" in plc["manufacturer"]:
                score += 10
            else:
                score += 5
        else:
            score += 8

        if "SIL" in safety:
            if "Rockwell" in plc["manufacturer"] or "Siemens" in plc["manufacturer"]:
                score += 10
            else:
                score += 3
        else:
            score += 8

        if scan_time_req == "ultra-fast":
            if "Rockwell" in plc["manufacturer"] or "Siemens" in plc["manufacturer"]:
                score += 5
        elif scan_time_req == "fast":
            if "TM221" not in plc["model"]:
                score += 5
        else:
            score += 5

        if expansion_needed and io_points < required_io:
            score -= 5

        plc["score"] = round(score)
        plc["matchPercentage"] = round((score / 100) * 100)

    all_plcs.sort(key=lambda p: p["score"], reverse=True)
    return all_plcs[:3]


def generate_solutions(
    _project_description: str,
    _constraints: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    return [
        {
            "name": "Schneider Modicon M221 Basic",
            "platform": "Schneider Electric",
            "model": "TM221C16R",
            "description": "Compact PLC ideal for simple automation tasks with basic I/O requirements",
            "cost": {"hardware": 250, "software": 0, "installation": 300, "maintenance": 50, "total": 600},
            "complexity": {
                "score": 3,
                "setupTime": "2-4 hours",
                "programmingDifficulty": "Beginner friendly",
                "maintenanceLevel": "Low",
            },
            "robustness": {
                "score": 6,
                "reliability": "99.5%",
                "safetyRating": "Basic (Category 1)",
                "environmentalRating": "IP20 (indoor)",
                "mtbf": "250,000 hours",
            },
            "pros": ["Lowest upfront cost", "Free programming software", "Easy to learn and program"],
            "cons": ["Limited I/O expansion", "Basic safety features only"],
            "bestFor": ["Small machines", "Budget-conscious projects"],
            "specifications": {
                "ioPoints": 16,
                "memoryKb": 32,
                "scanTime": "0.5ms per kInstruction",
                "communicationProtocols": ["Modbus", "Ethernet"],
                "expandability": "Limited (up to 7 expansion modules)",
            },
        },
        {
            "name": "Schneider Modicon M241 Standard",
            "platform": "Schneider Electric",
            "model": "TM241CE40T",
            "description": "Mid-range PLC with excellent balance of features, cost, and performance",
            "cost": {"hardware": 650, "software": 0, "installation": 500, "maintenance": 100, "total": 1250},
            "complexity": {
                "score": 5,
                "setupTime": "4-8 hours",
                "programmingDifficulty": "Intermediate",
                "maintenanceLevel": "Medium",
            },
            "robustness": {
                "score": 8,
                "reliability": "99.8%",
                "safetyRating": "Category 3 capable",
                "environmentalRating": "IP20 (industrial indoor)",
                "mtbf": "350,000 hours",
            },
            "pros": ["Good price-to-performance ratio", "Excellent I/O expansion options"],
            "cons": ["Higher cost than basic models", "Requires more programming knowledge"],
            "bestFor": ["Medium-sized machines", "Industrial environments"],
            "specifications": {
                "ioPoints": 40,
                "memoryKb": 256,
                "scanTime": "0.2ms per kInstruction",
                "communicationProtocols": ["Modbus", "Ethernet/IP", "CANopen", "Profibus"],
                "expandability": "High (up to 14 expansion modules)",
            },
        },
        {
            "name": "Siemens SIMATIC S7-1200",
            "platform": "Siemens",
            "model": "CPU 1214C DC/DC/DC",
            "description": "Versatile compact controller with advanced diagnostics and security",
            "cost": {"hardware": 850, "software": 450, "installation": 600, "maintenance": 150, "total": 2050},
            "complexity": {
                "score": 6,
                "setupTime": "6-12 hours",
                "programmingDifficulty": "Intermediate to Advanced",
                "maintenanceLevel": "Medium",
            },
            "robustness": {
                "score": 9,
                "reliability": "99.9%",
                "safetyRating": "SIL 2 capable",
                "environmentalRating": "IP20 (harsh industrial)",
                "mtbf": "450,000 hours",
            },
            "pros": ["Excellent diagnostics", "High reliability and performance"],
            "cons": ["Higher software licensing cost", "Steeper learning curve"],
            "bestFor": ["Critical industrial processes", "Complex automation systems"],
            "specifications": {
                "ioPoints": 14,
                "memoryKb": 125,
                "scanTime": "0.1ms per kInstruction",
                "communicationProtocols": ["Profinet", "Profibus", "Modbus TCP", "Ethernet/IP"],
                "expandability": "Very High (signal boards and modules)",
            },
        },
        {
            "name": "Allen-Bradley CompactLogix 5380",
            "platform": "Rockwell Automation",
            "model": "5069-L306ER",
            "description": "Enterprise-grade controller with maximum reliability and scalability",
            "cost": {"hardware": 2500, "software": 1200, "installation": 1200, "maintenance": 300, "total": 5200},
            "complexity": {
                "score": 8,
                "setupTime": "12-24 hours",
                "programmingDifficulty": "Advanced",
                "maintenanceLevel": "High",
            },
            "robustness": {
                "score": 10,
                "reliability": "99.99%",
                "safetyRating": "SIL 3 / PLe capable",
                "environmentalRating": "IP20 (extreme industrial)",
                "mtbf": "600,000 hours",
            },
            "pros": ["Highest reliability and uptime", "SIL 3 safety certification"],
            "cons": ["Premium pricing", "High software licensing costs"],
            "bestFor": ["Mission-critical systems", "Safety-rated applications"],
            "specifications": {
                "ioPoints": 32,
                "memoryKb": 3000,
                "scanTime": "0.02ms per kInstruction",
                "communicationProtocols": ["EtherNet/IP", "ControlNet", "DeviceNet", "Modbus TCP"],
                "expandability": "Maximum (30+ local modules, distributed I/O)",
            },
        },
        {
            "name": "Mitsubishi MELSEC FX5U",
            "platform": "Mitsubishi Electric",
            "model": "FX5U-32M",
            "description": "High-performance compact PLC with excellent cost-performance ratio",
            "cost": {"hardware": 550, "software": 200, "installation": 450, "maintenance": 80, "total": 1280},
            "complexity": {
                "score": 5,
                "setupTime": "4-8 hours",
                "programmingDifficulty": "Intermediate",
                "maintenanceLevel": "Low-Medium",
            },
            "robustness": {
                "score": 8,
                "reliability": "99.7%",
                "safetyRating": "Category 3",
                "environmentalRating": "IP20 (industrial)",
                "mtbf": "380,000 hours",
            },
            "pros": ["Excellent value for money", "Fast scan times"],
            "cons": ["Less common in Western markets", "Smaller service network"],
            "bestFor": ["Manufacturing equipment", "Cost-sensitive projects"],
            "specifications": {
                "ioPoints": 32,
                "memoryKb": 200,
                "scanTime": "0.15ms per kInstruction",
                "communicationProtocols": ["CC-Link", "Ethernet", "Modbus TCP", "Profinet"],
                "expandability": "High (8 expansion modules)",
            },
        },
    ]


def _balanced_score(solution: dict[str, Any]) -> float:
    cost_score = 10 - (solution["cost"]["total"] / 1000)
    complexity_score = 10 - solution["complexity"]["score"]
    robustness_score = solution["robustness"]["score"]
    return cost_score * 0.3 + complexity_score * 0.3 + robustness_score * 0.4


def rank_solutions(solutions: list[dict[str, Any]], criteria: str) -> list[dict[str, Any]]:
    sorted_solutions = list(solutions)
    if criteria == "cheapest":
        return sorted(sorted_solutions, key=lambda s: s["cost"]["total"])
    if criteria == "simplest":
        return sorted(sorted_solutions, key=lambda s: s["complexity"]["score"])
    if criteria == "robust":
        return sorted(sorted_solutions, key=lambda s: s["robustness"]["score"], reverse=True)
    if criteria == "balanced":
        return sorted(sorted_solutions, key=_balanced_score, reverse=True)
    return sorted_solutions


def get_criteria_description(criteria: str) -> str:
    descriptions = {
        "cheapest": "Minimize Total Cost of Ownership",
        "simplest": "Minimize Complexity and Setup Time",
        "robust": "Maximize Reliability and Safety",
        "balanced": "Optimize Cost, Complexity, and Reliability",
    }
    return descriptions.get(criteria, "Balanced Approach")


def generate_reasoning(solution: dict[str, Any], criteria: str) -> str:
    name = solution["name"]
    total = f"{solution['cost']['total']:,}"
    complexity = solution["complexity"]["score"]
    setup = solution["complexity"]["setupTime"]
    prog = solution["complexity"]["programmingDifficulty"].lower()
    robust = solution["robustness"]["score"]
    reliability = solution["robustness"]["reliability"]
    safety = solution["robustness"]["safetyRating"]
    mtbf = solution["robustness"]["mtbf"]

    if criteria == "cheapest":
        return (
            f"The {name} offers the lowest total cost of ownership at ${total}, "
            "making it ideal for budget-conscious projects."
        )
    if criteria == "simplest":
        return (
            f"With a complexity score of {complexity}/10 and setup time of {setup}, "
            f"the {name} provides the quickest path to deployment. "
            f"Its {prog} programming environment minimizes training requirements."
        )
    if criteria == "robust":
        return (
            f"The {name} achieves a robustness score of {robust}/10 with {reliability} reliability "
            f"and {safety} safety rating. With an MTBF of {mtbf}, it ensures maximum uptime."
        )
    return (
        f"The {name} provides an optimal balance with moderate cost (${total}), "
        f"manageable complexity ({complexity}/10), and strong reliability ({robust}/10)."
    )


def generate_tradeoffs(recommended: dict[str, Any], alternatives: list[dict[str, Any]]) -> list[str]:
    tradeoffs: list[str] = []
    for alt in alternatives:
        if alt["cost"]["total"] < recommended["cost"]["total"]:
            diff = recommended["cost"]["total"] - alt["cost"]["total"]
            tradeoffs.append(
                f"{alt['name']} costs ${diff:,} less but has lower robustness "
                f"({alt['robustness']['score']}/10 vs {recommended['robustness']['score']}/10)"
            )
        if alt["complexity"]["score"] < recommended["complexity"]["score"]:
            tradeoffs.append(
                f"{alt['name']} is simpler to implement "
                f"({alt['complexity']['score']}/10 vs {recommended['complexity']['score']}/10) "
                "but may lack advanced features"
            )
        if alt["robustness"]["score"] > recommended["robustness"]["score"]:
            diff = alt["cost"]["total"] - recommended["cost"]["total"]
            tradeoffs.append(
                f"{alt['name']} offers higher reliability "
                f"({alt['robustness']['score']}/10 vs {recommended['robustness']['score']}/10) "
                f"but costs ${diff:,} more"
            )
    return tradeoffs[:5]


def build_solution_response(
    project_description: str,
    criteria: str,
    constraints: dict[str, Any] | None,
    solutions: list[dict[str, Any]],
) -> dict[str, Any]:
    ranked = rank_solutions(solutions, criteria)
    return {
        "recommended": ranked[0],
        "alternatives": ranked[1:4],
        "comparison": {
            "criteria": get_criteria_description(criteria),
            "reasoning": generate_reasoning(ranked[0], criteria),
            "tradeoffs": generate_tradeoffs(ranked[0], ranked[1:]),
        },
    }


_ERROR_PATTERNS: dict[str, dict[str, dict[str, Any]]] = {
    "schneider": {
        "timer format": {
            "type": "Timer Configuration Error",
            "severity": "medium",
            "components": ["Timer blocks", "Time base settings"],
            "cause": "EcoStruxure Machine Expert requires timer values in T#format (e.g., T#100ms, T#5s)",
        },
        "variable not declared": {
            "type": "Variable Declaration Error",
            "severity": "high",
            "components": ["Variable declarations", "Data type assignments"],
            "cause": "Variable used in program but not declared in variable table",
        },
        "invalid address": {
            "type": "I/O Address Error",
            "severity": "high",
            "components": ["I/O configuration", "Address mapping"],
            "cause": "I/O address does not match PLC hardware configuration",
        },
        "syntax error": {
            "type": "Programming Syntax Error",
            "severity": "medium",
            "components": ["Code syntax", "Language-specific rules"],
            "cause": "Code does not follow IEC 61131-3 syntax rules",
        },
    },
    "siemens": {
        "data type mismatch": {
            "type": "Type Conversion Error",
            "severity": "high",
            "components": ["Data types", "Type conversions"],
            "cause": "Incompatible data types used in operations",
        },
        "db not found": {
            "type": "Data Block Error",
            "severity": "high",
            "components": ["Data blocks", "Global variables"],
            "cause": "Referenced data block does not exist or is not accessible",
        },
        "symbol not defined": {
            "type": "Symbol Table Error",
            "severity": "medium",
            "components": ["Symbol table", "Tag definitions"],
            "cause": "Symbol used in program but not defined in symbol table",
        },
    },
    "rockwell": {
        "tag not defined": {
            "type": "Tag Definition Error",
            "severity": "high",
            "components": ["Tag database", "Controller tags"],
            "cause": "Tag referenced in logic but not created in controller",
        },
        "routine not found": {
            "type": "Program Organization Error",
            "severity": "high",
            "components": ["Program structure", "Routine calls"],
            "cause": "Called routine does not exist in program",
        },
        "invalid instruction": {
            "type": "Instruction Error",
            "severity": "medium",
            "components": ["Instruction set", "Controller compatibility"],
            "cause": "Instruction not supported by target controller",
        },
    },
}


def analyze_error(error_message: str, platform: str, _error_screenshot: str | None = None) -> dict[str, Any]:
    detected = {
        "type": "Unknown Error",
        "severity": "medium",
        "components": ["General"],
        "cause": "Unable to determine specific error cause",
    }
    platform_errors = _ERROR_PATTERNS.get(platform.lower())
    if platform_errors:
        lower_msg = error_message.lower()
        for pattern, error_info in platform_errors.items():
            if pattern in lower_msg:
                detected = error_info
                break
    return {
        "errorType": detected["type"],
        "severity": detected["severity"],
        "affectedComponents": detected["components"],
        "rootCause": detected["cause"],
    }


def _fix_timer_format(code: str, platform: str) -> str:
    if "schneider" not in platform.lower():
        return code

    def replacer(match: re.Match[str]) -> str:
        value = match.group(1)
        ms = int(value)
        if ms < 1000:
            replacement = f"T#{ms}ms"
        elif ms % 1000 == 0:
            replacement = f"T#{ms // 1000}s"
        else:
            replacement = f"T#{ms}ms"
        return match.group(0).replace(value, replacement)

    return re.sub(
        r"(?:TON|TOF|TP)\s*\(\s*IN\s*:=.*?,\s*PT\s*:=\s*(\d+)\s*\)",
        replacer,
        code,
        flags=re.IGNORECASE,
    )


def _extract_variables(code: str) -> list[str]:
    keywords = {"VAR", "END_VAR", "IF", "THEN", "ELSE", "END_IF", "TRUE", "FALSE", "AND", "OR", "NOT"}
    matches = re.findall(r"\b([a-zA-Z_][a-zA-Z0-9_]*)\b", code)
    seen: set[str] = set()
    result: list[str] = []
    for var in matches:
        upper = var.upper()
        if upper not in keywords and var not in seen:
            seen.add(var)
            result.append(var)
    return result


def _infer_variable_type(var_name: str, code: str) -> str:
    name = var_name.lower()
    if "timer" in name or "ton" in name or "tof" in name:
        return "TON"
    if "counter" in name or "ctu" in name or "ctd" in name:
        return "CTU"
    if "bool" in name or "flag" in name or name.startswith("b"):
        return "BOOL"
    if "int" in name or "count" in name or name.startswith("i"):
        return "INT"
    if "real" in name or "float" in name or name.startswith("r"):
        return "REAL"
    if "time" in name or "delay" in name:
        return "TIME"
    if var_name in code:
        return "BOOL"
    return "BOOL"


def _add_missing_declarations(code: str, _platform: str) -> str:
    variables = _extract_variables(code)
    lines = ["\n(* Auto-generated variable declarations *)", "VAR"]
    for var_name in variables:
        lines.append(f"  {var_name} : {_infer_variable_type(var_name, code)};")
    lines.append("END_VAR\n")
    return "\n".join(lines) + code


def _fix_io_addressing(code: str, platform: str, _plc_model: str) -> str:
    address_map = {
        "schneider": {"%I": "%IX", "%Q": "%QX"},
        "siemens": {"%I": "I", "%Q": "Q", "%M": "M"},
        "rockwell": {"%I": "Local:I:O.Data", "%Q": "Local:O:O.Data"},
    }
    mapping = address_map.get(platform.lower())
    if not mapping:
        return code
    fixed = code
    for src, dst in mapping.items():
        fixed = fixed.replace(src, dst)
    return fixed


def _fix_syntax(code: str, _platform: str) -> str:
    fixed = re.sub(r"([^;{}\n])\s*\n", r"\1;\n", code)
    fixed = fixed.replace("==", "=")
    fixed = re.sub(r"\s=\s(?!=)", " := ", fixed)
    fixed = re.sub(r"\btrue\b", "TRUE", fixed, flags=re.IGNORECASE)
    fixed = re.sub(r"\bfalse\b", "FALSE", fixed, flags=re.IGNORECASE)
    return fixed


def generate_rectify_solutions(
    program_code: str,
    analysis: dict[str, Any],
    platform: str,
    plc_model: str,
) -> list[dict[str, Any]]:
    solutions: list[dict[str, Any]] = []
    error_type = analysis["errorType"]

    if "Timer" in error_type:
        solutions.append(
            {
                "description": "Corrected timer format to match platform requirements",
                "correctedCode": _fix_timer_format(program_code, platform),
                "explanation": (
                    f"Converted timer values to proper format for {platform}. "
                    "For EcoStruxure, timers must use T# notation (e.g., T#100ms instead of 100)."
                ),
                "confidence": 95,
            }
        )

    if "Variable" in error_type or "Tag" in error_type:
        solutions.append(
            {
                "description": "Added missing variable/tag declarations",
                "correctedCode": _add_missing_declarations(program_code, platform),
                "explanation": (
                    "Automatically detected undeclared variables and added them "
                    "to the declaration section with appropriate data types."
                ),
                "confidence": 85,
            }
        )

    if "Address" in error_type or "I/O" in error_type:
        solutions.append(
            {
                "description": "Corrected I/O addressing to match PLC model",
                "correctedCode": _fix_io_addressing(program_code, platform, plc_model),
                "explanation": f"Adjusted I/O addresses to be compatible with {plc_model} hardware configuration.",
                "confidence": 80,
            }
        )

    if "Syntax" in error_type:
        solutions.append(
            {
                "description": "Fixed syntax errors",
                "correctedCode": _fix_syntax(program_code, platform),
                "explanation": (
                    f"Corrected syntax to comply with IEC 61131-3 standards and {platform}-specific requirements."
                ),
                "confidence": 90,
            }
        )

    if not solutions:
        solutions.append(
            {
                "description": "General code review and corrections",
                "correctedCode": program_code,
                "explanation": (
                    "Please review the error message and manually adjust the code. "
                    "Consider checking variable names, data types, and platform-specific requirements."
                ),
                "confidence": 50,
            }
        )
    return solutions


def generate_rectify_recommendations(analysis: dict[str, Any], platform: str) -> list[str]:
    recommendations = [
        "Always validate program syntax before uploading to PLC software",
        "Keep variable names descriptive and follow naming conventions",
        "Document your code with comments for better maintainability",
    ]
    if analysis["severity"] in ("critical", "high"):
        recommendations.extend(
            [
                "Test the corrected program in simulation mode before deploying to hardware",
                "Create a backup of your current program before applying changes",
            ]
        )
    platform_lower = platform.lower()
    if "schneider" in platform_lower:
        recommendations.extend(
            [
                "Use EcoStruxure Machine Expert's built-in syntax checker before compiling",
                "Ensure timer values use T# format (e.g., T#100ms, T#5s)",
            ]
        )
    elif "siemens" in platform_lower:
        recommendations.extend(
            [
                "Use TIA Portal's compiler to catch errors early",
                "Organize code using Function Blocks (FB) and Functions (FC)",
            ]
        )
    elif "rockwell" in platform_lower:
        recommendations.extend(
            [
                "Use Studio 5000's tag database for consistent tag naming",
                "Leverage Add-On Instructions (AOI) for reusable code",
            ]
        )

    error_type = analysis["errorType"]
    if "Timer" in error_type:
        recommendations.append("Double-check timer preset values and time bases")
    if "Variable" in error_type or "Tag" in error_type:
        recommendations.append("Maintain a comprehensive variable/tag naming convention document")
    if "Address" in error_type:
        recommendations.append("Create an I/O address mapping spreadsheet for reference")
    return recommendations


def rectify_error_fallback(payload: dict[str, Any]) -> dict[str, Any]:
    analysis = analyze_error(
        payload.get("errorMessage", ""),
        payload.get("platform", ""),
        payload.get("errorScreenshot"),
    )
    solutions = generate_rectify_solutions(
        payload.get("programCode", ""),
        analysis,
        payload.get("platform", ""),
        payload.get("plcModel", ""),
    )
    return {
        "success": True,
        "analysis": analysis,
        "solutions": solutions,
        "recommendations": generate_rectify_recommendations(analysis, payload.get("platform", "")),
    }

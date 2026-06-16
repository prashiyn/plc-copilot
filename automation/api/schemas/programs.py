from typing import Any, Literal

from pydantic import BaseModel, Field

SynthesisMode = Literal["constrained", "arbitrary"]


PatternName = Literal[
    "motor_startstop",
    "sequential_lights",
    "estop_motor",
    "tank_level",
    "conveyor_startstop",
    "traffic_lights",
    "motor_interlock",
    "pump_staging",
    "timed_motor",
]
PlatformName = Literal["schneider", "rockwell", "siemens", "mitsubishi"]
PlcopenPlatform = Literal["schneider", "rockwell", "siemens", "mitsubishi", "codesys", "universal"]


class PatternSource(BaseModel):
    type: Literal["pattern"] = "pattern"
    pattern: PatternName
    numLights: int = Field(default=4, ge=2, le=8)
    delaySeconds: int = Field(default=3, ge=1, le=60)
    cycleSeconds: int = Field(default=5, ge=1, le=60)
    runSeconds: int = Field(default=5, ge=1, le=60)


class SketchAnalysisSource(BaseModel):
    type: Literal["sketch_analysis"]
    analysis: dict[str, Any]


class IrSource(BaseModel):
    type: Literal["ir"]
    program: dict[str, Any]


class ClaudeIrSource(BaseModel):
    type: Literal["claude_ir"] = "claude_ir"
    description: str = Field(min_length=1)
    synthesisMode: SynthesisMode = "constrained"


class ProgramGenerateRequest(BaseModel):
    platform: PlatformName
    controller: str = "TM221CE24R"
    projectName: str = "MotorControl"
    source: PatternSource | SketchAnalysisSource | IrSource | ClaudeIrSource


class PlcopenGenerateRequest(BaseModel):
    name: str = "MotorControl"
    platform: PlcopenPlatform = "universal"
    pattern: PatternName = "motor_startstop"
    controller: str = "TM221CE24R"
    numLights: int = Field(default=4, ge=2, le=8)
    delaySeconds: int = Field(default=3, ge=1, le=60)
    cycleSeconds: int = Field(default=5, ge=1, le=60)
    runSeconds: int = Field(default=5, ge=1, le=60)


class ProgramFileResult(BaseModel):
    fileName: str
    mimeType: str
    contentBase64: str
    metadata: dict[str, Any]

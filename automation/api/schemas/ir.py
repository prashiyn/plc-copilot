from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator


PlcVendor = Literal["schneider", "rockwell", "siemens", "mitsubishi", "codesys", "generic"]
PlcDataType = Literal["BOOL", "INT", "DINT", "REAL", "TIME", "TON", "TOF", "TP", "CTU", "CTD", "CTUD"]
PlcVarKind = Literal["input", "output", "memory", "timer", "counter"]
PouLanguage = Literal["LD", "ST", "IL", "FBD"]
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
    "pid_loop",
]
TimerType = Literal["TON", "TOF", "TP"]
CounterType = Literal["CTU", "CTD", "CTUD"]
CompareOp = Literal["GT", "GE", "LT", "LE", "EQ"]
FbKind = Literal["PID"]
EstopSymbolName = Literal["ESTOP_BTN", "E_STOP", "EMERGENCY_STOP"]


class PlcTarget(BaseModel):
    vendor: PlcVendor
    model: str


class PlcMeta(BaseModel):
    author: str = "PLCAutoPilot"
    description: str = ""
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    pattern: PatternName | None = None
    patternParams: dict[str, int | str | float | bool] = Field(default_factory=dict)
    requireEstop: bool = False


class PlcVar(BaseModel):
    symbol: str
    address: str | None = None
    dataType: PlcDataType = "BOOL"
    kind: PlcVarKind
    initial: str | None = None
    comment: str | None = None


class ContactNode(BaseModel):
    type: Literal["contact"] = "contact"
    symbol: str
    negated: bool = False


class CoilNode(BaseModel):
    type: Literal["coil"] = "coil"
    symbol: str
    coilType: Literal["normal", "set", "reset"] = "normal"


class AndNode(BaseModel):
    type: Literal["and"] = "and"
    inputs: list["LogicNode"]


class OrNode(BaseModel):
    type: Literal["or"] = "or"
    inputs: list["LogicNode"]


class NotNode(BaseModel):
    type: Literal["not"] = "not"
    input: "LogicNode"


class TimerNode(BaseModel):
    type: Literal["timer"] = "timer"
    symbol: str
    timerType: TimerType = "TON"
    presetMs: int | None = Field(default=None, ge=1, le=3_600_000)


class CounterNode(BaseModel):
    type: Literal["counter"] = "counter"
    symbol: str
    counterType: CounterType = "CTU"
    preset: int | None = Field(default=None, ge=0, le=999_999)


class CompareNode(BaseModel):
    type: Literal["compare"] = "compare"
    left: str
    right: str
    op: CompareOp
    output: str


class FbParamRef(BaseModel):
    name: str
    symbol: str
    direction: Literal["in", "out", "inout"] = "in"


class FbCallNode(BaseModel):
    type: Literal["fb_call"] = "fb_call"
    kind: FbKind
    instance: str
    params: list[FbParamRef] = Field(default_factory=list)
    enable: str | None = None


LogicNode = Annotated[
    ContactNode
    | CoilNode
    | AndNode
    | OrNode
    | NotNode
    | TimerNode
    | CounterNode
    | CompareNode
    | FbCallNode,
    Field(discriminator="type"),
]


class Network(BaseModel):
    label: str | None = None
    comment: str | None = None
    logic: LogicNode


class Pou(BaseModel):
    name: str = "MainProgram"
    language: PouLanguage = "LD"
    networks: list[Network]


class PlcProgram(BaseModel):
    name: str
    target: PlcTarget
    vars: list[PlcVar]
    pous: list[Pou]
    meta: PlcMeta = Field(default_factory=PlcMeta)

    @model_validator(mode="after")
    def require_networks(self) -> "PlcProgram":
        if not self.pous:
            raise ValueError("PlcProgram requires at least one POU")
        if not any(pou.networks for pou in self.pous):
            raise ValueError("PlcProgram requires at least one network")
        return self


AndNode.model_rebuild()
OrNode.model_rebuild()
NotNode.model_rebuild()
Network.model_rebuild()

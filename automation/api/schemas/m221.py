from typing import Any, Literal

from pydantic import BaseModel, Field


class M221IoPoint(BaseModel):
    address: str
    symbol: str
    comment: str = ""


class M221Timer(BaseModel):
    address: str
    symbol: str
    type: str = "TON"
    preset: int = 3
    timebase: str = "1s"
    comment: str = ""


class M221Rung(BaseModel):
    name: str
    comment: str = ""
    il: list[str] = Field(default_factory=list)
    ladder: str = ""


class M221ProgramData(BaseModel):
    projectName: str = "M221_Program"
    inputs: list[M221IoPoint] = Field(default_factory=list)
    outputs: list[M221IoPoint] = Field(default_factory=list)
    memory: list[M221IoPoint] = Field(default_factory=list)
    timers: list[M221Timer] = Field(default_factory=list)
    rungs: list[M221Rung] = Field(default_factory=list)


class M221BuildRequest(BaseModel):
    programData: dict[str, Any]
    plcModel: str = "TM221CE16T"
    projectName: str | None = None


class M221GenerateRequest(BaseModel):
    description: str
    plcModel: str = "TM221CE16T"
    projectName: str | None = None

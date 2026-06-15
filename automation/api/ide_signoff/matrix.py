"""IDE sign-off matrix — one canonical export per target IDE (Phase 5 P0)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class IdeSignoffCase:
    id: str
    platform: str
    ide: str
    ide_version_hint: str
    pattern: str
    vendor: str
    model: str
    tier: int
    import_type: str
    export_case_id: str
    file_extension: str
    manual_steps: str


IDE_SIGNOFF_CASES: tuple[IdeSignoffCase, ...] = (
    IdeSignoffCase(
        id="signoff_schneider_motor",
        platform="Schneider Electric",
        ide="EcoStruxure Machine Expert - Basic",
        ide_version_hint="1.2+",
        pattern="motor_startstop",
        vendor="schneider",
        model="TM221CE24R",
        tier=1,
        import_type="full_project",
        export_case_id="motor_startstop_schneider",
        file_extension=".smbp",
        manual_steps=(
            "File → Open → select .smbp → verify zero import errors → "
            "Build → verify compile succeeds → confirm START/STOP/MOTOR_RUN logic."
        ),
    ),
    IdeSignoffCase(
        id="signoff_schneider_sequential",
        platform="Schneider Electric",
        ide="EcoStruxure Machine Expert - Basic",
        ide_version_hint="1.2+",
        pattern="sequential_lights",
        vendor="schneider",
        model="TM221CE16T",
        tier=1,
        import_type="full_project",
        export_case_id="sequential_lights_schneider",
        file_extension=".smbp",
        manual_steps=(
            "Open .smbp → verify timers and LIGHT outputs import → Build → "
            "confirm sequential START/STOP behavior in ladder view."
        ),
    ),
    IdeSignoffCase(
        id="signoff_rockwell_motor",
        platform="Rockwell Automation",
        ide="Studio 5000 Logix Designer",
        ide_version_hint="v32+",
        pattern="motor_startstop",
        vendor="rockwell",
        model="1769-L33ER",
        tier=1,
        import_type="full_project",
        export_case_id="motor_startstop_rockwell",
        file_extension=".L5X",
        manual_steps=(
            "File → Open → .L5X → import with matching controller family → "
            "verify zero errors → Verify Controller → confirm tag/rung presence."
        ),
    ),
    IdeSignoffCase(
        id="signoff_rockwell_sequential",
        platform="Rockwell Automation",
        ide="Studio 5000 Logix Designer",
        ide_version_hint="v32+",
        pattern="sequential_lights",
        vendor="rockwell",
        model="1769-L33ER",
        tier=1,
        import_type="full_project",
        export_case_id="sequential_lights_rockwell",
        file_extension=".L5X",
        manual_steps=(
            "Open .L5X → verify TON timers and LIGHT tags → Verify Controller → "
            "confirm sequential logic in MainProgram."
        ),
    ),
    IdeSignoffCase(
        id="signoff_siemens_motor",
        platform="Siemens",
        ide="TIA Portal",
        ide_version_hint="V17+",
        pattern="motor_startstop",
        vendor="siemens",
        model="S7-1200",
        tier=2,
        import_type="source_import",
        export_case_id="motor_startstop_siemens",
        file_extension=".scl",
        manual_steps=(
            "External source files → Add existing .scl → import blocks → "
            "Compile → verify no syntax errors (source import, not full .ap15 project)."
        ),
    ),
    IdeSignoffCase(
        id="signoff_mitsubishi_motor",
        platform="Mitsubishi Electric",
        ide="GX Works3",
        ide_version_hint="1.080+",
        pattern="motor_startstop",
        vendor="mitsubishi",
        model="FX5U",
        tier=2,
        import_type="source_import",
        export_case_id="motor_startstop_mitsubishi",
        file_extension=".zip",
        manual_steps=(
            "Extract ZIP → import IL/ST/device comments per GX Works workflow → "
            "Convert/compile → verify symbols (source bundle, not .gxw project)."
        ),
    ),
    IdeSignoffCase(
        id="signoff_codesys_motor",
        platform="CODESYS",
        ide="CODESYS Development System",
        ide_version_hint="3.5 SP19+",
        pattern="motor_startstop",
        vendor="codesys",
        model="Generic",
        tier=1,
        import_type="full_project",
        export_case_id="plcopen_motor_codesys",
        file_extension=".xml",
        manual_steps=(
            "File → Open project from PLCopen XML → verify POUs/variables → "
            "Build → confirm ladder matches motor start/stop pattern."
        ),
    ),
)


def signoff_case_by_id(case_id: str) -> IdeSignoffCase:
    for case in IDE_SIGNOFF_CASES:
        if case.id == case_id:
            return case
    raise KeyError(f"Unknown IDE sign-off case: {case_id}")

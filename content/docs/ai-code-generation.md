# AI Code Generation Basics

The generator can run in two modes:

- **Pattern mode (default):** your description is matched to a catalog pattern (`motor_startstop`, `pid_loop`, etc.) and built deterministically.
- **AI synthesis:** sends the description to Claude IR generation for broader logic (constrained or arbitrary).

## Writing good descriptions

- Name the equipment: "conveyor motor", "fill pump", "tank level".
- Include timing: "4 lights, 2 second delay".
- For PID: include "setpoint 75" or "temperature control".

## Architecture

UI → `/api/generate-plc` → `lib/plc-generation.ts` → FastAPI `/v1/programs/generate` → Python IR builder/exporters.

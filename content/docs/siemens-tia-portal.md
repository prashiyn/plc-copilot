# Siemens TIA Portal Integration

PLCAutoPilot exports **SCL** and **PLCopen XML** for Siemens S7-1200 and S7-1500 targets.

## Workflow

1. Generate a program with a Siemens controller selected.
2. Download the SCL or XML artifact.
3. Import into TIA Portal as an external source or via PLCopen import tools.

## PID / analog

Use the `pid_loop` template or describe "PID temperature control with setpoint 50". The IR includes `compare` and `fb_call` nodes serialized to SCL comments and stub rungs where full FB binaries are not writable from cloud.

## Tips

- Keep project names alphanumeric for clean file names.
- Review analog addresses in the IR variable table before commissioning.

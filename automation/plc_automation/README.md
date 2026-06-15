# plc_automation — legacy desktop helpers

## Production export path (use this)

All live generation goes through the **IR pipeline**:

| Use case | Entry point |
|----------|-------------|
| HTTP / UI | FastAPI `automation/api/` via `lib/automation-client.ts` |
| Patterns | `POST /v1/programs/generate` |
| Sketch | `POST /v1/sketches/generate` or CLI `generate --from-sketch` |
| JSON file | CLI `generate --from-json` (IR, sketch analysis, or legacy tags+rungs) |

See [PHASE_4 Platform Integrations](../../docs/architecture/PHASE_4_PLATFORM_INTEGRATIONS.md) and [PHASE_5 Implementation Plan](../../docs/architecture/PHASE_5_IMPLEMENTATION.md).

## Deprecated offline scripts

These scripts write **legacy `<ProjectDescriptor>` XML** and are **not** on the live export path:

- `create_motor_startstop_smbp.py`
- `create_sequential_lights_smbp.py`

They remain for historical reference only. Running them emits a `DeprecationWarning`. Prefer:

```bash
cd automation
uv run pytest api/tests/test_patterns_4j.py -v   # pattern coverage
uv run python -m plc_file_handler.cli generate --platform schneider --name Motor \
  --from-sketch path/to/sketch.jpg -o Motor.smbp
```

## PLCAutomation package

`PLCAutomation` / PLCopen export is used by `ir/providers/plcopen.py` — that path is supported and tested in CI.

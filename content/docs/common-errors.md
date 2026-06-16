# Common Error Messages

## Automation service not configured

Set `AUTOMATION_API_URL` and `AUTOMATION_API_KEY` in `.env` and ensure the FastAPI sidecar is running.

## Unauthorized on /api/usage or /api/programs

Sign in — metering and saved programs require a session.

## Generation failed / invalid model

Select a valid PLC model in the cascading selector before generating.

## Tier-2 disclaimer

Siemens/Mitsubishi exports are importable text artifacts, not native compiled projects. This is expected for cloud generation.

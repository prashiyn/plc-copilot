# REST API Overview

Production features use typed BFF routes that proxy to the FastAPI automation sidecar.

## Examples

| BFF route | Backend |
|-----------|---------|
| `/api/generate-plc` | Program generation |
| `/api/ai-chat` | `/v1/ai/copilot/chat` |
| `/api/hmi-generate` | `/v1/ai/hmi/generate` |
| `/api/usage` | Postgres usage analytics |

## Authentication

Browser routes use Auth.js sessions. Automation calls use `AUTOMATION_API_KEY` server-to-server.

User API keys (Settings → API Keys) are stored in Postgres and can be used for future programmatic access.

# Next-Version Backlog (post-v1.5)

Things intentionally deferred during v1.5. Keep this current: whenever something is
pushed to "next version," add it here with the reason and a pointer to where it was
deferred from.

## Platform integrations (from [PHASE_4_PLATFORM_INTEGRATIONS.md](PHASE_4_PLATFORM_INTEGRATIONS.md))
- **Real IDE import sign-off per platform** — open each exported file in Studio 5000 /
  EcoStruxure / TIA Portal / GX Works and confirm a clean import + compile. v1.5 stops
  at schema validation + round-trip parse (no IDEs available to test now). *This is the
  acceptance gate for graduating each platform from "round-trip-verified" to "verified".*
- **General arbitrary-logic synthesis** — beyond the v1.5 pattern library; free-form
  program generation with high reliability. v1.5 ships a bounded, dependable set.
- **Siemens full project export** (TIA Openness / `.ap*`/`.zap*`) — v1.5 ships SCL +
  PLCopen *source* import only.
- **Mitsubishi native project export** (GX Works `.gxw`/`.gx*`) — v1.5 ships IL/ST +
  device-comment CSV *source* import only.
- **Native binary project formats** generally (`.acd`, `.zap*`, `.gxw`) — require the
  vendor toolchain on Windows; not feasible from an open format.
- **FBD graphical layout fidelity** — v1.5 targets LD/ST/IL logic correctness, not
  pixel-accurate graphical layout.

## AI / logic
- **Activate + verify the live Claude path** for the Phase 3 routes (recommend-plc,
  recommend-solution, rectify-error). Needs `ANTHROPIC_API_KEY` in the environment;
  v1.5 verified only the deterministic fallbacks. (Config, not code — do this as soon
  as the key is available.)

## Integrations
- **Real SAP integration** (RFC / OData / BAPIs) — v1.5 keeps `sap/*` **simulated**
  (`simulated: true` + UI banner). See `app/api/sap/export/route.ts`.

## Billing (Phase 5, deferred)
- **Stripe payment processing** for the subscription/billing pages (currently UI-only).

## Auth
- **Real OAuth providers** (Google / GitHub) on the login page — buttons exist but are
  not wired; v1.5 ships Credentials (email/password) only.

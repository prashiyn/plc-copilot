# Vendor export schema maintenance

**Operations guide:** [VENDOR_SCHEMA_MAINTENANCE.md](../../../docs/architecture/VENDOR_SCHEMA_MAINTENANCE.md)

| File | Type | CI default |
|------|------|------------|
| `manifest.json` | Version registry | — |
| `l5x-v32.xsd` | Full Rockwell L5X (community) | ✅ |
| `calaos-case-2.0-subset.xsd` | Schneider Calaos subset | ✅ |

Validated by `api/validation/xsd_validate.py`, `api/validation/schema_registry.py`.

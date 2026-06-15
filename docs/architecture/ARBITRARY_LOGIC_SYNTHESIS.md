# Arbitrary Logic Synthesis

Design and operations guide for **Claude → validated PlcProgram IR** when the user’s requirement does not map to a deterministic pattern template.

**Related:** [PHASE_5_IMPLEMENTATION.md](PHASE_5_IMPLEMENTATION.md) §P3, `automation/api/services/claude_ir_service.py`, [RUNBOOK.md](../RUNBOOK.md).

---

## 1. Two synthesis modes

| Mode | API field | On validation failure | Use when |
|------|-----------|----------------------|----------|
| **constrained** (default) | `synthesisMode: "constrained"` | Falls back to nearest vetted pattern (`pattern_fallback`) | Production NL generate, M221 AI, BFF `claude_ir` — maximum reliability |
| **arbitrary** | `synthesisMode: "arbitrary"` | Raises `IrSynthesisError` after 3 attempts | Engineering / pilot features where silent template substitution is unacceptable |

Constrained mode is the v1.5 behaviour (4e). Arbitrary mode is the P3 extension: same retry loop and `validate_program()` gate, **no** `build_pattern()` fallback.

---

## 2. Request surfaces

| Entry | How to set arbitrary mode |
|-------|---------------------------|
| `POST /v1/programs/generate` | `source: { "type": "claude_ir", "description": "...", "synthesisMode": "arbitrary" }` |
| `POST /v1/ir/generate-from-description` | Body: `{ "description": "...", "synthesisMode": "arbitrary" }` |
| `program.claude_ir` job | Payload includes `synthesisMode` |
| `M221ProgramService.generate_from_description` | `synthesis_mode="arbitrary"` kwarg |

---

## 3. Validation bar (unchanged)

Arbitrary IR must pass the same `validate_program()` checks as pattern or sketch IR:

- Schema / symbol cross-reference
- Timer and counter kind/dataType pairing
- Pattern-specific rules when `meta.pattern` is set
- Optional `meta.requireEstop` NC-contact rules

Arbitrary mode uses an extended system prompt (`ARBITRARY_IR_SYSTEM_PROMPT`) that instructs Claude to emit custom ladder logic and leave `meta.pattern` null unless the result truly matches a library template.

---

## 4. Error handling

```python
from api.services.claude_ir_service import ClaudeIrService, IrSynthesisError

try:
    result = ClaudeIrService().generate_program_ir(
        description,
        synthesis_mode="arbitrary",
    )
except IrSynthesisError as exc:
    # exc.errors — validation messages from last attempt
    # exc.attempts — always MAX_RETRIES + 1 (3)
```

HTTP mapping: callers should translate `IrSynthesisError` to **422** with `{ "errors": [...] }` when exposing synchronous endpoints.

---

## 5. When not to use arbitrary mode

- Customer-facing generate where a working (if approximate) program is better than failure → **constrained**
- Requirements clearly covered by pattern library v1/v2 → `source.type: "pattern"`
- Sketch imports → `sketch_analysis` (deterministic adapter, no Claude)

---

## 6. Pattern library v2 (companion to P3)

Three additional deterministic templates ship with P3:

| Pattern | Purpose |
|---------|---------|
| `motor_interlock` | Dual motors with mutual exclusion |
| `pump_staging` | Lead/lag pump tank fill |
| `timed_motor` | Motor seal-in + on-delay timer before output |

These remain the preferred path when the NL description matches; arbitrary mode is for everything else.

---

## 7. Verify

```bash
cd automation
uv run pytest api/tests/test_p3_logic_depth.py api/tests/test_patterns_v2.py api/tests/test_claude_ir.py -v
```

---

**Arbitrary Logic Synthesis | PLCAutoPilot**

#!/usr/bin/env python3
"""Regenerate golden IR fixtures and export hash manifest for Phase 4h tests."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.tests.golden_utils import (  # noqa: E402
    EXPORT_MANIFEST_PATH,
    IR_FIXTURES_DIR,
    refresh_all_golden_fixtures,
)


def main() -> int:
    refresh_all_golden_fixtures()
    print(f"Updated IR fixtures in {IR_FIXTURES_DIR}")
    print(f"Updated export manifest at {EXPORT_MANIFEST_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

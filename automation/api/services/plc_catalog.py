from pathlib import Path

_CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "plc_catalog.txt"


def build_catalog_text() -> str:
    return _CATALOG_PATH.read_text(encoding="utf-8")

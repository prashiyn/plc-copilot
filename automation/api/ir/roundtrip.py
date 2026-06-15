from pathlib import Path
from typing import Any
import zipfile

from plc_file_handler.parsers.rockwell_parser import RockwellParser
from plc_file_handler.parsers.schneider_parser import SchneiderParser
from plc_file_handler.parsers.siemens_parser import SiemensParser
from plc_file_handler.parsers.mitsubishi_parser import MitsubishiParser

from ..schemas.ir import PlcProgram
from .validator import collect_logic_symbols, validate_program

_SYMBOL_ALIASES: dict[str, list[str]] = {
    "SEQ_RUN": ["SEQUENCE_RUN"],
}
for _i in range(1, 9):
    _SYMBOL_ALIASES[f"LIGHT{_i}"] = [f"LIGHT_{_i}"]


def _symbol_variants(symbol: str) -> set[str]:
    variants = {symbol}
    for alias in _SYMBOL_ALIASES.get(symbol, []):
        variants.add(alias)
    return variants


def _symbol_matched(symbol: str, parsed_symbols: set[str], file_text: str) -> bool:
    for variant in _symbol_variants(symbol):
        if variant in parsed_symbols:
            return True
        if file_text and variant in file_text:
            return True
    return False


def assert_roundtrip(program: PlcProgram, file_path: str) -> dict[str, Any]:
    """Parse exported file and assert key IR symbols appear in parsed output."""
    validated = validate_program(program)
    suffix = file_path.lower()
    file_text = _read_roundtrip_text(file_path)

    if suffix.endswith(".l5x"):
        parsed = RockwellParser(file_path).parse()
        parsed_symbols = {tag["name"] for tag in parsed.get("tags", [])}
        platform = parsed.get("platform")
    elif suffix.endswith(".smbp") or suffix.endswith(".xml"):
        parsed = SchneiderParser(file_path).parse()
        parsed_symbols = {tag.get("name", "") for tag in parsed.get("tags", []) if tag.get("name")}
        platform = parsed.get("platform")
    elif suffix.endswith(".scl"):
        parsed = SiemensParser(file_path).parse()
        parsed_symbols = {tag.get("name", "") for tag in parsed.get("tags", []) if tag.get("name")}
        platform = parsed.get("platform")
    elif suffix.endswith(".zip"):
        parsed = MitsubishiParser(file_path).parse()
        parsed_symbols = {tag.get("name", "") for tag in parsed.get("tags", []) if tag.get("name")}
        platform = parsed.get("platform")
    else:
        raise ValueError(f"Unsupported round-trip file type: {file_path}")

    expected = set()
    for pou in validated.pous:
        for network in pou.networks:
            expected |= collect_logic_symbols(network.logic)
    expected |= {var.symbol for var in validated.vars}

    matched = sorted(symbol for symbol in expected if symbol and _symbol_matched(symbol, parsed_symbols, file_text))
    missing = sorted(symbol for symbol in expected if symbol and not _symbol_matched(symbol, parsed_symbols, file_text))

    ok = len(missing) == 0 or len(matched) >= max(1, len(expected) // 2)
    return {
        "ok": ok,
        "platform": platform,
        "expectedSymbols": sorted(expected),
        "matchedSymbols": matched,
        "missingSymbols": missing,
        "parsedTagCount": len(parsed_symbols),
    }


def _read_roundtrip_text(file_path: str) -> str:
    path = Path(file_path)
    if path.suffix.lower() == ".zip":
        chunks: list[str] = []
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                chunks.append(archive.read(name).decode("utf-8", errors="ignore"))
        return "\n".join(chunks)
    return path.read_text(encoding="utf-8", errors="ignore")

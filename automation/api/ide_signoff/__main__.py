"""CLI for Phase 5 P0 IDE sign-off automation."""

from __future__ import annotations

import argparse
import json
import sys

from api.ide_signoff.manifest import all_automated_passed, load_manifest, record_manual_signoff
from api.ide_signoff.runner import run_automated_signoff, write_signoff_bundle, write_signoff_manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="IDE import sign-off automated gates (Phase 5 P0)")
    sub = parser.add_subparsers(dest="command", required=True)

    run_parser = sub.add_parser("run", help="Run automated checks and update manifest.json")
    run_parser.add_argument(
        "--json",
        action="store_true",
        help="Print full report JSON to stdout",
    )

    sub.add_parser("bundle", help="Write lab export files under fixtures/ide_signoff/exports/")
    sub.add_parser("status", help="Print manifest automated/manual summary")

    record_parser = sub.add_parser("record", help="Record manual IDE lab result for one case")
    record_parser.add_argument("--case", required=True, help="Sign-off case id")
    record_parser.add_argument("--status", required=True, choices=["passed", "failed", "pending"])
    record_parser.add_argument("--tested-by", required=True)
    record_parser.add_argument("--ide-version", required=True)
    record_parser.add_argument("--compiles", required=True, choices=["true", "false"])
    record_parser.add_argument("--import-errors", default=None)
    record_parser.add_argument("--notes", default=None)

    args = parser.parse_args(argv)

    if args.command == "run":
        report = run_automated_signoff()
        write_signoff_manifest()
        if args.json:
            payload = {
                "passed": report.passed,
                "cases": [
                    {
                        "id": item.case_id,
                        "passed": item.passed,
                        "checks": item.checks,
                        "failures": item.failures,
                        "fileName": item.file_name,
                    }
                    for item in report.results
                ],
            }
            print(json.dumps(payload, indent=2))
        else:
            for item in report.results:
                status = "PASS" if item.passed else "FAIL"
                print(f"{status}  {item.case_id}  ({', '.join(item.checks) or 'none'})")
                for failure in item.failures:
                    print(f"       ! {failure}")
        return 0 if report.passed else 1

    if args.command == "bundle":
        path = write_signoff_bundle()
        write_signoff_manifest()
        print(f"Wrote {len(list(path.iterdir()))} export files to {path}")
        return 0

    if args.command == "status":
        manifest = load_manifest()
        cases = manifest.get("cases", {})
        for case_id, entry in sorted(cases.items()):
            automated = entry.get("automated", {})
            manual = entry.get("manual", {})
            print(
                f"{case_id}: automated={automated.get('status', 'missing')} "
                f"manual={manual.get('status', 'missing')}"
            )
        if all_automated_passed(manifest):
            print("All automated gates passed.")
            return 0
        print("Automated gates incomplete or failed.", file=sys.stderr)
        return 1

    if args.command == "record":
        record_manual_signoff(
            args.case,
            status=args.status,
            tested_by=args.tested_by,
            ide_version=args.ide_version,
            compiles=args.compiles == "true",
            import_errors=args.import_errors,
            notes=args.notes,
        )
        print(f"Recorded manual sign-off for {args.case}: {args.status}")
        return 0

    return 2


if __name__ == "__main__":
    raise SystemExit(main())

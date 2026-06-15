#!/usr/bin/env python3
"""
PLC File Handler CLI
Command-line interface for PLC file operations.
"""

import argparse
import sys
import os
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from plc_file_handler import (
    detect_plc_format,
    SchneiderParser,
    RockwellParser,
    SchneiderGenerator,
    RockwellGenerator,
    SketchAnalyzer,
    PlatformConverter
)


def parse_file(args):
    """Parse a PLC file and display information."""

    try:
        # Detect format
        format_info = detect_plc_format(args.file)
        print(f"\nDetected Format: {format_info.platform} - {format_info.format_type}")

        # Parse based on platform
        if format_info.platform == 'schneider':
            parser = SchneiderParser(args.file)
            project = parser.parse()
            print(parser.get_summary())

            if args.output:
                parser.export_to_json(args.output)

        elif format_info.platform == 'rockwell' and format_info.format_type == 'studio5000_xml':
            parser = RockwellParser(args.file)
            project = parser.parse()
            print(parser.get_summary())

            if args.output:
                parser.export_to_json(args.output)

        else:
            print(f"Parser not yet implemented for {format_info.platform}")

    except Exception as e:
        print(f"Error parsing file: {e}")
        sys.exit(1)


def analyze_sketch(args):
    """Analyze a hand-drawn ladder logic sketch."""

    if not os.getenv('ANTHROPIC_API_KEY'):
        print("Error: ANTHROPIC_API_KEY environment variable not set")
        print("Set it with: export ANTHROPIC_API_KEY=your_key_here")
        sys.exit(1)

    try:
        analyzer = SketchAnalyzer()

        print(f"\nAnalyzing sketch: {args.image}")
        print(f"Target platform: {args.platform}")

        analysis = analyzer.analyze_sketch(args.image, args.platform)

        print(analyzer.get_summary(analysis))

        # Validate
        errors = analyzer.validate_analysis(analysis)
        if errors:
            print("\nValidation Errors:")
            for error in errors:
                print(f"  - {error}")

        # Export if requested
        if args.output:
            analyzer.export_analysis(analysis, args.output)
            print(f"\nAnalysis exported to: {args.output}")

    except Exception as e:
        print(f"Error analyzing sketch: {e}")
        sys.exit(1)


def _load_generation_source(json_path: str, platform: str) -> dict:
    """Load JSON for ProgramService.generate() — IR, sketch analysis, or legacy tags+rungs."""
    import json

    with open(json_path, encoding="utf-8") as handle:
        data = json.load(handle)

    if isinstance(data, dict) and "pous" in data and "vars" in data:
        return {"type": "ir", "program": data}

    if isinstance(data, dict) and "tags_detected" in data:
        return {"type": "sketch_analysis", "analysis": data}

    if isinstance(data, dict) and "tags" in data and "rungs" in data:
        tags_detected = []
        for tag in data["tags"]:
            tag_type = tag.get("kind") or tag.get("tag_type")
            if not tag_type or tag_type == "BOOL":
                address = tag.get("address", "")
                if "%I" in address:
                    tag_type = "INPUT"
                elif "%Q" in address:
                    tag_type = "OUTPUT"
                else:
                    tag_type = "MEMORY"
            tags_detected.append(
                {
                    "name": tag["name"],
                    "address": tag["address"],
                    "type": tag_type,
                    "data_type": tag.get("data_type", tag.get("type", "BOOL")),
                    "comment": tag.get("comment", ""),
                }
            )
        analysis = {
            "rungs": data["rungs"],
            "tags_detected": tags_detected,
            "target_platform": platform,
        }
        return {"type": "sketch_analysis", "analysis": analysis}

    raise ValueError(
        "JSON must be PlcProgram IR (vars+pous), sketch analysis (tags_detected+rungs), "
        "or legacy generator format (tags+rungs)"
    )


def generate_file(args):
    """Generate a PLC file from sketch or JSON via IR pipeline."""

    try:
        if args.platform not in ("schneider", "rockwell", "siemens", "mitsubishi"):
            print(
                "Error: sketch generation supports schneider, rockwell, siemens, and mitsubishi "
                f"(got {args.platform})"
            )
            sys.exit(1)

        default_controllers = {
            "schneider": "TM221CE24R",
            "rockwell": "1769-L33ER",
            "siemens": "S7-1200",
            "mitsubishi": "FX5U",
        }
        controller = args.controller or default_controllers[args.platform]

        if args.from_sketch:
            if not os.getenv("ANTHROPIC_API_KEY"):
                print("Error: ANTHROPIC_API_KEY environment variable not set")
                sys.exit(1)

            analyzer = SketchAnalyzer()
            analysis = analyzer.analyze_sketch(args.from_sketch, args.platform)
            errors = analyzer.validate_analysis(analysis)
            if errors:
                print("\nValidation Errors:")
                for error in errors:
                    print(f"  - {error}")
                sys.exit(1)

            from api.services.program_service import ProgramService

            result = ProgramService().generate(
                {
                    "platform": args.platform,
                    "projectName": args.name,
                    "controller": controller,
                    "source": {"type": "sketch_analysis", "analysis": analysis},
                }
            )
            import base64

            content = base64.standard_b64decode(result["contentBase64"])
            Path(args.output).write_bytes(content)
            print(f"Generated via IR pipeline: {args.output}")
            if "ir" in result.get("metadata", {}):
                print("IR metadata attached (use FastAPI job result for full JSON export).")
            return

        if args.from_json:
            from api.services.program_service import ProgramService

            source = _load_generation_source(args.from_json, args.platform)
            result = ProgramService().generate(
                {
                    "platform": args.platform,
                    "projectName": args.name,
                    "controller": controller,
                    "source": source,
                }
            )
            import base64

            content = base64.standard_b64decode(result["contentBase64"])
            Path(args.output).write_bytes(content)
            print(f"Generated via IR pipeline: {args.output}")
            if "ir" in result.get("metadata", {}):
                print("IR metadata attached (use FastAPI job result for full JSON export).")
            return

        print("Error: Specify --from-sketch or --from-json")
        sys.exit(1)

    except Exception as e:
        print(f"Error generating file: {e}")
        sys.exit(1)


def convert_file(args):
    """Convert between PLC platforms."""

    try:
        # Parse source file
        format_info = detect_plc_format(args.input)
        source_platform = format_info.platform

        print(f"\nConverting from {source_platform} to {args.target}")

        # Parse source
        if source_platform == 'schneider':
            parser = SchneiderParser(args.input)
        elif source_platform == 'rockwell':
            parser = RockwellParser(args.input)
        else:
            print(f"Source platform {source_platform} not supported for conversion")
            sys.exit(1)

        project = parser.parse()

        # Convert
        converter = PlatformConverter(source_platform, args.target)
        converted = converter.convert_project(project)

        # Show conversion notes
        notes = converter.get_conversion_notes()
        if notes:
            print("\nConversion Notes:")
            for note in notes:
                print(f"  - {note}")

        # Generate target file
        if args.target == 'schneider':
            gen = SchneiderGenerator()
            gen.from_json_dict(converted)  # Would need to implement
            gen.generate(args.output)

        elif args.target == 'rockwell':
            gen = RockwellGenerator()
            # Would need implementation
            print("Rockwell target generation in progress...")

        print(f"\nConversion complete: {args.output}")

    except Exception as e:
        print(f"Error converting file: {e}")
        sys.exit(1)


def list_formats(args):
    """List supported file formats."""

    from plc_file_handler.utils import get_supported_formats

    formats = get_supported_formats()

    print("\nSupported PLC File Formats:")
    print("=" * 60)

    for platform, extensions in formats.items():
        print(f"\n{platform.upper()}:")
        for ext in extensions:
            print(f"  - {ext}")

    print("\nNote: Some formats have limited support (read-only or basic)")


def main():
    """Main CLI entry point."""

    parser = argparse.ArgumentParser(
        description='PLC File Handler - Multi-platform PLC file operations',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Parse a .smbp file
  python cli.py parse Motor_Control.smbp

  # Analyze a sketch
  python cli.py analyze motor_sketch.jpg --platform schneider

  # Generate .smbp from sketch
  python cli.py generate --platform schneider --name "Motor_Control" \\
      --from-sketch motor_sketch.jpg --output Motor_Control.smbp

  # Convert between platforms
  python cli.py convert Motor_Control.smbp --target rockwell \\
      --output Motor_Control.L5X

  # List supported formats
  python cli.py formats
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to execute')

    # Parse command
    parse_parser = subparsers.add_parser('parse', help='Parse a PLC file')
    parse_parser.add_argument('file', help='PLC file to parse')
    parse_parser.add_argument('-o', '--output', help='Export to JSON file')
    parse_parser.set_defaults(func=parse_file)

    # Analyze command
    analyze_parser = subparsers.add_parser('analyze', help='Analyze a ladder logic sketch')
    analyze_parser.add_argument('image', help='Image file of sketch')
    analyze_parser.add_argument('--platform', default='schneider',
                               choices=['schneider', 'rockwell', 'siemens', 'mitsubishi'],
                               help='Target PLC platform')
    analyze_parser.add_argument('-o', '--output', help='Export analysis to JSON')
    analyze_parser.set_defaults(func=analyze_sketch)

    # Generate command
    generate_parser = subparsers.add_parser('generate', help='Generate a PLC file')
    generate_parser.add_argument('--platform', required=True,
                                choices=['schneider', 'rockwell', 'siemens', 'mitsubishi'],
                                help='Target platform')
    generate_parser.add_argument('--name', required=True, help='Project name')
    generate_parser.add_argument('--controller', help='Controller model')
    generate_parser.add_argument('--from-sketch', help='Generate from sketch image')
    generate_parser.add_argument('--from-json', help='Generate from JSON (IR, sketch analysis, or legacy tags+rungs)')
    generate_parser.add_argument('-o', '--output', required=True, help='Output file')
    generate_parser.set_defaults(func=generate_file)

    # Convert command
    convert_parser = subparsers.add_parser('convert', help='Convert between platforms')
    convert_parser.add_argument('input', help='Input PLC file')
    convert_parser.add_argument('--target', required=True,
                               choices=['schneider', 'rockwell', 'siemens'],
                               help='Target platform')
    convert_parser.add_argument('-o', '--output', required=True, help='Output file')
    convert_parser.set_defaults(func=convert_file)

    # Formats command
    formats_parser = subparsers.add_parser('formats', help='List supported formats')
    formats_parser.set_defaults(func=list_formats)

    # Parse arguments
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Execute command
    args.func(args)


if __name__ == '__main__':
    main()

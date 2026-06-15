from plc_file_handler.converters.sketch_analyzer import SketchAnalyzer

from .program_service import ProgramService, SKETCH_EXPORT_PLATFORMS


class SketchService:
    def analyze(self, image_path: str, platform: str) -> dict:
        analyzer = SketchAnalyzer()
        analysis = analyzer.analyze_sketch(image_path, platform)
        errors = analyzer.validate_analysis(analysis)
        return {
            "analysis": analysis,
            "summary": analyzer.get_summary(analysis),
            "confidence": analysis.get("confidence", 0),
            "validationErrors": errors,
            "platform": platform,
        }

    def generate_from_sketch(
        self,
        image_path: str,
        project_name: str,
        controller: str,
        platform: str = "schneider",
    ) -> dict:
        analyzer = SketchAnalyzer()
        analysis = analyzer.analyze_sketch(image_path, platform)
        errors = analyzer.validate_analysis(analysis)
        if errors:
            raise ValueError("; ".join(errors))

        if platform not in SKETCH_EXPORT_PLATFORMS:
            raise ValueError(
                f"Unsupported sketch generation platform: {platform}; "
                f"supported: {', '.join(sorted(SKETCH_EXPORT_PLATFORMS))}"
            )

        return ProgramService().generate(
            {
                "platform": platform,
                "projectName": project_name,
                "controller": controller,
                "source": {"type": "sketch_analysis", "analysis": analysis},
            }
        )

    def generate_schneider_from_sketch(
        self,
        image_path: str,
        project_name: str,
        controller: str,
    ) -> dict:
        return self.generate_from_sketch(
            image_path,
            project_name=project_name,
            controller=controller,
            platform="schneider",
        )

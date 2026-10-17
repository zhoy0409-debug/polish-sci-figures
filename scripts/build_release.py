#!/usr/bin/env python3
"""Build the complete CLI plus three-Skill suite for release review."""

from __future__ import annotations

import argparse
from pathlib import Path
import re
from urllib.parse import quote, unquote
import zipfile


ROOT = Path(__file__).resolve().parents[1]
VERSION = "v1.4.21"
SKILL_NAMES = ("make-sci-data-figures", "standardize-sci-images", "polish-sci-figures")
EXCLUDED_PARTS = {"examples", "__pycache__"}
EXCLUDED_FILES = {"make_example_data.py"}
ROOT_FILES = ("sci_figures.py", "requirements.txt", "requirements-optional.txt", "README.md", "CHANGELOG.md", "LICENSE", "CITATION.cff")
SUPPORT_FILES = (
    'docs/release-notes-v1.4.21.md',
    'docs/figure-studio-appearance.md',
    'docs/update-scene-design.md',
    'docs/qa/carbon-atelier/design-tokens.md',
    'docs/qa/carbon-atelier/browser-validation.md',
    'docs/qa/carbon-atelier/theme-component-checks.json',
    'docs/qa/carbon-atelier/theme-layout-checks.json',
    'docs/qa/carbon-atelier/token-protection-checks.json',
    'docs/qa/carbon-atelier/token-audit-current.json',
    'docs/qa/carbon-atelier/update-scene-controlled.json',
    'docs/qa/carbon-atelier/regression-summary.json',
    'docs/qa/carbon-atelier/update-scene-controlled-rest-main.png',
    'docs/qa/carbon-atelier/update-scene-controlled-download-52.png',
    'docs/qa/carbon-atelier/update-scene-controlled-download-100.png',
    'docs/qa/carbon-atelier/update-scene-controlled-verified-ready.png',
    'docs/qa/carbon-atelier/update-scene-controlled-reduced-motion-live-progress.png',
    'docs/qa/carbon-atelier/update-scene-controlled-narrow-emulated-dpr-150.png',
    'scripts/build_update_mascot_scene.py',
    'docs/figure-studio-image-tools.md',
    'docs/figure-studio-axes-round2.md',
    'docs/figure-studio-experience-round2-validation.md',
    'docs/scientific-image-evaluation-round2.md',
    'docs/qa/round2/public-image-engineering-results.json',
    'docs/qa/round2/private-image-engineering-summary.json',
    'docs/qa/round2/private-raster-api-summary.json',
    'docs/qa/round2/image-screening-performance.json',
    'docs/qa/round2/source-regressions.json',
    'docs/qa/round2/windows-installer.json',
    'docs/qa/round2/windows-axes.json',
    'docs/qa/round2/windows-discovery.json',
    'docs/qa/round2/windows-catalogue.json',
    'docs/qa/round2/windows-raster-export.json',
    'docs/qa/round2/windows-private-raster-api-summary.json',
    'docs/qa/round2/windows-background-screening-60.json',
    'docs/qa/round2/windows-image-tools-1280x720.json',
    'docs/qa/round2/windows-image-tools-1920x1080.json',
    'docs/qa/round2/windows-image-tools-1280x720-border-editor.png',
    'docs/qa/round2/windows-image-tools-1280x720-color-histogram.png',
    'docs/qa/round2/windows-image-tools-1920x1080-overview-roi.png',
    'docs/qa/round2/windows-image-tools-1920x1080-image-check.png',
    'docs/qa/round2/windows-synthetic-background-editing.png',
    'scripts/fixtures/real-image-sources.json',
    'scripts/prepare_real_image_regression.py',
    'scripts/evaluate_scientific_images.py',
    'scripts/benchmark_image_screening.py',
    'scripts/audit_private_image_corpus.py',
    'scripts/test_private_raster_api.py',
    'scripts/prepare_axis_real_data_qa.py',
    'scripts/build_duplicate_browser_batch.py',
    'scripts/prepare_reference_color_acceptance.py',
    'docs/qa/round2/windows-reference-color.json',
    'docs/qa/round2/windows-upgrade-0.1.19-to-0.1.20.json',
    'docs/qa/round2/image-tools-1280x720.json',
    'docs/qa/round2/image-tools-1920x1080.json',
    'docs/qa/round2/object-borders-browser.json',
    'docs/qa/round2/image-tools-1280x720-border-editor.png',
    'docs/qa/round2/image-tools-1280x720-color-display.png',
    'docs/qa/round2/image-tools-1280x720-color-histogram.png',
    'docs/qa/round2/image-tools-1280x720-image-check.png',
    'docs/qa/round2/image-tools-1280x720-overview-roi.png',
    'docs/qa/round2/image-tools-1920x1080-border-editor.png',
    'docs/qa/round2/image-tools-1920x1080-color-display.png',
    'docs/qa/round2/image-tools-1920x1080-color-histogram.png',
    'docs/qa/round2/image-tools-1920x1080-image-check.png',
    'docs/qa/round2/image-tools-1920x1080-overview-roi.png',
    'scripts/discover_figures.cjs',
    'docs/qa/figure-discovery/windows-independent-en.png',
    'docs/qa/figure-discovery/windows-paired-zh.png',
    'docs/qa/figure-discovery/windows-result.json',
    'docs/figure-discovery.md',
    'docs/figure-discovery-validation.md',
    'docs/qa/figure-discovery/independent-en.png',
    'docs/qa/figure-discovery/paired-zh.png',
    'docs/qa/figure-discovery/offline-editor.png',
    'docs/qa/figure-discovery/result.json',
    'docs/qa/figure-discovery/live-literature.json',
    "docs/release-notes-v1.4.20.md",
    "docs/release-notes-v1.4.19.md",
    "docs/release-notes-v1.4.18.md",
    "docs/release-notes-v1.4.17.md",
    "docs/release-notes-v1.4.16.md",
    "docs/release-notes-v1.4.15.md",
    "docs/release-notes-v1.4.14.md",
    "docs/release-notes-v1.4.13.md",
    "docs/release-notes-v1.4.12.md",
    "docs/release-notes-v1.4.11.md",
    "docs/release-notes-v1.4.10.md",
    "docs/release-notes-v1.4.9.md",
    "docs/release-notes-v1.4.8.md",
    "docs/release-notes-v1.4.7.md",
    "docs/release-v1.4.6.md",
    "docs/local-device-trial.md",
    "docs/image-duplicate-check.md",
    "docs/image-duplicate-validation.md",
    "docs/release-v1.4.5.md",
    "docs/release-v1.4.4.md",
    "README.en.md",
    "README.zh-CN.md",
    "docs/figure-studio-validation.md",
    "docs/figure-studio-deletion-and-contour-qa.md",
    "docs/platform-installation.md",
    "docs/platform-installation.en.md",
    "docs/release-v1.4.0.md",
    "docs/release-v1.4.0.en.md",
    "docs/release-v1.4.1.md",
    "docs/release-v1.4.1.en.md",
    "docs/release-v1.4.2.md",
    "docs/release-v1.4.2.en.md",
    "docs/release-v1.4.3.md",
    "docs/release-v1.4.3.en.md",
    "docs/editor-tour.en.md",
    "docs/editor-tour.zh-CN.md",
    "docs/media/figure-studio-overview.png",
    "docs/media/figure-studio-walkthrough.gif",
    "docs/media/figure-studio-walkthrough.mp4",
    "docs/media/figure-studio-start.png",
    "docs/media/figure-studio-template.png",
    "docs/media/figure-studio-data.png",
    "docs/media/figure-studio-refine.png",
    "docs/media/figure-studio-export.png",
    "docs/media/figure-studio-walkthrough.zh-CN.mp4",
    "docs/media/figure-studio-walkthrough.zh-CN.gif",
    "docs/media/figure-studio-start.zh-CN.png",
    "docs/media/figure-studio-template.zh-CN.png",
    "docs/media/figure-studio-data.zh-CN.png",
    "docs/media/figure-studio-refine.zh-CN.png",
    "docs/media/figure-studio-export.zh-CN.png",
    "docs/media/demo-observations.csv",
    "docs/windows-resource-benchmark.md",
    "docs/windows-resource-benchmark.en.md",
    "desktop/QUICKSTART.zh-CN.md",
    "desktop/QUICKSTART.en.md",
    "desktop/BUILD.md",
    "demo/composite_showcase/Figure_1_Bioinformatics.png",
    "demo/composite_showcase/Figure_2_Basic_research.png",
    "demo/composite_showcase/Figure_3_Sequencing.png",
    "demo/image_standardization/montage.png",
)


def include_file(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    if any(part in EXCLUDED_PARTS for part in relative.parts):
        return False
    if path.name.startswith("test_") and path.suffix == ".py":
        return False
    if path.name in EXCLUDED_FILES:
        return False
    if path.name == "README.md" and "assets" in relative.parts:
        return False
    if path.suffix in {".pyc", ".pyo"}:
        return False
    return True


def release_files():
    for name in (*ROOT_FILES, *SUPPORT_FILES):
        yield ROOT / name
    for skill_name in SKILL_NAMES:
        for path in sorted((ROOT / "skills" / skill_name).rglob("*")):
            if path.is_file() and include_file(path):
                yield path


def archive_bytes(path: Path, included: set[str], version: str) -> bytes:
    """Keep runtime sources exact; link omitted maintainer files to this release."""
    relative = path.relative_to(ROOT).as_posix()
    if path.suffix != ".md" or not (relative == "README.md" or relative in SUPPORT_FILES):
        return path.read_bytes()
    content = path.read_text(encoding="utf-8")
    def resolve_link(match):
        target = match.group(1)
        if target.startswith(("#", "/", "http:", "https:", "mailto:")):
            return match.group(0)
        address, _, anchor = target.partition("#")
        local = (path.parent / unquote(address)).resolve()
        if not local.is_relative_to(ROOT.resolve()):
            raise ValueError(f"Documentation link escapes release: {relative}: {target}")
        name = local.relative_to(ROOT.resolve()).as_posix()
        if name in included:
            return match.group(0)
        url = f"https://github.com/zhoy0409-debug/polish-sci-figures/blob/{quote(version)}/{quote(name)}"
        return "](" + url + ("#" + anchor if anchor else "") + ")"
    return re.sub(r"\]\(([^)\s]+)\)", resolve_link, content).encode("utf-8")


def build(version: str, outdir: Path) -> Path:
    outdir.mkdir(parents=True, exist_ok=True)
    archive = outdir / f"sci-figure-suite-{version}.zip"
    files = list(release_files())
    included = {path.relative_to(ROOT).as_posix() for path in files}
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as handle:
        for path in files:
            handle.writestr(path.relative_to(ROOT).as_posix(), archive_bytes(path, included, version))
    return archive


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default=VERSION)
    parser.add_argument("--outdir", default="dist")
    args = parser.parse_args()
    archive = build(args.version, Path(args.outdir))
    print(archive)


if __name__ == "__main__":
    main()

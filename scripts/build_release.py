#!/usr/bin/env python3
"""Build the complete CLI plus three-Skill suite for release review."""

from __future__ import annotations

import argparse
from pathlib import Path
import re
from urllib.parse import quote, unquote
import zipfile


ROOT = Path(__file__).resolve().parents[1]
SKILL_NAMES = ("make-sci-data-figures", "standardize-sci-images", "polish-sci-figures")
EXCLUDED_PARTS = {"examples", "__pycache__"}
EXCLUDED_FILES = {"make_example_data.py"}
ROOT_FILES = ("sci_figures.py", "requirements.txt", "requirements-optional.txt", "README.md", "CHANGELOG.md", "LICENSE", "CITATION.cff")
SUPPORT_FILES = (
    "docs/image-duplicate-check.md",
    "docs/image-duplicate-validation.md",
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
    parser.add_argument("--version", default="v1.4.4")
    parser.add_argument("--outdir", default="dist")
    args = parser.parse_args()
    archive = build(args.version, Path(args.outdir))
    print(archive)


if __name__ == "__main__":
    main()

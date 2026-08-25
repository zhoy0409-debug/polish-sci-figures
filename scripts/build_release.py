#!/usr/bin/env python3
"""Build a compact installable skill bundle for release review."""

from __future__ import annotations

import argparse
from pathlib import Path
import zipfile


ROOT = Path(__file__).resolve().parents[1]
SKILL_NAMES = ("make-sci-data-figures", "standardize-sci-images", "polish-sci-figures")
EXCLUDED_PARTS = {"examples", "__pycache__"}
EXCLUDED_FILES = {"make_example_data.py"}


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


def build(version: str, outdir: Path) -> Path:
    outdir.mkdir(parents=True, exist_ok=True)
    archive = outdir / f"sci-figure-skills-{version}.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as handle:
        for skill_name in SKILL_NAMES:
            skill_root = ROOT / "skills" / skill_name
            for path in sorted(skill_root.rglob("*")):
                if path.is_file() and include_file(path):
                    handle.write(path, path.relative_to(ROOT))
    return archive


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="v1.3.1")
    parser.add_argument("--outdir", default="dist")
    args = parser.parse_args()
    archive = build(args.version, Path(args.outdir))
    print(archive)


if __name__ == "__main__":
    main()

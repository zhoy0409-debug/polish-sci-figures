#!/usr/bin/env python3
"""Build one uploadable skill containing the complete figure-suite runtime."""
from __future__ import annotations

import argparse
from pathlib import Path, PurePosixPath
import re
import zipfile

from build_release import ROOT, archive_bytes, release_files

SKILL_NAME = "polish-sci-figures"
VERSION = "v1.4.0"
ENTRYPOINT = ROOT / "adapters/portable-skill/SKILL.md"


def suite_files():
    yield from release_files()


def build(version: str = VERSION, outdir: Path = ROOT / "dist") -> Path:
    if not re.fullmatch(r"v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?", version):
        raise ValueError("Use a version such as v1.4.0")
    files = list(suite_files())
    included = {path.relative_to(ROOT).as_posix() for path in files}
    for path in [ENTRYPOINT, *files]:
        if not path.is_file() or not path.resolve().is_relative_to(ROOT.resolve()):
            raise ValueError(f"Missing or external package resource: {path}")
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    archive = outdir / f"{SKILL_NAME}-{version}-skill.zip"
    prefix = PurePosixPath(SKILL_NAME)
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as handle:
        handle.write(ENTRYPOINT, str(prefix / "SKILL.md"))
        for path in files:
            relative = path.relative_to(ROOT).as_posix()
            handle.writestr(str(prefix / "suite" / relative), archive_bytes(path, included, version))
    return archive


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default=VERSION)
    parser.add_argument("--outdir", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    print(build(args.version, args.outdir))


if __name__ == "__main__":
    main()

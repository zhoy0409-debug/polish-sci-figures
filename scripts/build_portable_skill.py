#!/usr/bin/env python3
"""Build one uploadable skill containing the complete figure-suite runtime."""
from __future__ import annotations

import argparse
from pathlib import Path, PurePosixPath
import re
from urllib.parse import unquote
import zipfile

from build_release import ROOT, VERSION, archive_bytes, release_files

SKILL_NAME = "polish-sci-figures"
ENTRYPOINT = ROOT / "adapters/portable-skill/SKILL.md"


def suite_files():
    yield from release_files()


def portable_name(relative: str) -> str:
    """Host upload validators count SKILL.md recursively, not only at the root."""
    path = PurePosixPath(relative)
    return str(path.with_name("WORKFLOW.md")) if path.name == "SKILL.md" else relative


def portable_bytes(path: Path, included: set[str], version: str) -> bytes:
    content = archive_bytes(path, included, version)
    if path.suffix != ".md":
        return content
    text = content.decode("utf-8")

    def workflow_link(match):
        target = match.group(1)
        if target.startswith(("#", "/", "http:", "https:", "mailto:")):
            return match.group(0)
        address, separator, anchor = target.partition("#")
        local = (path.parent / unquote(address)).resolve()
        if local.is_relative_to(ROOT.resolve()):
            relative = local.relative_to(ROOT.resolve()).as_posix()
            if relative in included and local.name == "SKILL.md":
                return "](" + str(PurePosixPath(address).with_name("WORKFLOW.md")) + (separator + anchor) + ")"
        return match.group(0)

    text = re.sub(r"\]\(([^)\s]+)\)", workflow_link, text)
    # Within the bundled workflows, this name refers to their own local guide.
    if path.is_relative_to(ROOT / "skills"):
        text = text.replace("`SKILL.md`", "`WORKFLOW.md`")
    return text.encode("utf-8")


def build(version: str = VERSION, outdir: Path = ROOT / "dist") -> Path:
    if not re.fullmatch(r"v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?", version):
        raise ValueError("Use a version such as v1.4.6")
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
            handle.writestr(str(prefix / "suite" / portable_name(relative)), portable_bytes(path, included, version))
        if sum(PurePosixPath(name).name.casefold() == "skill.md" for name in handle.namelist()) != 1:
            raise ValueError("A portable upload must contain exactly one SKILL.md in the whole ZIP")
    return archive


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default=VERSION)
    parser.add_argument("--outdir", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    print(build(args.version, args.outdir))


if __name__ == "__main__":
    main()

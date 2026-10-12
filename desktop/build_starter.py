#!/usr/bin/env python3
"""Build the small empty project used on first desktop launch.

The editor and its editable template catalogue are embedded normally.  The
project itself contains no sample observations, inferential results, or artwork.
"""
from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills" / "polish-sci-figures" / "scripts"))
from figure_studio import inspect_svg_bytes, write_html


def starter_project() -> dict:
    raw = b'<svg xmlns="http://www.w3.org/2000/svg" width="345.6pt" height="259.2pt" viewBox="0 0 345.6 259.2"><rect width="345.6" height="259.2" fill="#ffffff"/></svg>'
    variant = inspect_svg_bytes(raw, "blank_canvas")
    variant.update(size="original", preserveAspect=True)
    return {
        "schema": "figure-studio/1",
        "id": hashlib.sha256(b"figure-studio-desktop-blank-v1").hexdigest()[:20],
        "title": "新建组图",
        "title_i18n": {"zh-CN": "新建组图", "en": "Untitled figure"},
        "desktopStarter": True,
        "panels": [{"id": "panel-0", "name": "blank_canvas",
                    "name_i18n": {"zh-CN": "空白画布", "en": "Blank canvas"},
                    "provenance": "blank-canvas", "recipe": {}, "analysis": {},
                    "table": None, "variants": [variant], "initialVariant": 0}],
        "initialState": {"order": ["panel-0"], "columns": 1, "gap": 12,
                         "panels": {"panel-0": {"variant": 0, "edits": {}}}},
    }


def build(output: Path) -> Path:
    """Atomically update the bundled resource, never any user's workspace."""
    output = output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".building")
    if temporary.exists():
        temporary.unlink()
    write_html(starter_project(), temporary)
    html = temporary.read_text(encoding="utf-8").replace("<body>", '<body data-desktop-starter="true">', 1)
    temporary.write_text(html, encoding="utf-8")
    temporary.replace(output)
    return output


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "desktop" / "resources" / "starter.html")
    args = parser.parse_args()
    print(build(args.out))


if __name__ == "__main__":
    main()

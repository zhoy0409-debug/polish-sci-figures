"""Report whether an SVG is genuinely editable or just a raster wrapped in XML.

The skill forbids claiming a figure is "fully editable" when it is really a PNG
embedded inside an <svg>. This script gives an objective verdict instead of a
guess: it counts live <text> elements vs embedded raster <image> elements and
whether text was flattened to <path> outlines.

Usage
-----
    python check_svg_editability.py final_figures/Fig1.svg

Exit code is 0 for FULLY / PARTIALLY editable, 2 for RASTER-ONLY, so it can
gate a delivery step in a shell pipeline.

Requires: standard library only.
"""
from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET


def analyze(path: str) -> dict:
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        raw = fh.read()

    # strip namespaces for simple tag counting
    local = re.sub(r"<(/?)(?:[A-Za-z0-9_.-]+:)?", r"<\1", raw)
    try:
        root = ET.fromstring(local)
    except ET.ParseError as e:
        return {"parse_ok": False, "error": str(e)}

    tags: dict[str, int] = {}
    embedded_raster = 0
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        tags[tag] = tags.get(tag, 0) + 1
        if tag == "image":
            href = el.get("href") or el.get("{http://www.w3.org/1999/xlink}href", "")
            href = href or ""
            if href.startswith("data:image") or re.search(r"\.(png|jpe?g|tif)", href, re.I):
                embedded_raster += 1
    # crude data-URI count in raw (covers xlink attr the parser dropped)
    embedded_raster = max(embedded_raster, len(re.findall(r"data:image/", raw)))

    n_text = tags.get("text", 0) + tags.get("tspan", 0)
    n_path = tags.get("path", 0)
    return {
        "parse_ok": True,
        "text_elements": n_text,
        "path_elements": n_path,
        "embedded_raster": embedded_raster,
        "tags": tags,
    }


def verdict(info: dict) -> tuple[str, str]:
    if not info.get("parse_ok"):
        return "INVALID", f"SVG does not parse: {info.get('error')}"
    t, r = info["text_elements"], info["embedded_raster"]
    if r and t == 0:
        return "RASTER-ONLY", (
            f"{r} embedded raster image(s), 0 live <text> elements. "
            "Do NOT describe this as editable -- the pixels are baked in."
        )
    if r and t:
        return "PARTIALLY", (
            f"{t} live <text> element(s) over {r} embedded raster image(s). "
            "New annotation is editable; the underlying image is not."
        )
    if t == 0 and info["path_elements"]:
        return "OUTLINED", (
            "no <text> elements but many <path>s -- text was likely flattened to "
            "outlines. Re-export with svg.fonttype='none' to keep text editable."
        )
    return "FULLY", f"{t} live <text> element(s), no embedded raster."


def main(argv=None):
    argv = argv or sys.argv[1:]
    if not argv:
        sys.exit("usage: python check_svg_editability.py FILE.svg [FILE2.svg ...]")
    worst = 0
    for path in argv:
        info = analyze(path)
        v, msg = verdict(info)
        print(f"[{v}] {path}\n    {msg}")
        if v in ("RASTER-ONLY", "INVALID"):
            worst = 2
    sys.exit(worst)


if __name__ == "__main__":
    main()

"""Report whether SVG artwork is practically editable.

The audit detects embedded raster images, outlined text, and sentences split
into one-character <tspan> fragments. Use ``--require-fully-editable`` as a
delivery gate when the user needs a genuinely editable SVG.

Usage
-----
    python check_svg_editability.py --require-fully-editable Fig1.svg
    python check_svg_editability.py --self-test

Requires: standard library only.
"""
from __future__ import annotations

import argparse
import re
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path


def _local_name(tag: str) -> str:
    return tag.split("}")[-1]


def analyze(path: str | Path) -> dict:
    try:
        raw = Path(path).read_text(encoding="utf-8", errors="replace")
        root = ET.fromstring(raw)
    except (OSError, ET.ParseError) as exc:
        return {"parse_ok": False, "error": str(exc)}

    tags: dict[str, int] = {}
    embedded_raster = 0
    fragmented_text = 0
    fragmented_examples: list[str] = []

    for element in root.iter():
        tag = _local_name(element.tag)
        tags[tag] = tags.get(tag, 0) + 1
        if tag == "image":
            href = element.get("href") or element.get("{http://www.w3.org/1999/xlink}href", "")
            if href.startswith("data:image") or re.search(r"\.(png|jpe?g|tiff?)(?:$|[?#])", href, re.I):
                embedded_raster += 1
        if tag == "text":
            spans = [child for child in element.iter() if _local_name(child.tag) == "tspan"]
            pieces = ["".join(span.itertext()).strip() for span in spans]
            pieces = [piece for piece in pieces if piece]
            if len(pieces) >= 4 and sum(map(len, pieces)) / len(pieces) <= 2.0:
                fragmented_text += 1
                if len(fragmented_examples) < 3:
                    fragmented_examples.append("".join(pieces)[:60])

    embedded_raster = max(embedded_raster, len(re.findall(r"data:image/", raw)))
    return {
        "parse_ok": True,
        "text_elements": tags.get("text", 0),
        "tspan_elements": tags.get("tspan", 0),
        "path_elements": tags.get("path", 0),
        "embedded_raster": embedded_raster,
        "fragmented_text": fragmented_text,
        "fragmented_examples": fragmented_examples,
        "tags": tags,
    }


def verdict(info: dict) -> tuple[str, str]:
    if not info.get("parse_ok"):
        return "INVALID", f"SVG does not parse: {info.get('error')}"
    text = info["text_elements"]
    raster = info["embedded_raster"]
    fragmented = info["fragmented_text"]
    if fragmented:
        examples = ", ".join(repr(item) for item in info["fragmented_examples"])
        return "FRAGMENTED-TEXT", (
            f"{fragmented} text object(s) are split into tiny <tspan> pieces"
            + (f" ({examples})" if examples else "")
            + ". Re-export complete phrases as continuous live text."
        )
    if raster and text == 0:
        return "RASTER-ONLY", (
            f"{raster} embedded raster image(s), 0 live <text> elements. "
            "Do not describe this as editable."
        )
    if raster and text:
        return "PARTIALLY", (
            f"{text} live <text> element(s) over {raster} embedded raster image(s). "
            "Annotations are editable; the raster content is not."
        )
    if text == 0 and info["path_elements"]:
        return "OUTLINED", (
            "No <text> elements but paths are present; text was likely outlined. "
            "Re-export with svg.fonttype='none'."
        )
    return "FULLY", (
        f"{text} live <text> element(s), {info['tspan_elements']} <tspan> element(s), "
        "no embedded raster or fragmented text."
    )


def self_test() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        clean = root / "clean.svg"
        split = root / "split.svg"
        clean.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg"><text>Complete phrase</text></svg>',
            encoding="utf-8",
        )
        split.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg"><text>'
            '<tspan>E</tspan><tspan>d</tspan><tspan>i</tspan><tspan>t</tspan>'
            '<tspan>a</tspan><tspan>b</tspan><tspan>l</tspan><tspan>e</tspan>'
            '</text></svg>',
            encoding="utf-8",
        )
        assert verdict(analyze(clean))[0] == "FULLY"
        assert verdict(analyze(split))[0] == "FRAGMENTED-TEXT"
    print("self-test: continuous text passed; per-character text blocked")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*")
    parser.add_argument("--require-fully-editable", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        self_test()
        return 0
    if not args.paths:
        parser.error("provide one or more SVG files, or use --self-test")

    failed = False
    for path in args.paths:
        info = analyze(path)
        label, message = verdict(info)
        print(f"[{label}] {path}\n    {message}")
        if label in {"INVALID", "RASTER-ONLY", "FRAGMENTED-TEXT"}:
            failed = True
        if args.require_fully_editable and label != "FULLY":
            failed = True
    return 2 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

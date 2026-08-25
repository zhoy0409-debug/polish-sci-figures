"""Basic accessibility and delivery QA for scientific figures.

This checker intentionally separates automatic findings from human-review
items. It can verify SVG external resources, embedded-raster effective DPI,
basic color contrast, and grayscale separation; it cannot prove that a figure
does not rely on color alone for meaning.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import math
import re
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image


LENGTH_RE = re.compile(r"^\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s*([A-Za-z]*)\s*$")
UNIT_TO_MM = {
    "": 25.4 / 96.0,
    "px": 25.4 / 96.0,
    "pt": 25.4 / 72.0,
    "in": 25.4,
    "cm": 10.0,
    "mm": 1.0,
}
HEX_COLOR = re.compile(r"#[0-9A-Fa-f]{6}\b")


def _local(tag: str) -> str:
    return tag.split("}")[-1]


def _length_mm(value: str | None) -> float | None:
    if not value:
        return None
    match = LENGTH_RE.match(value)
    if not match:
        return None
    number, unit = match.groups()
    return float(number) * UNIT_TO_MM.get(unit.lower(), 25.4 / 96.0)


def _viewbox(root: ET.Element) -> tuple[float, float] | None:
    values = [float(x) for x in re.split(r"[\s,]+", root.get("viewBox", "").strip()) if x]
    if len(values) != 4 or values[2] <= 0 or values[3] <= 0:
        return None
    return values[2], values[3]


def _rgb(hex_color: str) -> tuple[float, float, float]:
    value = hex_color.lstrip("#")
    return tuple(int(value[index:index + 2], 16) / 255 for index in (0, 2, 4))


def _linear(channel: float) -> float:
    if channel <= 0.03928:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    r, g, b = (_linear(channel) for channel in _rgb(hex_color))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    first, second = sorted((luminance(a), luminance(b)), reverse=True)
    return (first + 0.05) / (second + 0.05)


def _embedded_image_size(href: str) -> tuple[int, int] | None:
    if not href.startswith("data:image/"):
        return None
    try:
        _, encoded = href.split(",", 1)
        with Image.open(io.BytesIO(base64.b64decode(encoded))) as image:
            return image.size
    except Exception:
        return None


def audit_svg(path: str | Path, min_dpi: float = 300.0) -> dict:
    path = Path(path)
    raw = path.read_text(encoding="utf-8", errors="replace")
    root = ET.fromstring(raw)
    width_mm = _length_mm(root.get("width"))
    height_mm = _length_mm(root.get("height"))
    viewbox = _viewbox(root)
    issues: list[dict] = []
    manual_review = [
        "Confirm that key group differences are not communicated by color alone.",
        "Draft alt text from the figure legend and verified results; do not invent conclusions.",
    ]

    colors = sorted(set(HEX_COLOR.findall(raw)))
    for color in colors:
        if contrast(color, "#FFFFFF") < 3.0 and contrast(color, "#000000") < 3.0:
            issues.append({
                "severity": "WARN",
                "code": "LOW_BASIC_CONTRAST",
                "message": f"{color} has low contrast against both white and black backgrounds",
            })
    for index, first in enumerate(colors):
        for second in colors[index + 1:]:
            if abs(luminance(first) - luminance(second)) < 0.025:
                issues.append({
                    "severity": "WARN",
                    "code": "LOW_GRAYSCALE_SEPARATION",
                    "message": f"{first} and {second} may be hard to distinguish in grayscale",
                })
                break

    embedded_rasters = 0
    external_resources = 0
    raster_dpi: list[float] = []
    for element in root.iter():
        if _local(element.tag) != "image":
            continue
        href = element.get("href") or element.get("{http://www.w3.org/1999/xlink}href", "")
        if not href.startswith("data:image/"):
            external_resources += 1
            issues.append({
                "severity": "FAIL",
                "code": "SVG_EXTERNAL_RESOURCE",
                "message": "SVG references an external raster resource instead of embedding it",
            })
            continue
        embedded_rasters += 1
        if width_mm is None or viewbox is None:
            issues.append({
                "severity": "WARN",
                "code": "RASTER_DPI_UNKNOWN",
                "message": "Cannot compute embedded raster DPI without physical width and viewBox",
            })
            continue
        image_size = _embedded_image_size(href)
        if image_size is None:
            issues.append({
                "severity": "WARN",
                "code": "RASTER_DPI_UNKNOWN",
                "message": "Cannot decode embedded raster to compute effective DPI",
            })
            continue
        display_width = float(element.get("width", viewbox[0]))
        display_width_mm = width_mm * display_width / viewbox[0]
        dpi = image_size[0] / (display_width_mm / 25.4)
        raster_dpi.append(dpi)
        if dpi < min_dpi - 1e-6:
            issues.append({
                "severity": "FAIL",
                "code": "LOW_EMBEDDED_RASTER_DPI",
                "message": f"embedded raster effective DPI is {dpi:.1f}, below {min_dpi:g}",
            })

    if embedded_rasters:
        issues.append({
            "severity": "WARN",
            "code": "PARTIAL_VECTOR_EDITABILITY",
            "message": "SVG contains embedded raster layer(s); do not call it fully vector editable",
        })

    return {
        "path": str(path),
        "width_mm": width_mm,
        "height_mm": height_mm,
        "colors": colors,
        "embedded_rasters": embedded_rasters,
        "external_resources": external_resources,
        "embedded_raster_dpi": raster_dpi,
        "issues": issues,
        "manual_review": manual_review,
    }


def self_test() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        image = Image.new("RGB", (600, 400), "white")
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        clean = root / "clean.svg"
        clean.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" width="50.8mm" height="33.867mm" '
            'viewBox="0 0 600 400"><image width="600" height="400" '
            f'href="data:image/png;base64,{encoded}"/><path fill="#0072B2" d="M0 0h10v10z"/>'
            '</svg>',
            encoding="utf-8",
        )
        report = audit_svg(clean)
        assert report["embedded_rasters"] == 1
        assert min(report["embedded_raster_dpi"]) >= 300
        linked = root / "linked.svg"
        linked.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="30mm" '
            'viewBox="0 0 500 300"><image href="external.png"/></svg>',
            encoding="utf-8",
        )
        linked_report = audit_svg(linked)
        assert any(issue["code"] == "SVG_EXTERNAL_RESOURCE" for issue in linked_report["issues"])
    print("figure accessibility QA self-test passed")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", help="SVG files to audit")
    parser.add_argument("--min-dpi", type=float, default=300.0)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        self_test()
        return 0
    if not args.paths:
        parser.error("provide one or more SVG files, or use --self-test")
    reports = [audit_svg(path, args.min_dpi) for path in args.paths]
    failed = any(issue["severity"] == "FAIL" for report in reports for issue in report["issues"])
    if args.json:
        print(json.dumps({"reports": reports}, indent=2, ensure_ascii=False))
    else:
        for report in reports:
            print(f"[ACCESSIBILITY] {report['path']}")
            for issue in report["issues"]:
                print(f"  [{issue['severity']}] {issue['code']}: {issue['message']}")
            for item in report["manual_review"]:
                print(f"  [REVIEW] {item}")
    return 2 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

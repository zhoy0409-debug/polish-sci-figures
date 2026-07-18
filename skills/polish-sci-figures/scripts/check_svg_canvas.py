"""Audit physical canvas consistency across SVG files.

Use one invocation per repeated layout slot. The command fails when files have
different physical dimensions or viewBox dimensions, because later scaling to
make those canvases fit is what makes nominally equal font sizes look unequal.

Examples
--------
    python check_svg_canvas.py panels/*.svg
    python check_svg_canvas.py --width-mm 90 --height-mm 68 panels/*.svg

Requires: standard library only.
"""
from __future__ import annotations

import argparse
import glob
import math
import re
import sys
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path


LENGTH_RE = re.compile(
    r"^\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?)\s*([A-Za-z]*)\s*$"
)
UNIT_TO_MM = {
    "": 25.4 / 96.0,
    "px": 25.4 / 96.0,
    "pt": 25.4 / 72.0,
    "pc": 25.4 / 6.0,
    "in": 25.4,
    "cm": 10.0,
    "mm": 1.0,
    "q": 0.25,
}


@dataclass(frozen=True)
class Canvas:
    path: Path
    width_mm: float
    height_mm: float
    viewbox_width: float
    viewbox_height: float


def _length_mm(value: str, field: str) -> float:
    match = LENGTH_RE.match(value or "")
    if not match:
        raise ValueError(f"invalid {field}={value!r}")
    number, unit = match.groups()
    unit = unit.lower()
    if unit not in UNIT_TO_MM:
        raise ValueError(f"unsupported {field} unit {unit!r}")
    return float(number) * UNIT_TO_MM[unit]


def read_canvas(path: str | Path) -> Canvas:
    path = Path(path)
    root = ET.parse(path).getroot()
    width = _length_mm(root.get("width", ""), "width")
    height = _length_mm(root.get("height", ""), "height")
    values = [float(value) for value in re.split(r"[\s,]+", root.get("viewBox", "").strip()) if value]
    if len(values) != 4 or values[2] <= 0 or values[3] <= 0:
        raise ValueError(f"invalid viewBox={root.get('viewBox')!r}")
    return Canvas(path, width, height, values[2], values[3])


def audit(
    paths: list[str | Path],
    *,
    width_mm: float | None = None,
    height_mm: float | None = None,
    tolerance_mm: float = 0.1,
    viewbox_tolerance: float = 0.01,
) -> tuple[list[Canvas], list[str]]:
    canvases: list[Canvas] = []
    errors: list[str] = []
    for path in paths:
        try:
            canvases.append(read_canvas(path))
        except (OSError, ET.ParseError, ValueError) as exc:
            errors.append(f"{path}: {exc}")

    if not canvases:
        return canvases, errors or ["no SVG files supplied"]

    reference = canvases[0]
    target_width = reference.width_mm if width_mm is None else width_mm
    target_height = reference.height_mm if height_mm is None else height_mm
    target_vbw = reference.viewbox_width
    target_vbh = reference.viewbox_height

    for canvas in canvases:
        problems = []
        if not math.isclose(canvas.width_mm, target_width, abs_tol=tolerance_mm):
            problems.append(f"width {canvas.width_mm:.3f} mm != {target_width:.3f} mm")
        if not math.isclose(canvas.height_mm, target_height, abs_tol=tolerance_mm):
            problems.append(f"height {canvas.height_mm:.3f} mm != {target_height:.3f} mm")
        if not math.isclose(canvas.viewbox_width, target_vbw, abs_tol=viewbox_tolerance):
            problems.append(f"viewBox width {canvas.viewbox_width:g} != {target_vbw:g}")
        if not math.isclose(canvas.viewbox_height, target_vbh, abs_tol=viewbox_tolerance):
            problems.append(f"viewBox height {canvas.viewbox_height:g} != {target_vbh:g}")
        if problems:
            errors.append(f"{canvas.path}: " + "; ".join(problems))
    return canvases, errors


def self_test() -> None:
    template = '<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {vbw} {vbh}"/>'
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        first = root / "first.svg"
        second = root / "second.svg"
        bad = root / "bad.svg"
        first.write_text(template.format(w="90mm", h="68mm", vbw=255.118, vbh=192.756), encoding="utf-8")
        second.write_text(template.format(w="255.118pt", h="192.756pt", vbw=255.118, vbh=192.756), encoding="utf-8")
        bad.write_text(template.format(w="100mm", h="68mm", vbw=283.465, vbh=192.756), encoding="utf-8")
        _, clean = audit([first, second])
        assert not clean, clean
        _, mismatch = audit([first, bad])
        assert mismatch, "mismatched physical canvas was not detected"
    print("self-test: same canvas passed; mismatched canvas blocked")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", help="SVG files from one slot class")
    parser.add_argument("--width-mm", type=float, help="required physical width")
    parser.add_argument("--height-mm", type=float, help="required physical height")
    parser.add_argument("--tolerance-mm", type=float, default=0.1)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        self_test()
        return 0
    if not args.paths:
        parser.error("provide one or more SVG files, or use --self-test")

    paths: list[str] = []
    for pattern in args.paths:
        matches = glob.glob(pattern)
        paths.extend(matches or [pattern])

    canvases, errors = audit(
        paths,
        width_mm=args.width_mm,
        height_mm=args.height_mm,
        tolerance_mm=args.tolerance_mm,
    )
    for canvas in canvases:
        print(
            f"[CANVAS] {canvas.path}: {canvas.width_mm:.3f} x "
            f"{canvas.height_mm:.3f} mm; viewBox "
            f"{canvas.viewbox_width:g} x {canvas.viewbox_height:g}"
        )
    if errors:
        for error in errors:
            print(f"[MISMATCH] {error}", file=sys.stderr)
        return 2
    print(f"[PASS] {len(canvases)} SVG canvas(es) are consistent")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

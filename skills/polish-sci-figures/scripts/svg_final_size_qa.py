#!/usr/bin/env python3
"""Audit an SVG at its final physical size.

Resolves viewBox scaling, nested SVG viewports, transforms, inherited styles,
simple CSS selectors and <use> before measuring, then reports:

* effective text size and line width in points;
* text outside the canvas and text/text overlap (estimated boxes, for review);
* baseline scientific notation such as ``IC50``, ``cm^2`` or ``1e-05``;
* mixed font families;
* categorical colours that merge under colour-vision deficiency or grayscale.

Estimates are review aids. A clean report does not certify a figure.

    python svg_final_size_qa.py Fig1.svg --width-mm 85 --min-text-pt 6
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from functools import lru_cache
from pathlib import Path

PT = {"": 0.75, "px": 0.75, "pt": 1.0, "pc": 12.0, "in": 72.0, "cm": 72 / 2.54, "mm": 72 / 25.4, "q": 72 / 101.6}
NUMBER = r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?"
LENGTH = re.compile(rf"^\s*({NUMBER})\s*([A-Za-z%]*)\s*$")
FONT_SHORTHAND = re.compile(rf"(?:^|\s)({NUMBER})(px|pt|em|rem|%)?(?:\s*/\s*\S+)?\s+(.+)$")
INHERITED = ("fill", "stroke", "stroke-width", "font-size", "font-family", "text-anchor", "visibility",
             "fill-opacity", "stroke-opacity", "dominant-baseline")
NAMED = {"black": "#000000", "white": "#ffffff", "red": "#ff0000", "green": "#008000", "blue": "#0000ff",
         "gray": "#808080", "grey": "#808080", "orange": "#ffa500", "purple": "#800080", "yellow": "#ffff00",
         "cyan": "#00ffff", "magenta": "#ff00ff", "brown": "#a52a2a", "pink": "#ffc0cb", "navy": "#000080",
         "teal": "#008080", "steelblue": "#4682b4", "firebrick": "#b22222", "tomato": "#ff6347", "lime": "#00ff00",
         "maroon": "#800000", "olive": "#808000", "silver": "#c0c0c0", "darkgray": "#a9a9a9",
         "darkgrey": "#a9a9a9", "lightgray": "#d3d3d3", "lightgrey": "#d3d3d3"}

# ---------------------------------------------------------------- colour


def parse_color(value: str | None) -> str | None:
    """Return #rrggbb, or None for no/unsupported paint."""
    text = (value or "").strip().lower()
    if re.fullmatch(r"#[0-9a-f]{6}", text):
        return text
    if re.fullmatch(r"#[0-9a-f]{3}", text):
        return "#" + "".join(c * 2 for c in text[1:])
    if re.fullmatch(r"#[0-9a-f]{8}", text):
        return text[:7] if text[7:] != "00" else None
    match = re.fullmatch(r"rgba?\(([^)]*)\)", text)
    if match:
        parts = [p for p in re.split(r"[\s,/]+", match[1].strip()) if p]
        try:
            if len(parts) < 3 or len(parts) > 3 and float(parts[3].rstrip("%")) == 0:
                return None
            values = [float(p[:-1]) * 2.55 if p.endswith("%") else float(p) for p in parts[:3]]
        except ValueError:
            return None
        return "#" + "".join(f"{max(0, min(255, round(v))):02x}" for v in values)
    return NAMED.get(text)


def _linear(color: str) -> list[float]:
    channels = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]


def luminance(color: str) -> float:
    r, g, b = _linear(color)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    x, y = luminance(a), luminance(b)
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)


# Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB.
# Keep identical to figure-quality.js.
VISION = {
    "protan": ((0.152286, 1.052583, -0.204868), (0.114503, 0.786281, 0.099216), (-0.003882, -0.048116, 1.051998)),
    "deutan": ((0.367322, 0.860646, -0.227968), (0.280085, 0.672501, 0.047413), (-0.011820, 0.042940, 0.968881)),
    "tritan": ((1.255528, -0.076749, -0.178779), (-0.078411, 0.930809, 0.147602), (0.004733, 0.691367, 0.303900)),
    "grayscale": ((0.2126, 0.7152, 0.0722),) * 3,
}


def lab(color: str, vision: str | None = None) -> tuple[float, float, float]:
    rgb = _linear(color)
    if vision:
        rgb = [min(1.0, max(0.0, sum(m * c for m, c in zip(row, rgb)))) for row in VISION[vision]]
    r, g, b = rgb
    xyz = ((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047,
           0.2126729 * r + 0.7151522 * g + 0.0721750 * b,
           (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883)
    fx, fy, fz = (v ** (1 / 3) if v > 216 / 24389 else (24389 / 27 * v + 16) / 116 for v in xyz)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def delta_e(p: tuple[float, float, float], q: tuple[float, float, float]) -> float:
    """CIEDE2000 colour difference."""
    l1, a1, b1 = p
    l2, a2, b2 = q
    cbar = (math.hypot(a1, b1) + math.hypot(a2, b2)) / 2
    g = 0.5 * (1 - math.sqrt(cbar ** 7 / (cbar ** 7 + 25 ** 7)))
    a1, a2 = a1 * (1 + g), a2 * (1 + g)
    c1, c2 = math.hypot(a1, b1), math.hypot(a2, b2)
    h1, h2 = math.degrees(math.atan2(b1, a1)) % 360, math.degrees(math.atan2(b2, a2)) % 360
    dh = 0.0 if c1 * c2 == 0 else (h2 - h1 + 180) % 360 - 180
    big_h = 2 * math.sqrt(c1 * c2) * math.sin(math.radians(dh / 2))
    lbar, cbar = (l1 + l2) / 2, (c1 + c2) / 2
    if c1 * c2 == 0:
        hbar = h1 + h2
    elif abs(h1 - h2) <= 180:
        hbar = (h1 + h2) / 2
    else:
        hbar = (h1 + h2 + 360) / 2 % 360
    t = (1 - 0.17 * math.cos(math.radians(hbar - 30)) + 0.24 * math.cos(math.radians(2 * hbar))
         + 0.32 * math.cos(math.radians(3 * hbar + 6)) - 0.20 * math.cos(math.radians(4 * hbar - 63)))
    sl = 1 + 0.015 * (lbar - 50) ** 2 / math.sqrt(20 + (lbar - 50) ** 2)
    sc, sh = 1 + 0.045 * cbar, 1 + 0.015 * cbar * t
    rt = (-math.sin(math.radians(60 * math.exp(-((hbar - 275) / 25) ** 2)))
          * 2 * math.sqrt(cbar ** 7 / (cbar ** 7 + 25 ** 7)))
    x, y, z = (l2 - l1) / sl, (c2 - c1) / sc, big_h / sh
    return math.sqrt(max(0.0, x * x + y * y + z * z + rt * y * z))


MAX_CATEGORIES = 24


def color_conflicts(colors) -> tuple[list[dict], bool]:
    """Pairs distinct in normal vision that merge for other readers.

    Neutral inks carry axes and text, so only chromatic colours are compared.
    More than MAX_CATEGORIES colours is treated as a continuous scale.
    """
    chromatic = sorted(c for c in set(colors) if math.hypot(*lab(c)[1:]) >= 12)
    if len(chromatic) > MAX_CATEGORIES:
        return [], False
    found = []
    for i, first in enumerate(chromatic):
        for second in chromatic[i + 1:]:
            normal = delta_e(lab(first), lab(second))
            if normal < 12:  # Tints of one semantic colour.
                continue
            for vision in VISION:
                seen = delta_e(lab(first, vision), lab(second, vision))
                if seen < 6:
                    found.append({"first": first, "second": second, "vision": vision,
                                  "normal": round(normal, 1), "simulated": round(seen, 1)})
    return sorted(found, key=lambda item: item["simulated"]), True


# ---------------------------------------------------------------- notation

SUB = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")
SUP = str.maketrans("0123456789-+", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺")
# (code, pattern, replacement, skip when the text has tspans: a semantic
# subscript and a baseline digit look identical once flattened).
# Keep identical to figure-quality.js.
NOTATION = (
    ("subscript", re.compile(r"\b(MIC|IC|EC|ED|LD|GI|TC|CC|LC)(50|90|99)\b"), lambda m: m[1] + m[2].translate(SUB), True),
    ("subscript", re.compile(r"\b([Ll]og)(2|10)(?![\d.])"), lambda m: m[1] + m[2].translate(SUB), True),
    ("subscript", re.compile(r"\b(?:H2O2|H2O|CO2|CaCl2|MgCl2)\b"),
     lambda m: re.sub(r"\d", lambda d: d[0].translate(SUB), m[0]), True),
    ("superscript", re.compile(r"\^\{?([-+−]?\d+)\}?"), lambda m: m[1].replace("−", "-").translate(SUP), False),
    ("scientific", re.compile(r"(?<![\w.])(\d(?:\.\d+)?)[eE]([-+]?)0*(\d+)(?![\w.])"),
     lambda m: m[1] + " × 10" + (m[2].replace("+", "") + m[3]).translate(SUP), False),
    ("sign", re.compile(r"(?<=\d)\s*[xX*]\s*(?=10[⁰¹²³⁴⁵⁶⁷⁸⁹⁻])"), lambda m: " × ", False),
    ("sign", re.compile(r"\+/-"), lambda m: "±", False),
    ("sign", re.compile(r"<="), lambda m: "≤", False),
    ("sign", re.compile(r">="), lambda m: "≥", False),
    ("sign", re.compile(r"^-(?=\d)"), lambda m: "−", False),
    ("unit", re.compile(r"(?<![^\d\s(\[/])u(?=(?:g|L|l|M|m|mol)(?:$|[\s)\]/.,·]))"), lambda m: "µ", False),
    ("spacing", re.compile(r"\b([PpNnRrqQ])\s*([=<>≤≥])\s*(?=[\d.−-])"), lambda m: f"{m[1]} {m[2]} ", False),
)


def suggest_notation(text: str, plain: bool = True) -> tuple[str, list[str]]:
    """Return typographically equivalent text and the rule codes that changed it."""
    codes: list[str] = []
    for code, pattern, replacement, skip_rich in NOTATION:
        if skip_rich and not plain:
            continue
        updated = pattern.sub(replacement, text)
        if updated != text and code not in codes:
            codes.append(code)
        text = updated
    return text, codes


# ---------------------------------------------------------------- geometry

IDENTITY = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


def multiply(a, b):
    return (a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
            a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
            a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5])


def numbers(value: str | None) -> list[float]:
    return [float(v) for v in re.findall(NUMBER, value or "")]


def parse_transform(value: str | None):
    matrix = IDENTITY
    for name, body in re.findall(r"([A-Za-z]+)\s*\(([^)]*)\)", value or ""):
        v = numbers(body)
        if name == "matrix" and len(v) == 6:
            step = tuple(v)
        elif name == "translate" and v:
            step = (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0)
        elif name == "scale" and v:
            step = (v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0)
        elif name == "rotate" and v:
            c, s = math.cos(math.radians(v[0])), math.sin(math.radians(v[0]))
            step = (c, s, -s, c, 0, 0)
            if len(v) == 3:
                step = multiply(multiply((1, 0, 0, 1, v[1], v[2]), step), (1, 0, 0, 1, -v[1], -v[2]))
        elif name == "skewX" and v:
            step = (1, 0, math.tan(math.radians(v[0])), 1, 0, 0)
        elif name == "skewY" and v:
            step = (1, math.tan(math.radians(v[0])), 0, 1, 0, 0)
        else:
            continue
        matrix = multiply(matrix, step)
    return matrix


def local(tag) -> str:
    return tag.split("}")[-1] if isinstance(tag, str) else ""


def length(value: str | None, default: float | None = None, relative: float = 1.0) -> float | None:
    """CSS length in user units (px)."""
    match = LENGTH.match(value or "")
    if not match:
        return default
    number, unit = float(match[1]), match[2].lower()
    if unit in {"em", "rem"}:
        return number * relative
    if unit == "%":
        return number / 100 * relative
    return number * PT[unit] / 0.75 if unit in PT else default


def declarations(text: str | None) -> dict[str, str]:
    result: dict[str, str] = {}
    for part in (text or "").split(";"):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        key, value = key.strip().lower(), re.sub(r"\s*!important\s*$", "", value.strip())
        if key == "font":
            match = FONT_SHORTHAND.search(value)
            if match:
                result["font-size"], result["font-family"] = match[1] + (match[2] or ""), match[3]
        elif key:
            result[key] = value
    return result


def stylesheet(root) -> list[tuple[str, dict[str, str]]]:
    rules = []
    for node in root.iter():
        if local(node.tag) != "style":
            continue
        css = re.sub(r"/\*.*?\*/", "", "".join(node.itertext()), flags=re.S)
        for selectors, body in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
            for selector in (s.strip() for s in selectors.split(",")):
                if selector and re.fullmatch(r"\*|[A-Za-z]*(?:[.#][\w-]+)?", selector):
                    rules.append((selector, declarations(body)))
    return sorted(rules, key=lambda rule: 0 if rule[0] == "*" else 3 if "#" in rule[0] else 2 if "." in rule[0] else 1)


def selector_matches(selector: str, node) -> bool:
    if selector == "*":
        return True
    match = re.fullmatch(r"([A-Za-z]*)(?:([.#])([\w-]+))?", selector)
    if match[1] and match[1] != local(node.tag):
        return False
    if match[2] == ".":
        return match[3] in node.get("class", "").split()
    return match[2] != "#" or match[3] == node.get("id")


@lru_cache(maxsize=32)
def _font(family: str):
    try:
        import logging
        from matplotlib import font_manager
        from PIL import ImageFont
        logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)
        return ImageFont.truetype(font_manager.findfont(font_manager.FontProperties(family=family or "Arial")), 100)
    except Exception:
        return None


def text_width(text: str, size: float, family: str) -> float:
    font = _font(family)
    if font is not None:
        return font.getlength(text) / 100 * size
    return sum(1.0 if ord(c) > 0x2E7F else 0.55 for c in text) * size


def first_family(value: str | None) -> str:
    return (value or "").split(",")[0].strip().strip("'\"")


def physical(value: str | None) -> float | None:
    return None if "%" in (value or "") else length(value)


def collect(path: Path, width_mm: float | None = None) -> dict:
    root = ET.fromstring(path.read_text(encoding="utf-8-sig"))
    if local(root.tag) != "svg":
        raise ValueError("not an SVG document")
    box, width, height = numbers(root.get("viewBox")), physical(root.get("width")), physical(root.get("height"))
    if len(box) != 4 or box[2] <= 0 or box[3] <= 0:
        if not width or not height:
            raise ValueError("SVG needs a viewBox or a physical width and height")
        box = [0.0, 0.0, width, height]
    scale = (width_mm * 72 / 25.4 if width_mm else (width or box[2]) * 0.75) / box[2]
    rules, by_id = stylesheet(root), {n.get("id"): n for n in root.iter() if n.get("id")}
    texts, lines, paints = [], [], set()

    def style_of(node, parent):
        result = {k: parent[k] for k in INHERITED if k in parent}
        own = {k: node.get(k) for k in (*INHERITED, "opacity", "display") if node.get(k) is not None}
        for selector, body in rules:
            if selector_matches(selector, node):
                own.update(body)
        own.update(declarations(node.get("style")))
        base = parent["font-size"]
        own = {k: v for k, v in own.items() if v != "inherit"}
        if "font-size" in own:
            own["font-size"] = length(own["font-size"], base, base)
        result.update(own)
        result.setdefault("font-size", base)
        return result

    def add_text(node, matrix, style):
        content = re.sub(r"\s+", " ", "".join(node.itertext())).strip()
        if not content:
            return
        spans = [n for n in node.iter() if n is not node and local(n.tag) == "tspan"]
        sizes, families = [], set()
        if (node.text or "").strip() or not spans:
            sizes.append(style["font-size"])
            families.add(first_family(style.get("font-family")))
        for span in spans:
            if "".join(span.itertext()).strip():
                own = style_of(span, style)
                sizes.append(own["font-size"])
                families.add(first_family(own.get("font-family")))
        size = max(sizes or [style["font-size"]])  # Sub/superscript runs are legitimately smaller.
        polygon = []
        # Glyph-positioned or multi-line runs cannot be estimated as one box.
        if not any(n.get("x") or n.get("y") or n.get("dy") for n in spans) and len(numbers(node.get("x"))) <= 1:
            w = text_width(content, size, first_family(style.get("font-family")))
            x, y = (numbers(node.get("x")) or [0.0])[0], (numbers(node.get("y")) or [0.0])[0]
            anchor = style.get("text-anchor", "start")
            x -= w / 2 if anchor == "middle" else w if anchor == "end" else 0
            # Cap height to descender; full line boxes would report false contact.
            centred = style.get("dominant-baseline", "") in {"middle", "central"}
            top = y - (0.4 if centred else 0.72) * size
            corners = [(x, top), (x + w, top), (x + w, top + 0.8 * size), (x, top + 0.8 * size)]
            polygon = [((matrix[0] * a + matrix[2] * b + matrix[4] - box[0]) * scale,
                        (matrix[1] * a + matrix[3] * b + matrix[5] - box[1]) * scale) for a, b in corners]
        texts.append({"text": content, "size": size * math.hypot(matrix[2], matrix[3]) * scale,
                      "color": parse_color(style.get("fill", "black")),
                      "families": sorted(f for f in families if f), "plain": not spans, "polygon": polygon})

    def walk(node, matrix, parent, depth):
        tag = local(node.tag)
        if depth > 80 or tag in {"defs", "clipPath", "mask", "pattern", "style", "metadata", "title", "desc", "marker"}:
            return
        if tag == "symbol" and depth and not parent.get("_use"):
            return
        style = style_of(node, parent)
        if style.get("display") == "none" or style.get("visibility") in {"hidden", "collapse"} or style.get("opacity") in {"0", "0.0"}:
            return
        matrix = multiply(matrix, parse_transform(node.get("transform")))
        if tag == "svg" and node is not root:
            matrix = multiply(matrix, (1, 0, 0, 1, length(node.get("x"), 0.0), length(node.get("y"), 0.0)))
            view, w, h = numbers(node.get("viewBox")), length(node.get("width")), length(node.get("height"))
            if len(view) == 4 and view[2] > 0 and view[3] > 0 and w and h:
                sx, sy = w / view[2], h / view[3]
                if node.get("preserveAspectRatio", "").strip() != "none":
                    sx = sy = min(sx, sy)
                matrix = multiply(matrix, (sx, 0, 0, sy, (w - view[2] * sx) / 2 - view[0] * sx,
                                           (h - view[3] * sy) / 2 - view[1] * sy))
        if tag == "use":
            href = node.get("href") or node.get("{http://www.w3.org/1999/xlink}href") or ""
            target = by_id.get(href[1:]) if href.startswith("#") else None
            if target is not None:
                moved = multiply(matrix, (1, 0, 0, 1, length(node.get("x"), 0.0), length(node.get("y"), 0.0)))
                walk(target, moved, {**style, "_use": True}, depth + 1)
            return
        if tag == "text":
            add_text(node, matrix, style)
            return
        if tag in {"path", "line", "polyline", "polygon", "rect", "circle", "ellipse"}:
            transparent = {"0", "0.0"}
            fill = None if tag == "line" or style.get("fill-opacity") in transparent else parse_color(style.get("fill", "black"))
            stroke = None if style.get("stroke-opacity") in transparent else parse_color(style.get("stroke"))
            paints.update(c for c in (fill, stroke) if c)
            if stroke:
                value = length(style.get("stroke-width"), 1.0) or 0.0
                if style.get("vector-effect") == "non-scaling-stroke":
                    value *= 0.75
                else:
                    value *= math.sqrt(abs(matrix[0] * matrix[3] - matrix[1] * matrix[2])) * scale
                if value > 0:
                    lines.append(value)
        for child in node:
            walk(child, matrix, style, depth + 1)

    walk(root, IDENTITY, {"font-size": 16.0}, 0)
    return {"texts": texts, "lines": lines, "paints": paints, "width_pt": box[2] * scale, "height_pt": box[3] * scale,
            "declared": bool(width or width_mm)}


def polygons_overlap(a, b, shrink: float = 0.35) -> bool:
    """Separating-axis test; unlike bounding boxes it is correct for rotated labels."""
    for polygon in (a, b):
        for i in range(4):
            (x1, y1), (x2, y2) = polygon[i], polygon[(i + 1) % 4]
            nx, ny = y1 - y2, x2 - x1
            norm = math.hypot(nx, ny)
            if norm < 1e-9:
                return False
            pa = [(x * nx + y * ny) / norm for x, y in a]
            pb = [(x * nx + y * ny) / norm for x, y in b]
            if min(max(pa), max(pb)) - max(min(pa), min(pb)) <= shrink:
                return False
    return True


VISION_NAMES = {"protan": "red-blind", "deutan": "green-blind", "tritan": "blue-blind", "grayscale": "grayscale"}


def audit(path: str | Path, *, width_mm: float | None = None, min_text_pt: float | None = None, min_line_pt: float = 0.25) -> dict:
    if width_mm is not None and not (math.isfinite(width_mm) and width_mm > 0):
        raise ValueError("width must be a positive number of millimetres")
    # Without a declared requirement, 5 pt is a common floor, not this target's rule.
    required, min_text_pt = min_text_pt is not None, 5.0 if min_text_pt is None else min_text_pt
    data = collect(Path(path), width_mm)
    texts, w, h = data["texts"], data["width_pt"], data["height_pt"]
    issues: list[dict] = []

    def add(severity, code, message, count=1, examples=()):
        issues.append({"severity": severity, "code": code, "message": message, "count": count,
                       "examples": list(examples)[:6]})

    def label(value):
        return value if len(value) <= 40 else value[:37] + "…"

    if not data["declared"]:
        add("WARN", "FINAL_SIZE_UNDECLARED", "SVG has no physical width; sizes assume 1 px = 1/96 in. Pass --width-mm")
    small = sorted((t for t in texts if t["size"] < min_text_pt - 0.05), key=lambda t: t["size"])
    if small:
        add("FAIL" if required else "WARN", "TEXT_TOO_SMALL", f"{len(small)} text object(s) below {min_text_pt:g} pt at final size; smallest {small[0]['size']:.1f} pt",
            len(small), [f"{label(t['text'])} ({t['size']:.1f} pt)" for t in small])
    thin = [v for v in data["lines"] if v < min_line_pt - 0.005]
    if thin:
        add("WARN", "LINE_TOO_THIN", f"{len(thin)} stroke(s) below {min_line_pt:g} pt at final size; thinnest {min(thin):.2f} pt", len(thin))
    measurable = [t for t in texts if t["polygon"]]
    outside = [t for t in measurable if any(x < -1 or y < -1 or x > w + 1 or y > h + 1 for x, y in t["polygon"])]
    if outside:
        add("WARN", "TEXT_OUTSIDE_CANVAS", f"{len(outside)} text object(s) may be clipped by the canvas edge",
            len(outside), [label(t["text"]) for t in outside])
    compared = measurable[:1500]
    pairs = [(a, b) for i, a in enumerate(compared) for b in compared[i + 1:] if polygons_overlap(a["polygon"], b["polygon"])]
    if pairs:
        add("WARN", "TEXT_OVERLAP", f"{len(pairs)} text pair(s) appear to overlap (estimated glyph boxes; confirm in the render)",
            len(pairs), [f"{label(a['text'])} / {label(b['text'])}" for a, b in pairs])
    notation = [(t["text"], *suggest_notation(t["text"], t["plain"])) for t in texts]
    notation = [item for item in notation if item[2]]
    if notation:
        add("WARN", "SCIENTIFIC_NOTATION", f"{len(notation)} text object(s) use baseline notation", len(notation),
            dict.fromkeys(f"{label(old)} → {label(new)}" for old, new, _ in notation))
    families = sorted({f for t in texts for f in t["families"]})
    if len({f.casefold() for f in families}) > 1:
        add("WARN", "MIXED_FONT_FAMILIES", "visible text declares several families: " + ", ".join(families), len(families))
    faint = sorted({t["color"] for t in texts if t["color"] and t["color"] != "#ffffff" and contrast(t["color"], "#ffffff") < 3})
    if faint:
        add("WARN", "LOW_TEXT_CONTRAST", "text colour(s) below 3:1 on white; confirm the actual background: " + ", ".join(faint), len(faint))
    conflicts, complete = color_conflicts(data["paints"])
    for vision, name in VISION_NAMES.items():
        hits = [c for c in conflicts if c["vision"] == vision]
        if hits:
            add("WARN", "COLOR_MERGES_" + vision.upper(),
                f"{len(hits)} colour pair(s) merge in {name} viewing; add shape, line style or direct labels where colour carries meaning",
                len(hits), [f"{c['first']} / {c['second']} (ΔE {c['normal']} → {c['simulated']})" for c in hits])
    return {"path": str(path), "width_mm": w * 25.4 / 72, "height_mm": h * 25.4 / 72, "texts": len(texts),
            "strokes": len(data["lines"]), "font_families": families, "colors": sorted(data["paints"]),
            "color_check_complete": complete, "text_boxes_measured": len(compared), "issues": issues}


def main(argv=None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("paths", nargs="+")
    parser.add_argument("--width-mm", type=float, help="final placed width; default is the declared SVG width")
    parser.add_argument("--min-text-pt", type=float, help="required minimum; blocks when given, otherwise below 5 pt is a warning")
    parser.add_argument("--min-line-pt", type=float, default=0.25)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    reports, failed = [], False
    for path in args.paths:
        try:
            report = audit(path, width_mm=args.width_mm, min_text_pt=args.min_text_pt, min_line_pt=args.min_line_pt)
        except (OSError, ET.ParseError, ValueError) as exc:
            report = {"path": str(path), "issues": [{"severity": "FAIL", "code": "SVG_PARSE_ERROR", "message": str(exc),
                                                     "count": 1, "examples": []}]}
        reports.append(report)
        failed |= any(i["severity"] == "FAIL" for i in report["issues"])
    if args.json:
        print(json.dumps({"reports": reports, "exit_code": 2 if failed else 0}, indent=2, ensure_ascii=False))
        return 2 if failed else 0
    for report in reports:
        size = f" {report['width_mm']:.1f} x {report['height_mm']:.1f} mm" if "width_mm" in report else ""
        print(f"[FINAL SIZE] {report['path']}{size}")
        for issue in report["issues"]:
            print(f"  [{issue['severity']}] {issue['code']}: {issue['message']}")
            for example in issue["examples"]:
                print(f"      {example}")
        if not report["issues"]:
            print("  [PASS] no automated finding")
    return 2 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

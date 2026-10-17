#!/usr/bin/env python3
"""Inventory presentation declarations without reading scientific data or SVG assets."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "skills/polish-sci-figures/assets/figure-studio"
DECL = re.compile(r"(?:^|[;{])\s*([\w-]+)\s*:\s*([^{};]+)")
COLOR = re.compile(r"#[0-9a-fA-F]{3,8}\b|\b(?:white|black|transparent)\b|rgba?\([^)]*\)", re.I)
INLINE_FILES = ("image-color-ui.js", "image-insets-ui.js", "image-links-ui.js", "update-check.js")
LEGACY_CSS = ("axis-settings-ui.css", "discovery-ui.css", "duplicate-check.css", "duplicate-viewer.css",
              "experience-tools.css", "literature.css", "mobile-ui.css", "rich-text.css", "studio.css", "workspace-layout.css")


def css_fragments(path: Path):
    source = path.read_text(encoding="utf-8")
    if path.suffix == ".css":
        return [source]
    # These are component-owned UI styles, never user SVG text or renderer source.
    fragments = re.findall(r"const (?:css|wipeCss)\s*=\s*`([^`]*)`", source)
    fragments += re.findall(r"style\.textContent\s*=\s*css\s*\+\s*`([^`]*)`", source)
    fragments += re.findall(r"\.style\.cssText\s*=\s*'([^']*)'", source)
    return fragments


def inventory():
    groups = {key: Counter() for key in ("colors", "spacing", "font_sizes", "radii", "shadows")}
    files = []
    for path in sorted(ASSETS.glob("*.css")) + [ASSETS / name for name in INLINE_FILES]:
        counters = {key: Counter() for key in groups}
        fragments = css_fragments(path)
        for fragment in fragments:
            fragment = re.sub(r"/\*[\s\S]*?\*/", "", fragment)
            # Add a leading semicolon so standalone cssText has the same grammar.
            for prop, value in DECL.findall(";" + fragment):
                value = value.strip()
                for color in COLOR.findall(value):
                    counters["colors"][color.lower()] += 1
                if prop in {"padding", "margin", "gap", "row-gap", "column-gap"} or prop.startswith(("padding-", "margin-")):
                    for unit in re.findall(r"-?\d+(?:\.\d+)?px\b", value):
                        counters["spacing"][unit] += 1
                if prop == "font-size":
                    counters["font_sizes"][value] += 1
                if prop.endswith("radius"):
                    counters["radii"][value] += 1
                if prop in {"box-shadow", "text-shadow"}:
                    counters["shadows"][value] += 1
        for key, count in counters.items():
            groups[key].update(count)
        data = path.read_bytes()
        files.append({"path": path.relative_to(ROOT).as_posix(), "bytes": len(data),
                      "sha256": hashlib.sha256(data).hexdigest(), "css_fragments": len(fragments),
                      "literal_colors": sum(counters["colors"].values()),
                      "token_references": sum(fragment.count("var(--") for fragment in fragments)})
    theme_source = (ASSETS / "theme-tokens.css").read_text(encoding="utf-8")
    theme_names = re.findall(r"(--[\w-]+)\s*:", theme_source)
    return {"generated_utc": datetime.now(timezone.utc).isoformat(),
            "git_head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
            "scope": "UI CSS assets and explicitly enumerated component-injected styles; excludes scientific SVG, palettes, data and rendering code",
            "files": files,
            "theme_root_properties": {"unique": len(set(theme_names)), "declarations": len(theme_names),
                                      "fs_tokens": len({name for name in theme_names if name.startswith("--fs-")}),
                                      "legacy_aliases": len({name for name in theme_names if not name.startswith("--fs-")})},
            "totals": {key: {"occurrences": sum(value.values()), "distinct": len(value)} for key, value in groups.items()},
            "values": {key: dict(value.most_common()) for key, value in groups.items()}}


def protection_checks(ref: str):
    def old_source(path):
        return subprocess.check_output(["git", "show", f"{ref}:{path.relative_to(ROOT).as_posix()}"], cwd=ROOT).decode("utf-8")

    def without_ui_styles(source):
        source = re.sub(r"const (?:css|wipeCss)\s*=\s*`[^`]*`", "UI_STYLE", source)
        source = re.sub(r"style\.textContent\s*=\s*css\s*\+\s*`[^`]*`", "UI_STYLE_APPEND", source)
        return re.sub(r"\.style\.cssText\s*=\s*'[^']*'", "UI_CSS_TEXT", source).replace("\r\n", "\n")

    def protected_paint(source):
        result = []
        for selector, body in re.findall(r"([^{}]+)\{([^{}]*)\}", re.sub(r"/\*[\s\S]*?\*/", "", source)):
            if re.search(r"slot-guide|selection-(?:marquee|outline|count|transform|resize)|panel-move-handle|alignment-guide|object-alignment-snap|workspace-selection-layer|data-grid-resize|data-overlay-resize|data-resize", selector):
                continue
            for key, value in re.findall(r"(?:^|;)\s*(fill|stroke)\s*:\s*([^;]+)", body):
                result.append([selector.strip(), key, value.strip()])
        return result

    result = {"baseline": ref, "scope": "Presentation migration guards; this does not validate scientific algorithms or every export format", "checks": {}}
    for name in INLINE_FILES[:3]:
        path = ASSETS / name
        same = without_ui_styles(old_source(path)) == without_ui_styles(path.read_text(encoding="utf-8"))
        result["checks"][name + ": non-CSS code unchanged"] = same
    for name in LEGACY_CSS:
        path = ASSETS / name
        result["checks"][name + ": non-editor SVG fill/stroke unchanged"] = protected_paint(old_source(path)) == protected_paint(path.read_text(encoding="utf-8"))
    assert all(result["checks"].values()), json.dumps(result, ensure_ascii=False, indent=2)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check-baseline", help="Optional git reference for the bounded presentation-only protection checks")
    parser.add_argument("--checks-output", type=Path)
    args = parser.parse_args()
    result = inventory()
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"totals": result["totals"], "top": {key: dict(list(value.items())[:10]) for key, value in result["values"].items()}}, ensure_ascii=False, indent=2))
    if args.check_baseline:
        checks = protection_checks(args.check_baseline)
        if args.checks_output:
            args.checks_output.parent.mkdir(parents=True, exist_ok=True)
            args.checks_output.write_text(json.dumps(checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("PASS: component non-CSS code and existing non-editor fill/stroke declarations unchanged")


if __name__ == "__main__":
    main()

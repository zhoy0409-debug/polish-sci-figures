#!/usr/bin/env python3
"""Package existing scientific SVG candidates into an offline, editable Figure Studio.

One directory is one panel and must contain figure_recipe.json and analysis_plan.json.
A standalone SVG is a panel without alternatives. No analysis is inferred or rerun.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ASSETS = Path(__file__).resolve().parents[1] / "assets" / "figure-studio"
SVG = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def length_pt(raw: str) -> float:
    match = re.fullmatch(r"\s*([\d.]+)\s*(pt|px|mm|cm|in)?\s*", raw)
    if not match:
        raise ValueError(f"SVG needs an explicit physical size: {raw!r}")
    value = float(match[1]) * {"pt": 1, "px": .75, "mm": 72/25.4, "cm": 72/2.54, "in": 72, None: .75}[match[2]]
    if not math.isfinite(value) or not 0 < value <= 14400:
        raise ValueError("SVG size must be finite and between 0 and 14400 pt")
    return value


def inspect_svg(path: Path) -> dict:
    return inspect_svg_bytes(path.read_bytes(), path.stem)


def inspect_svg_bytes(raw: bytes, name: str) -> dict:
    if len(raw) > 20_000_000:
        raise ValueError(f"SVG exceeds 20 MB: {name}")
    text = raw.decode("utf-8-sig")
    if re.search(r"<!ENTITY", text, re.I):
        raise ValueError("XML entity declarations are not supported")
    root = ET.fromstring(text)
    if root.tag != f"{{{SVG}}}svg":
        raise ValueError(f"Not an SVG: {name}")
    width, height = length_pt(root.get("width", "")), length_pt(root.get("height", ""))
    box = [float(x) for x in re.split(r"[\s,]+", root.get("viewBox", "").strip()) if x]
    if len(box) != 4 or not all(math.isfinite(x) for x in box) or min(box[2:]) <= 0:
        raise ValueError(f"SVG requires a finite positive viewBox: {name}")
    if not math.isclose(width/box[2], height/box[3], rel_tol=1e-5):
        raise ValueError("Physical canvas and viewBox aspect ratios must agree")
    # Browser-side strict allowlist is applied again, including restored projects.
    result = {"name": name, "svg": text, "sha256": digest(raw),
              "width": width, "height": height, "viewBox": box}
    axis_metadata = next((n for n in root.iter() if n.attrib.get('id') == 'studio-axis-controls'), None)
    if axis_metadata is not None and axis_metadata.text:
        result['axis_controls'] = json.loads(axis_metadata.text)
    return result


def panel_from_path(path: Path, index: int, with_layouts: bool = False, view: str | None = None) -> dict:
    if not path.exists():
        raise ValueError(f"Panel input not found: {path}")
    recipe, analysis, table = {}, {}, None
    if path.is_dir():
        for name in ("figure_recipe.json", "analysis_plan.json"):
            if not (path / name).is_file():
                raise ValueError(f"{path.name}: candidate directories require {name}; pass individual SVGs otherwise")
        recipe = json.loads((path / "figure_recipe.json").read_text(encoding="utf-8-sig"))
        analysis = json.loads((path / "analysis_plan.json").read_text(encoding="utf-8-sig"))
        if not isinstance(recipe, dict) or not isinstance(analysis, dict):
            raise ValueError("Recipe and analysis plan must be JSON objects")
        paths = sorted(path.glob("*.svg"))
        # Bundle membership is declared by the upstream workbench, not a new statistical validation.
        source_name = recipe.get("input")
        if isinstance(source_name, str):
            source = path / source_name.replace("\\", "/")
            if source.is_file() and source.suffix.lower() in (".csv", ".tsv") and source.stat().st_size <= 2_000_000:
                raw = source.read_bytes()
                expected = analysis.get("source_sha256")
                if expected and digest(raw) != expected:
                    raise ValueError(f"{path.name}: source data hash changed; regenerate candidates first")
                rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig")), delimiter="\t" if source.suffix.lower() == ".tsv" else ","))
                table = {"name": source.name, "sha256": digest(raw), "rows": rows}
    else:
        paths = [path]
    if not paths:
        raise ValueError(f"No SVG candidates in {path}")
    variants = [inspect_svg(p) for p in paths]
    first = variants[0]
    for variant in variants[1:]:
        if any(not math.isclose(variant[k], first[k], rel_tol=1e-5) for k in ("width", "height")) or variant["viewBox"] != first["viewBox"]:
            raise ValueError(f"{path.name}: candidate canvases differ; regenerate for the same slot before switching")
    selected = next((i for i, v in enumerate(variants) if v["name"] in ("raw_points_estimate_ci", "paired_trajectories")), 0)
    requested = recipe.get('parameters', {}).get('view')
    if recipe.get('family') in ('gallery', 'roc_results'):
        selected = next((i for i, v in enumerate(variants) if v['name'] in (requested, 'roc_' + str(requested))), selected)
    initial_view = view if view is not None else recipe.get('studio_view')
    if initial_view is not None:
        match = next((i for i, candidate in enumerate(variants) if candidate['name'] == initial_view), None)
        if match is None and view is not None:
            available = ', '.join(candidate['name'] for candidate in variants)
            raise ValueError(f"{path.name}: unknown initial view {view!r}. Available views: {available}")
        if match is not None:
            selected = match
            if recipe:
                recipe['studio_view'] = initial_view
                if recipe.get('family') in ('gallery', 'roc_results'):
                    requested = initial_view.removeprefix('roc_') if recipe['family'] == 'roc_results' else initial_view
                    recipe['parameters'] = {**recipe.get('parameters', {}), 'view': requested}
    for v in variants:
        v['size'] = 'original'
        if recipe.get('family') in ('gallery','roc','roc_results') or v['name'] in ('composition_ring', 'composition_waffle', 'ternary_composition', 'correlation_circles', 'correlation_values', 'hexbin_density', 'pca_loadings'):
            v['preserveAspect'] = True
    if with_layouts and path.is_dir():
        if recipe.get('family')=='gallery' and table:
            sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'make-sci-data-figures/scripts'))
            import pandas as pd
            from gallery_registry import render_sizes,colors_for
            sizes=render_sizes(pd.read_csv(source,keep_default_na=False),requested,
                colors_for(recipe.get('palette','zhoy_muted'),recipe.get('colors')),recipe.get('font','Arial'),axes=recipe.get('axis_settings'))
        else:
            from studio_sizes import render_sizes
            sizes=render_sizes(path, recipe, analysis, variants)
        for name, size, raw in sizes:
            v = inspect_svg_bytes(raw, name)
            v['size'] = size
            if recipe.get('family')=='gallery':v['preserveAspect']=True
            variants.append(v)
    return {"id": f"panel-{index}", "name": path.name, "variants": variants,
            "initialVariant": selected, "recipe": recipe, "analysis": analysis, "table": table,
            "axis_controls": variants[selected].get('axis_controls'),
            "provenance": "upstream-bundle" if path.is_dir() else "standalone-svg"}


def build_project(paths: list[Path], title: str, columns: int | None = None, with_layouts: bool = False, view: str | None = None) -> dict:
    if not paths or len(paths) > 24:
        raise ValueError("Choose 1–24 panels")
    if columns is None:
        columns = min(2, len(paths))
    if not 1 <= columns <= 6:
        raise ValueError("Columns must be between 1 and 6")
    panels = [panel_from_path(path, i, with_layouts, view) for i, path in enumerate(paths)]
    identity = digest(json.dumps({"panels": panels, "title": title, "columns": columns}, sort_keys=True, ensure_ascii=False).encode())[:20]
    return {"schema": "figure-studio/1", "id": identity, "title": title, "panels": panels,
            "initialState": {"order": [p["id"] for p in panels], "columns": columns, "gap": 12,
                             "panels": {p["id"]: {"variant": p["initialVariant"], "edits": {}} for p in panels}}}


def write_html(project: dict, output: Path) -> None:
    if output.exists():
        raise ValueError(f"Refusing to overwrite {output}; choose a new output path")
    payload = json.dumps(project, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    html = (ASSETS / "studio.html").read_text(encoding="utf-8")
    html = html.replace("/*__STUDIO_CSS__*/", '\n'.join((ASSETS / name).read_text(encoding="utf-8") for name in ['studio.css', 'rich-text.css', 'workspace-layout.css', 'duplicate-check.css', 'duplicate-viewer.css', 'mobile-ui.css']))
    html = html.replace("/*__STUDIO_JS__*/", '\n'.join((ASSETS / name).read_text(encoding="utf-8") for name in ['rich-text.js', 'workspace-layout.js', 'group-spacing.js', 'mark-style.js', 'tiff-export.js', 'compact-whitespace.js', 'duplicate-review.js', 'duplicate-viewer.js', 'duplicate-check.js', 'mobile-ui.js', 'studio.js']))
    html = html.replace("/*__STUDIO_I18N__*/", (ASSETS / "i18n.js").read_text(encoding="utf-8"))
    html = html.replace("/*__STUDIO_MEMORY__*/", (ASSETS / "memory.js").read_text(encoding="utf-8"))
    html = html.replace("/*__STUDIO_DISCOVERY__*/", (ASSETS / "discovery.js").read_text(encoding="utf-8"))
    html = html.replace("/*__STUDIO_CATALOGUE__*/", (ASSETS / "catalogue.js").read_text(encoding="utf-8-sig"))
    html = html.replace("/*__STUDIO_GALLERY__*/", (ASSETS / "gallery-contracts.js").read_text(encoding="utf-8"))
    html = html.replace("/*__STUDIO_LIBRARY__*/", (ASSETS / "library.js").read_text(encoding="utf-8"))
    html = html.replace("__STUDIO_PROJECT__", payload)
    templates = (ASSETS / "catalogue-previews.json").read_text(encoding="utf-8") if (ASSETS / "catalogue-previews.json").exists() else '{}'
    html = html.replace("__STUDIO_TEMPLATES__", templates.replace('<', '\\u003c'))
    starters = (ASSETS / "template-starters.json").read_text(encoding="utf-8")
    html = html.replace("__STUDIO_STARTERS__", starters.replace('<', '\\u003c'))
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8")


def main(argv=None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("panels", nargs="+", type=Path)
    parser.add_argument("--out", required=True, type=Path, help="New standalone HTML file (never overwrites)")
    parser.add_argument("--title", default="Figure Studio")
    parser.add_argument("--columns", type=int, help="Grid columns: default 1 for one panel, otherwise 2")
    parser.add_argument("--view", help="Initial SVG variant name; must exist in every input panel")
    parser.add_argument("--with-layouts", action="store_true", help="Prepare portrait and wide canvases from supported workbench recipes and verified source data")
    args = parser.parse_args(argv)
    try:
        write_html(build_project(args.panels, args.title, args.columns, args.with_layouts, args.view), args.out)
    except (ValueError, OSError, ET.ParseError) as exc:
        parser.error(str(exc))
    print(f"Figure Studio: {args.out.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Prepare the existing synthetic workbench bars fixture for local browser QA.

Run from a clean checkout with the project's Python dependencies and the recipe's
Arial font installed::

    python scripts/prepare_studio_bars_qa.py --out .cache/bars-qa-new

The output directory must not exist. The 24 observations are the repository's
synthetic Control/Treatment example (12 per group), not scientific validation
data. On Windows only a cache copy restores LF bytes when checkout added CRLF;
the restored bytes must match the original analysis source hash exactly. Source
CSV, original analysis, measurements, group order and templates are not edited.
The result uses the same panel_from_path/render_sizes/inspect_svg_bytes chain as
Figure Studio's existing with-layouts exporter. No template is merely renamed.

public-bars-project.json is the normal generated project with initialState.
QA import helpers may wrap it as {project, state: project.initialState,
checkpoints: []}; this does not add or infer scientific metadata.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def prepare(destination: Path) -> dict:
    destination = destination.resolve()
    if destination.exists():
        raise ValueError("Refusing to overwrite an existing QA output directory")
    original = ROOT / "demo/workbench"
    recipe = json.loads((original / "figure_recipe.json").read_text(encoding="utf-8-sig"))
    analysis = json.loads((original / "analysis_plan.json").read_text(encoding="utf-8-sig"))
    source = (original / recipe["input"].replace("\\", "/")).resolve()
    if not source.is_relative_to(ROOT):
        raise ValueError("The example input must remain inside this repository")
    raw = source.read_bytes()
    # Normalize line endings only in the new cache copy; never rewrite input.
    pinned = raw if digest(raw) == analysis.get("source_sha256") else raw.replace(b"\r\n", b"\n")
    if digest(pinned) != analysis.get("source_sha256"):
        raise ValueError("The example bytes differ from the original analysis hash; regenerate upstream instead")
    if (recipe.get("design") != "independent" or analysis.get("synthetic_example") is not True
            or analysis.get("display_p_value") is not False
            or recipe.get("order") != ["Control", "Treatment"]
            or analysis.get("group_n") != {"Control": 12, "Treatment": 12}):
        raise ValueError("This QA preparation requires the unchanged declared synthetic example")

    sys.path.insert(0, str(ROOT / "skills/polish-sci-figures/scripts"))
    from figure_studio import build_project, inspect_svg_bytes
    from studio_sizes import render_sizes

    destination.mkdir(parents=True, exist_ok=False)
    bundle = destination / "synthetic-bars-bundle-pinned-lf"
    bundle.mkdir()
    (bundle / "data.csv").write_bytes(pinned)
    recipe["input"] = "data.csv"
    (bundle / "figure_recipe.json").write_text(json.dumps(recipe, ensure_ascii=False), encoding="utf-8")
    (bundle / "analysis_plan.json").write_text(json.dumps(analysis, ensure_ascii=False), encoding="utf-8")
    for svg in sorted(original.glob("*.svg")):
        shutil.copyfile(svg, bundle / svg.name)

    project = build_project([bundle], "SYNTHETIC repository example — bar raw points UI QA", columns=1)
    panel = project["panels"][0]
    if panel["table"]["sha256"] != analysis["source_sha256"] or len(panel["table"]["rows"]) != 25:
        raise ValueError("Prepared synthetic table differs from the original 24-observation example")
    outputs = render_sizes(bundle, panel["recipe"], panel["analysis"], panel["variants"],
                           allowed_sizes={"originalBars"})
    if len(outputs) != 1 or outputs[0][:2] != ("bar_raw_points", "original"):
        raise ValueError("The existing renderer did not produce exactly one original-size bar_raw_points variant")
    name, size, svg = outputs[0]
    variant = inspect_svg_bytes(svg, name)
    variant["size"] = size
    if not all(marker in variant["svg"] for marker in ["studio-bar-0", "studio-bar-1"]):
        raise ValueError("The rendered candidate lacks the expected actual bar artists")
    panel["variants"].append(variant)
    selected = len(panel["variants"]) - 1
    panel["initialVariant"] = selected
    panel["recipe"]["studio_view"] = name
    project["initialState"]["panels"][panel["id"]]["variant"] = selected
    project["id"] = digest(json.dumps({"panels": project["panels"], "title": project["title"], "columns": 1},
                                      sort_keys=True, ensure_ascii=False).encode("utf-8"))[:20]
    project_file = destination / "public-bars-project.json"
    project_file.write_text(json.dumps(project, ensure_ascii=False, allow_nan=False, indent=2) + "\n",
                            encoding="utf-8")
    proof = {
        "schema": "figure-studio-synthetic-bars-fixture/1",
        "status": "PREPARED_USING_EXISTING_PRODUCTION_RENDERER",
        "origin": "Repository demo/workbench and synthetic_group_comparison.csv",
        "synthetic": True, "scientificAccuracyEvidence": False,
        "design": "independent (declared synthetic recipe, not inferred)",
        "observations": 24, "groupOrder": recipe["order"],
        "sourceSha256": digest(pinned), "checkoutSourceSha256": digest(raw),
        "cacheOnlyCrLfToLfRestoration": pinned != raw,
        "lineEndingScope": "Only a cache copy may restore LF bytes; they must match the original analysis hash exactly. No input measurement, row, column, original analysis or source CSV is rewritten.",
        "variant": name, "selectedVariantIndex": selected, "variantSha256": variant["sha256"],
        "projectSha256": digest(project_file.read_bytes()),
        "preparation": ["figure_studio.build_project -> panel_from_path",
                        "studio_sizes.render_sizes(allowed_sizes={originalBars})",
                        "figure_studio.inspect_svg_bytes (no template renaming)"],
        "scope": "Synthetic raw-point/mean/95% CI bar-spacing UI engineering fixture. Existing synthetic statistical output reused; browser acceptance is a separate check.",
    }
    (destination / "public-bars-project-provenance.json").write_text(
        json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return proof


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path, help="New QA-only output directory; never overwritten")
    args = parser.parse_args()
    print(json.dumps(prepare(args.out), ensure_ascii=False, indent=2))

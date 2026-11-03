"""Export an existing workbench analysis plan to a local, printable HTML report."""

import argparse
import hashlib
from html import escape
import json
from pathlib import Path

LABELS = {
    "p_value": "<i>P</i> value",
    "pearson_p": "Pearson <i>P</i> value",
    "spearman_p": "Spearman <i>P</i> value",
    "log_rank_p_two_groups": "Two-group log-rank <i>P</i> value",
    "group_n": "Group sample sizes",
    "ci95": "95% CI",
    "degrees_of_freedom": "Degrees of freedom",
}


def render(value):
    if isinstance(value, dict):
        rows = []
        for key, item in value.items():
            label = LABELS.get(key, escape(key.replace("_", " ")))
            rows.append(f"<dt>{label}</dt><dd>{render(item)}</dd>")
        return "<dl>" + "".join(rows) + "</dl>"
    if isinstance(value, list):
        if all(not isinstance(item, (dict, list)) for item in value):
            return ", ".join(render(item) for item in value) or "—"
        return "<ul>" + "".join(f"<li>{render(item)}</li>" for item in value) + "</ul>"
    return "—" if value is None else escape(str(value))


def export_report(source: Path, output: Path) -> None:
    if output.suffix.lower() != ".html":
        raise ValueError("Output must have an .html extension.")
    raw = source.read_bytes()
    analysis = json.loads(raw, parse_constant=lambda _: None)
    if not isinstance(analysis, dict) or not analysis or not any(
        key in analysis for key in ("design", "family", "inference_scope")
    ):
        raise ValueError("Expected a workbench analysis_plan.json.")
    digest = hashlib.sha256(raw).hexdigest()
    preferred = ("family", "design", "scope", "inference_scope", "group_order", "group_n",
                 "complete_pairs", "primary_estimand", "primary_test", "sensitivity_test",
                 "multiplicity", "limitations")
    ordered = {key: analysis[key] for key in preferred if key in analysis}
    ordered.update(analysis)
    synthetic = "<p><strong>Synthetic example</strong></p>" if analysis.get("synthetic_example") is True else ""
    with output.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(
            '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="author" content="a">'
            '<title>Statistical analysis report</title>'
            '<style>body{font:16px system-ui;margin:2rem;overflow-wrap:anywhere}'
            'dt{font-weight:600;margin-top:.45em}dd{margin-inline-start:1.25em}</style>'
            f'<h1>Statistical analysis report</h1>{synthetic}'
            f'<p>Source record {escape(source.name)} · SHA-256 <code>{digest}</code></p>'
            '<p>Reported fields come from the saved analysis plan. '
            'A dash marks an unavailable value.</p>'
            f'{render(ordered)}</html>\n'
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("analysis_plan", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        export_report(args.analysis_plan, args.out)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print(args.out)


if __name__ == "__main__":
    main()

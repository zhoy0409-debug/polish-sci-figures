#!/usr/bin/env python3
"""Runnable coverage and guardrail checks for data_family_workbench.py."""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from data_family_workbench import composition, matrix, recolor, relationship, timecourse


def expect_error(callable_, phrase: str) -> None:
    try:
        callable_()
    except ValueError as exc:
        assert phrase.lower() in str(exc).lower(), str(exc)
    else:
        raise AssertionError(f"Expected ValueError containing: {phrase}")


def verify_bundle(outdir: Path, family: str, expected: set[str]) -> None:
    assert (outdir / "candidate_gallery.png").exists()
    assert (outdir / "data_profile.json").exists()
    analysis = json.loads((outdir / "analysis_plan.json").read_text(encoding="utf-8"))
    recipe = json.loads((outdir / "figure_recipe.json").read_text(encoding="utf-8"))
    assert analysis["family"] == family
    assert recipe["family"] == family
    assert recipe["figsize_inches"] == [4.8, 3.6]
    sizes = set()
    for stem in expected:
        for suffix in (".png", ".svg", ".pdf"):
            path = outdir / f"{stem}{suffix}"
            assert path.exists() and path.stat().st_size > 1000, path
        svg = (outdir / f"{stem}.svg").read_text(encoding="utf-8")
        assert "<text" in svg, f"SVG text was not preserved in {stem}"
        with Image.open(outdir / f"{stem}.png") as image:
            sizes.add(image.size)
    assert len(sizes) == 1, f"Candidate canvases differ: {sizes}"


def main() -> None:
    rng = np.random.default_rng(20260719)
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)

        relationship_csv = root / "synthetic_relationship.csv"
        exposure = np.linspace(1, 12, 24)
        relationship_df = pd.DataFrame(
            {
                "unit": [f"S{i:02d}" for i in range(24)],
                "cohort": ["Discovery"] * 12 + ["Validation"] * 12,
                "exposure": exposure,
                "response": 1.8 * exposure + rng.normal(0, 2.0, 24),
            }
        )
        relationship_df.to_csv(relationship_csv, index=False)
        relationship(
            relationship_csv, "exposure", "response", "unit", root / "relationship", group="cohort"
        )
        verify_bundle(
            root / "relationship",
            "relationship",
            {"relationship_regression", "relationship_joint_distribution"},
        )
        duplicated = relationship_df.copy()
        duplicated.loc[1, "unit"] = duplicated.loc[0, "unit"]
        duplicated_csv = root / "relationship_duplicate.csv"
        duplicated.to_csv(duplicated_csv, index=False)
        expect_error(
            lambda: relationship(
                duplicated_csv, "exposure", "response", "unit", root / "bad_relationship"
            ),
            "one row per biological unit",
        )

        time_csv = root / "synthetic_timecourse.csv"
        rows = []
        for group_name, shift in [("Control", 0.0), ("Treatment", 1.2)]:
            for subject in range(8):
                baseline = rng.normal(8, 0.5)
                for moment in (0, 2, 4, 6):
                    rows.append(
                        {
                            "unit": f"{group_name[0]}{subject:02d}",
                            "group": group_name,
                            "time": moment,
                            "signal": baseline + shift * moment + rng.normal(0, 0.35),
                        }
                    )
        time_df = pd.DataFrame(rows)
        time_df.to_csv(time_csv, index=False)
        timecourse(time_csv, "time", "signal", "group", "unit", root / "timecourse")
        verify_bundle(
            root / "timecourse",
            "timecourse",
            {"timecourse_trajectories", "timecourse_change_from_baseline"},
        )
        time_duplicate = pd.concat([time_df, time_df.iloc[[0]]], ignore_index=True)
        time_duplicate_csv = root / "time_duplicate.csv"
        time_duplicate.to_csv(time_duplicate_csv, index=False)
        expect_error(
            lambda: timecourse(
                time_duplicate_csv, "time", "signal", "group", "unit", root / "bad_time"
            ),
            "only one observation",
        )

        composition_csv = root / "synthetic_composition.csv"
        rows = []
        categories = ["Naive", "Effector", "Memory", "Myeloid"]
        for index in range(10):
            raw = rng.dirichlet([3, 2 + index / 4, 2, 4]) * 1000
            for category_name, count in zip(categories, raw):
                rows.append(
                    {
                        "sample": f"P{index:02d}",
                        "group": "A" if index < 5 else "B",
                        "cell_type": category_name,
                        "count": count,
                    }
                )
        composition_df = pd.DataFrame(rows)
        composition_df.to_csv(composition_csv, index=False)
        composition(
            composition_csv, "sample", "cell_type", "count", root / "composition", group="group"
        )
        verify_bundle(
            root / "composition", "composition", {"composition_stacked", "composition_heatmap"}
        )
        negative = composition_df.copy()
        negative.loc[0, "count"] = -1
        negative_csv = root / "composition_negative.csv"
        negative.to_csv(negative_csv, index=False)
        expect_error(
            lambda: composition(
                negative_csv, "sample", "cell_type", "count", root / "bad_composition"
            ),
            "non-negative",
        )

        matrix_csv = root / "synthetic_matrix.csv"
        matrix_df = pd.DataFrame(
            [
                {
                    "feature": feature,
                    "condition": condition,
                    "z_score": float(rng.normal((i - 2.5) * (j - 1.5) / 3, 0.25)),
                }
                for i, feature in enumerate(["STAT3", "MYC", "BAX", "CASP3", "IFIT1", "CXCL10"])
                for j, condition in enumerate(["Baseline", "Early", "Late", "Recovery"])
            ]
        )
        matrix_df.to_csv(matrix_csv, index=False)
        matrix(matrix_csv, "feature", "condition", "z_score", root / "matrix")
        verify_bundle(root / "matrix", "matrix", {"matrix_heatmap", "matrix_dotmap"})
        recolor(
            root / "matrix" / "figure_recipe.json", root / "matrix_recolored", "okabe_ito", None
        )
        verify_bundle(root / "matrix_recolored", "matrix", {"matrix_heatmap", "matrix_dotmap"})
        original_plan = json.loads(
            (root / "matrix" / "analysis_plan.json").read_text(encoding="utf-8")
        )
        recolored_plan = json.loads(
            (root / "matrix_recolored" / "analysis_plan.json").read_text(encoding="utf-8")
        )
        assert original_plan == recolored_plan, "Palette switching changed the analysis"
        duplicate_cell = pd.concat([matrix_df, matrix_df.iloc[[0]]], ignore_index=True)
        duplicate_cell_csv = root / "matrix_duplicate.csv"
        duplicate_cell.to_csv(duplicate_cell_csv, index=False)
        expect_error(
            lambda: matrix(
                duplicate_cell_csv, "feature", "condition", "z_score", root / "bad_matrix"
            ),
            "cell must be unique",
        )

    print("data_family_workbench: 4 families, recoloring, and validation guards passed")


if __name__ == "__main__":
    main()

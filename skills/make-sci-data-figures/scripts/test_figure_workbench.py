#!/usr/bin/env python3
"""Small dependency-level test; runs without pytest."""

import json
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
import pandas as pd
from PIL import Image, ImageChops

from figure_workbench import generate, welch_anova


def main() -> None:
    f_value, p_value, df1, df2 = welch_anova([
        np.array([1, 2, 3, 4]), np.array([2, 4, 6, 8]), np.array([4, 5, 6, 7])
    ])
    assert np.isclose(f_value, 5.071823204419888)
    assert np.isclose(p_value, 0.054446267078839275)
    assert np.isclose(df1, 2.0) and np.isclose(df2, 5.684210526315789)
    root = Path(__file__).resolve().parents[1]
    source = root / "examples" / "synthetic_group_comparison.csv"
    with TemporaryDirectory() as tmp:
        out = Path(tmp) / "figures"
        pngs = generate(source, "condition", "Response", "independent", out,
                        subject="sample_id", order_text="Control,Treatment", palette_name="zhoy_muted")
        expected = [out / "analysis_plan.json", out / "data_profile.json",
                    out / "figure_recipe.json", out / "candidate_gallery.png"]
        assert len(pngs) == 5, pngs
        assert all(path.exists() and path.stat().st_size > 0 for path in expected + pngs)
        assert (out / "estimation_graphic.svg").is_file()
        assert (out / "raincloud.svg").is_file()
        with Image.open(pngs[0]) as panel, Image.open(out / "candidate_gallery.png") as gallery:
            assert gallery.width == panel.width
            assert gallery.height == panel.height * len(pngs) + 24 * (len(pngs) - 1)
        svg_text = (out / "raw_points_estimate_ci.svg").read_text(encoding="utf-8")
        assert "<text" in svg_text or "<tspan" in svg_text
        assert "width=\"345.6pt\"" in svg_text and "height=\"259.2pt\"" in svg_text
        recolored = Path(tmp) / "recolored"
        generate(source, "condition", "Response", "independent", recolored,
                 subject="sample_id", order_text="Control,Treatment", palette_name="okabe_ito")
        first_analysis = json.loads((out / "analysis_plan.json").read_text(encoding="utf-8"))
        second_analysis = json.loads((recolored / "analysis_plan.json").read_text(encoding="utf-8"))
        assert first_analysis == second_analysis
        assert Image.open(out / "raw_points_estimate_ci.png").size == Image.open(
            recolored / "raw_points_estimate_ci.png"
        ).size
        difference = ImageChops.difference(
            Image.open(out / "raw_points_estimate_ci.png").convert("RGB"),
            Image.open(recolored / "raw_points_estimate_ci.png").convert("RGB"),
        )
        assert difference.getbbox() is not None
        exploratory = json.loads((out / "analysis_plan.json").read_text(encoding="utf-8"))
        assert exploratory["scope"] == "exploratory" and exploratory["display_p_value"] is False

        repeated_unit = pd.read_csv(source)
        repeated_unit.loc[1, "sample_id"] = repeated_unit.loc[0, "sample_id"]
        repeated_source = Path(tmp) / "repeated_unit.csv"
        repeated_unit.to_csv(repeated_source, index=False)
        try:
            generate(repeated_source, "condition", "Response", "independent", Path(tmp) / "bad_independent",
                     subject="sample_id", order_text="Control,Treatment")
        except ValueError as exc:
            assert "repeated experimental-unit IDs" in str(exc)
        else:
            raise AssertionError("Pseudoreplicated unit IDs were silently treated as independent")

        paired_source = Path(tmp) / "paired.csv"
        pd.DataFrame({
            "subject": ["S1", "S1", "S2", "S2", "S3", "S3", "S4", "S4"],
            "condition": ["Before", "After"] * 4,
            "response": [5.0, 6.0, 5.5, 6.1, 4.8, 5.9, 5.3, 6.4],
        }).to_csv(paired_source, index=False)
        paired_out = Path(tmp) / "paired"
        generate(paired_source, "condition", "response", "paired", paired_out,
                 subject="subject", order_text="Before,After")
        assert (paired_out / "paired_estimation.svg").is_file()
        assert (paired_out / "paired_trajectories.svg").is_file()
        duplicate_source = Path(tmp) / "paired_duplicate.csv"
        duplicate = pd.read_csv(paired_source)
        pd.concat([duplicate, duplicate.iloc[[0]]], ignore_index=True).to_csv(duplicate_source, index=False)
        try:
            generate(duplicate_source, "condition", "response", "paired", Path(tmp) / "bad_paired",
                     subject="subject", order_text="Before,After")
        except ValueError as exc:
            assert "multiple rows for the same subject and group" in str(exc)
        else:
            raise AssertionError("Ambiguous technical/repeated rows were silently pooled")

        multigroup_source = root / "examples" / "synthetic_multigroup_response.csv"
        multigroup_out = Path(tmp) / "multigroup"
        multi_pngs = generate(
            multigroup_source, "condition", "Response", "independent", multigroup_out,
            subject="sample_id", order_text="Vehicle,Low dose,Mid dose,High dose",
        )
        assert len(multi_pngs) == 5
        assert (multigroup_out / "group_estimate_forest.svg").is_file()
        multi_analysis = json.loads((multigroup_out / "analysis_plan.json").read_text(encoding="utf-8"))
        assert multi_analysis["primary_test"]["name"] == "Welch one-way ANOVA"
        assert multi_analysis["multiplicity"] == "No pairwise family was tested by this workbench."
    print("make-sci-data-figures self-check passed")


if __name__ == "__main__":
    main()

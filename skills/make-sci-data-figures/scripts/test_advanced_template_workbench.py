#!/usr/bin/env python3
"""Runnable coverage for every advanced template family and its publication bundle."""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from advanced_template_workbench import (
    aligned_series,
    confusion,
    cumulative,
    diverging,
    dose_response,
    embedding,
    enrichment,
    feature_rank,
    forest,
    recolor,
    roc,
    survival,
    swimmer,
    volcano,
)


def write(root: Path, name: str, frame: pd.DataFrame) -> Path:
    path = root / f"synthetic_{name}.csv"
    frame.to_csv(path, index=False)
    return path


def verify(outdir: Path, family: str, stems: set[str]) -> None:
    assert (outdir / "candidate_gallery.png").exists()
    assert (
        json.loads((outdir / "analysis_plan.json").read_text(encoding="utf-8"))[
            "family"
        ]
        == family
    )
    recipe = json.loads((outdir / "figure_recipe.json").read_text(encoding="utf-8"))
    assert recipe["figsize_inches"] == [4.8, 3.6]
    sizes = set()
    for stem in stems:
        for suffix in (".png", ".svg", ".pdf"):
            path = outdir / f"{stem}{suffix}"
            assert path.exists() and path.stat().st_size > 900, path
        assert "<text" in (outdir / f"{stem}.svg").read_text(encoding="utf-8")
        with Image.open(outdir / f"{stem}.png") as image:
            sizes.add(image.size)
    assert len(sizes) == 1, sizes


def main() -> None:
    rng = np.random.default_rng(20260719)
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)

        terms = [f"Feature {index}" for index in range(1, 9)]
        estimates = np.linspace(0.55, 1.8, 8)
        path = write(
            root,
            "forest",
            pd.DataFrame(
                {
                    "term": terms,
                    "estimate": estimates,
                    "low": estimates * 0.78,
                    "high": estimates * 1.25,
                    "domain": ["Clinical"] * 4 + ["Molecular"] * 4,
                }
            ),
        )
        forest(
            path, "term", "estimate", "low", "high", root / "forest", "domain", "log"
        )
        verify(
            root / "forest", "forest", {"forest_intervals", "forest_reference_linked"}
        )

        effects = rng.normal(0, 1.5, 160)
        pvalues = np.clip(
            np.exp(-np.abs(effects) * 2.2) * rng.uniform(0.001, 0.2, 160), 1e-8, 1
        )
        path = write(
            root,
            "volcano",
            pd.DataFrame(
                {
                    "gene": [f"G{i}" for i in range(160)],
                    "log2FC": effects,
                    "padj": pvalues,
                }
            ),
        )
        volcano(path, "gene", "log2FC", "padj", root / "volcano")
        verify(root / "volcano", "volcano", {"volcano", "volcano_ranked_hits"})

        observed = np.tile(["A", "B", "C"], 18)
        predicted = observed.copy()
        predicted[::8] = np.roll(predicted[::8], 1)
        path = write(
            root,
            "confusion",
            pd.DataFrame(
                {
                    "unit": [f"U{i}" for i in range(54)],
                    "observed": observed,
                    "predicted": predicted,
                }
            ),
        )
        confusion(path, "observed", "predicted", "unit", root / "confusion")
        verify(
            root / "confusion",
            "confusion-matrix",
            {"confusion_counts", "confusion_row_normalized"},
        )

        path = write(
            root,
            "enrichment",
            pd.DataFrame(
                {
                    "term": [f"Pathway {i}" for i in range(12)],
                    "effect": rng.uniform(0.4, 2.5, 12),
                    "padj": np.geomspace(1e-5, 0.04, 12),
                    "count": rng.integers(5, 60, 12),
                    "category": ["GO", "KEGG"] * 6,
                }
            ),
        )
        enrichment(
            path, "term", "effect", "padj", "count", root / "enrichment", "category", 10
        )
        verify(
            root / "enrichment",
            "enrichment",
            {"enrichment_bubble", "enrichment_lollipop"},
        )

        rows = []
        for group, hazard in [("Control", 0.055), ("Treatment", 0.032)]:
            times = np.minimum(rng.exponential(1 / hazard, 32), 36)
            for index, follow in enumerate(times):
                rows.append(
                    {
                        "unit": f"{group[0]}{index:02d}",
                        "time": follow,
                        "event": int(follow < 36),
                        "group": group,
                    }
                )
        path = write(root, "survival", pd.DataFrame(rows))
        survival(path, "time", "event", "group", "unit", root / "survival")
        verify(
            root / "survival", "survival", {"kaplan_meier", "kaplan_meier_risk_table"}
        )

        rows = []
        for group, midpoint in [("Drug A", 0.7), ("Drug B", 1.8)]:
            for dose in np.logspace(-2, 1.2, 8):
                for replicate in range(2):
                    response = (
                        5 + 95 / (1 + (dose / midpoint) ** 1.4) + rng.normal(0, 2)
                    )
                    rows.append(
                        {
                            "unit": f"{group}-{dose:.3g}-{replicate}",
                            "dose": dose,
                            "response": response,
                            "group": group,
                        }
                    )
        path = write(root, "dose", pd.DataFrame(rows))
        dose_response(path, "dose", "response", "group", root / "dose", "unit")
        verify(
            root / "dose", "dose-response", {"dose_response", "dose_response_residuals"}
        )

        outcome = rng.integers(0, 2, 90)
        score = np.clip(0.18 + 0.62 * outcome + rng.normal(0, 0.22, 90), 0, 1)
        path = write(
            root,
            "roc",
            pd.DataFrame(
                {
                    "unit": [f"P{i}" for i in range(90)],
                    "outcome": outcome,
                    "score": score,
                    "cohort": ["Discovery"] * 45 + ["Validation"] * 45,
                }
            ),
        )
        roc(path, "outcome", "score", "unit", root / "roc", cohort="cohort")
        verify(root / "roc", "roc", {"roc", "precision_recall"})

        values = rng.normal(0, 1, 18)
        path = write(
            root,
            "features",
            pd.DataFrame(
                {
                    "feature": [f"Marker {i}" for i in range(18)],
                    "value": values,
                    "low": values - 0.25,
                    "high": values + 0.25,
                }
            ),
        )
        feature_rank(path, "feature", "value", root / "features", "low", "high", top=14)
        verify(
            root / "features",
            "feature-rank",
            {"feature_lollipop", "feature_interval_rank"},
        )

        coordinates = []
        for group, center in [
            ("State 1", (-2, 0)),
            ("State 2", (1.8, 1.4)),
            ("State 3", (1, -2)),
        ]:
            points = rng.normal(center, (0.55, 0.45), (45, 2))
            coordinates.extend({"x": x, "y": y, "state": group} for x, y in points)
        path = write(root, "embedding", pd.DataFrame(coordinates))
        embedding(path, "x", "y", "state", root / "embedding")
        verify(
            root / "embedding", "embedding", {"embedding_groups", "embedding_centroids"}
        )

        path = write(
            root,
            "aligned",
            pd.DataFrame(
                {
                    "time": np.arange(10),
                    "signal": np.linspace(2, 8, 10) + rng.normal(0, 0.3, 10),
                    "temperature": np.linspace(28, 21, 10) + rng.normal(0, 0.4, 10),
                }
            ),
        )
        aligned_series(path, "time", "signal", "temperature", root / "aligned")
        verify(
            root / "aligned",
            "aligned-series",
            {"aligned_series", "standardized_overlay"},
        )

        path = write(
            root,
            "diverging",
            pd.DataFrame(
                {
                    "item": terms,
                    "effect": np.array([-2.1, -1.4, -0.8, -0.3, 0.4, 0.9, 1.5, 2.2]),
                }
            ),
        )
        diverging(path, "item", "effect", root / "diverging")
        verify(
            root / "diverging",
            "diverging-comparison",
            {"diverging_bars", "diverging_lollipop"},
        )

        path = write(
            root,
            "cumulative",
            pd.DataFrame(
                {
                    "unit": [f"E{i}" for i in range(60)],
                    "value": np.r_[rng.normal(0, 1, 30), rng.normal(1, 1.1, 30)],
                    "group": ["Control"] * 30 + ["Treatment"] * 30,
                }
            ),
        )
        cumulative(path, "value", "group", "unit", root / "cumulative")
        verify(
            root / "cumulative",
            "cumulative-distribution",
            {"ecdf", "complementary_ecdf"},
        )

        starts = np.zeros(12)
        ends = rng.uniform(5, 24, 12)
        path = write(
            root,
            "swimmer",
            pd.DataFrame(
                {
                    "unit": [f"Case {i}" for i in range(12)],
                    "start": starts,
                    "end": ends,
                    "event_time": ends * rng.uniform(0.25, 0.8, 12),
                    "status": ["event", "ongoing"] * 6,
                    "arm": ["A"] * 6 + ["B"] * 6,
                }
            ),
        )
        swimmer(
            path,
            "unit",
            "start",
            "end",
            "status",
            root / "swimmer",
            "event_time",
            "arm",
        )
        verify(root / "swimmer", "swimmer", {"swimmer", "swimmer_duration"})

        recolor(
            root / "roc" / "figure_recipe.json",
            root / "roc_recolored",
            "okabe_ito",
            None,
        )
        verify(root / "roc_recolored", "roc", {"roc", "precision_recall"})

    print("advanced template workbench checks passed")


if __name__ == "__main__":
    main()

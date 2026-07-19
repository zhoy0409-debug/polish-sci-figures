#!/usr/bin/env python3
"""Generate deterministic raw-data examples for every data-family workflow."""

from pathlib import Path

import numpy as np
import pandas as pd

SEED = 20260719
OUTDIR = Path(__file__).resolve().parent


def main() -> None:
    rng = np.random.default_rng(SEED)

    rows = []
    for cohort, intercept, slope in [("Discovery", 5.0, 1.65), ("Validation", 7.0, 1.35)]:
        exposure = np.linspace(1.2, 11.8, 18) + rng.normal(0, 0.28, 18)
        response = intercept + slope * exposure + rng.normal(0, 1.7, 18)
        rows.extend(
            {
                "unit": f"{cohort[0]}{index:02d}",
                "cohort": cohort,
                "exposure": round(float(x), 4),
                "response": round(float(y), 4),
            }
            for index, (x, y) in enumerate(zip(exposure, response), start=1)
        )
    pd.DataFrame(rows).to_csv(OUTDIR / "synthetic_relationship.csv", index=False)

    rows = []
    for group, effect in [("Vehicle", 0.08), ("CX-17", 0.72)]:
        for index in range(10):
            baseline = rng.normal(8.2, 0.55)
            subject_slope = effect + rng.normal(0, 0.09)
            for day in (0, 2, 4, 7, 10):
                value = baseline + subject_slope * day + rng.normal(0, 0.33)
                rows.append(
                    {
                        "unit": f"{group[0]}{index:02d}",
                        "group": group,
                        "day": day,
                        "signal": round(float(value), 4),
                    }
                )
    pd.DataFrame(rows).to_csv(OUTDIR / "synthetic_timecourse.csv", index=False)

    rows = []
    cell_types = ["CD8 T", "CD4 T", "NK", "Myeloid", "B cell"]
    for index in range(12):
        group = "Baseline" if index < 6 else "On-treatment"
        concentration = (
            [4.5, 3.0, 1.8, 4.0, 2.2] if group == "Baseline" else [6.0, 2.6, 3.6, 2.4, 2.0]
        )
        counts = rng.dirichlet(concentration) * rng.integers(1800, 4200)
        for cell_type, count in zip(cell_types, counts):
            rows.append(
                {
                    "sample": f"P{index + 1:02d}",
                    "group": group,
                    "cell_type": cell_type,
                    "count": round(float(count), 2),
                }
            )
    pd.DataFrame(rows).to_csv(OUTDIR / "synthetic_composition.csv", index=False)

    pathways = [
        "IFN response",
        "Apoptosis",
        "Cell cycle",
        "Hypoxia",
        "EMT",
        "DNA repair",
        "T-cell activation",
        "Oxidative stress",
    ]
    conditions = ["Baseline", "2 h", "8 h", "24 h", "72 h", "Recovery"]
    row_latent = np.array([-1.4, 1.1, 0.8, -0.9, -0.5, 0.55, -1.2, 0.35])
    col_latent = np.array([-1.0, -0.45, 0.15, 0.75, 1.1, 0.35])
    rows = []
    for row_index, pathway in enumerate(pathways):
        for column_index, condition in enumerate(conditions):
            value = row_latent[row_index] * col_latent[column_index] + rng.normal(0, 0.22)
            rows.append(
                {"pathway": pathway, "condition": condition, "z_score": round(float(value), 4)}
            )
    pd.DataFrame(rows).to_csv(OUTDIR / "synthetic_matrix.csv", index=False)

    print("Wrote four deterministic scientific data-family examples")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Create deterministic synthetic inputs for advanced template examples."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def generate(outdir: Path) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(20260720)

    survival_rows = []
    for group, hazard in (("Control", 0.057), ("Treatment", 0.031)):
        times = np.minimum(rng.exponential(1 / hazard, 42), 36)
        for index, follow_up in enumerate(times):
            survival_rows.append(
                {
                    "unit": f"{group[0]}{index:02d}",
                    "time_months": follow_up,
                    "event": int(follow_up < 36),
                    "group": group,
                }
            )
    pd.DataFrame(survival_rows).to_csv(outdir / "synthetic_survival.csv", index=False)

    dose_rows = []
    for group, midpoint in (("Compound A", 0.55), ("Compound B", 1.6)):
        for dose in np.logspace(-2, 1.2, 10):
            for replicate in range(3):
                response = 4 + 96 / (1 + (dose / midpoint) ** 1.45)
                dose_rows.append(
                    {
                        "unit": f"{group}-{dose:.4g}-{replicate}",
                        "Dose (µM)": dose,
                        "Viability (%)": response + rng.normal(0, 2.0),
                        "compound": group,
                    }
                )
    pd.DataFrame(dose_rows).to_csv(outdir / "synthetic_dose_response.csv", index=False)

    outcome = rng.integers(0, 2, 120)
    discovery_score = 0.5 + 0.36 * (outcome[:60] - 0.5) + rng.normal(0, 0.25, 60)
    validation_score = 0.5 + 0.3 * (outcome[60:] - 0.5) + rng.normal(0, 0.28, 60)
    score = np.clip(np.r_[discovery_score, validation_score], 0, 1)
    pd.DataFrame(
        {
            "unit": [f"P{index:03d}" for index in range(120)],
            "outcome": outcome,
            "score": score,
            "cohort": ["Discovery"] * 60 + ["Validation"] * 60,
        }
    ).to_csv(outdir / "synthetic_roc.csv", index=False)

    effects = rng.uniform(0.45, 2.4, 14)
    pd.DataFrame(
        {
            "term": [f"Pathway {index + 1}" for index in range(14)],
            "enrichment_ratio": effects,
            "adjusted_p": np.geomspace(2e-6, 0.04, 14),
            "count": rng.integers(8, 70, 14),
            "ontology": ["GO", "KEGG"] * 7,
        }
    ).to_csv(outdir / "synthetic_enrichment.csv", index=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--outdir", default=str(Path(__file__).resolve().parent))
    args = parser.parse_args()
    generate(Path(args.outdir))


if __name__ == "__main__":
    main()

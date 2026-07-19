#!/usr/bin/env python3
"""Create deterministic synthetic images for documentation and tests."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image, ImageFilter


def synthetic_field(seed: int, width: int, height: int, shift: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    field = np.zeros((height, width), dtype=float)
    yy, xx = np.mgrid[:height, :width]
    for _ in range(38 + shift):
        cx = rng.uniform(10, width - 10)
        cy = rng.uniform(10, height - 10)
        sigma = rng.uniform(1.8, 4.2)
        amplitude = rng.uniform(90, 220)
        field += amplitude * np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * sigma**2))
    field += rng.normal(8, 3, field.shape)
    image = Image.fromarray(np.clip(field, 0, 255).astype(np.uint8), "L")
    return image.filter(ImageFilter.GaussianBlur(radius=0.45))


def create(outdir: Path) -> Path:
    outdir.mkdir(parents=True, exist_ok=True)
    rows = []
    specs = [("control_1", 520, 390, 11, 0), ("control_2", 500, 400, 12, 2),
             ("treated_1", 510, 395, 21, 12), ("treated_2", 530, 405, 22, 15)]
    for name, width, height, seed, shift in specs:
        path = outdir / f"{name}.png"
        synthetic_field(seed, width, height, shift).save(path)
        rows.append({
            "file": path.name, "output_name": name, "batch": "synthetic_batch",
            "um_per_pixel": 0.25, "display_min": 5, "display_max": 210,
            "gamma": 1.0, "lut": "magenta", "label": "",
        })
    manifest = outdir / "manifest.csv"
    pd.DataFrame(rows).to_csv(manifest, index=False)
    return manifest


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--outdir", required=True)
    args = p.parse_args()
    manifest = create(Path(args.outdir))
    print(manifest.resolve())


if __name__ == "__main__":
    main()

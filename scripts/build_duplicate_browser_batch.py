"""Export the deterministic 60-image speed fixture for real-browser acceptance.

This reuses the exact engineering-test raster generator and benchmark seeds.
It contains no real or private images and is not a detector accuracy dataset.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from test_image_duplicates import raster


def build(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    images = []
    hashes = {}
    for seed in range(700, 760):
        name = f"synthetic-{seed}.png"
        target = out / name
        raster(seed).save(target)
        images.append(name)
        hashes[name] = hashlib.sha256(target.read_bytes()).hexdigest()
    record = {"kind": "synthetic_engineering_demo", "seeds": [700, 759],
              "size": [480, 360], "pairs": 1770, "images": images,
              "sha256": hashes, "generator": "scripts/test_image_duplicates.py:raster()",
              "limitation": "Synthetic UI/speed fixture; not real-image accuracy evidence"}
    (out / "manifest.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(f"Created 60 synthetic images / 1,770 pairs at {out}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path,
                        default=Path(__file__).resolve().parents[1] / ".cache/round2-validation/browser-batch-60")
    build(parser.parse_args().out)

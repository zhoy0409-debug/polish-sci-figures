#!/usr/bin/env python3
"""Small dependency-level test; runs without pytest."""

from pathlib import Path
from tempfile import TemporaryDirectory

import pandas as pd
import numpy as np
from PIL import Image

from make_example_data import create
from standardize_images import sha256, standardize


def main() -> None:
    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        manifest = create(root / "inputs")
        sources = list((root / "inputs").glob("*.png"))
        before = {path: sha256(path) for path in sources}
        records = standardize(manifest, root / "outputs", scale_bar_um=20)
        assert len(records) == 4
        assert all(record["output_width"] == 500 and record["output_height"] == 390 for record in records)
        assert all(record["scale_bar"]["scale_bar_pixels"] == 80 for record in records)
        assert all(record["scale_bar"]["font_size_pixels"] >= 26 for record in records)
        for record in records:
            bar = record["scale_bar"]
            label_center = (bar["scale_bar_label_box"][0] + bar["scale_bar_label_box"][2]) / 2
            bar_center = (bar["scale_bar_box"][0] + bar["scale_bar_box"][2]) / 2
            assert abs(label_center - bar_center) < 1e-6
            assert bar["scale_bar_label_alignment"] == "centered_over_scale_bar"
        assert all(abs(record["effective_raster_dpi_at_panel_size"] - 300) < 1e-6 for record in records)
        assert all(sha256(path) == before[path] for path in sources)
        outputs = list((root / "outputs").glob("*.png"))
        assert len(outputs) == 9  # display + preview for four panels, plus montage
        panel_sizes = {Image.open(path).size for path in outputs if path.name != "montage.png"}
        assert panel_sizes == {(500, 390)}
        svgs = list((root / "outputs").glob("*.svg"))
        assert len(svgs) == 4
        svg = svgs[0].read_text(encoding="utf-8")
        assert '<image id="display-raster"' in svg
        assert '<rect id="scale-bar"' in svg
        assert '<text id="scale-bar-label"' in svg
        assert (root / "outputs" / "image_audit.csv").is_file()
        assert (root / "outputs" / "image_audit.json").is_file()

        invalid = pd.read_csv(manifest)
        invalid.loc[1, "display_max"] = 180
        invalid_manifest = root / "inputs" / "invalid_manifest.csv"
        invalid.to_csv(invalid_manifest, index=False)
        try:
            standardize(invalid_manifest, root / "invalid_outputs", scale_bar_um=20)
        except ValueError as exc:
            assert "mixed display_max" in str(exc)
        else:
            raise AssertionError("Mixed within-batch display settings were not rejected")

        high_bit = (np.arange(120 * 160, dtype=np.uint16).reshape(120, 160) % 4096)
        high_path = root / "inputs" / "high_bit.tif"
        Image.fromarray(high_bit, mode="I;16").save(high_path)
        high_manifest = root / "inputs" / "high_manifest.csv"
        pd.DataFrame([{
            "file": high_path.name, "output_name": "high", "batch": "high_batch",
            "um_per_pixel": 0.5, "display_min": 100, "display_max": 4000,
            "gamma": 1.0, "lut": "gray",
        }]).to_csv(high_manifest, index=False)
        high_records = standardize(high_manifest, root / "high_outputs", scale_bar_um=10)
        assert high_records[0]["source_mode"] in {"I;16", "I"}
        missing_window = pd.read_csv(high_manifest).drop(columns=["display_min", "display_max"])
        missing_manifest = root / "inputs" / "high_missing_window.csv"
        missing_window.to_csv(missing_manifest, index=False)
        try:
            standardize(missing_manifest, root / "high_invalid", scale_bar_um=10)
        except ValueError as exc:
            assert "require explicit batch-locked display_min and display_max" in str(exc)
        else:
            raise AssertionError("Higher-bit-depth data were silently truncated without a display window")

        try:
            standardize(manifest, root / "too_wide", scale_bar_um=20, panel_width_mm=100)
        except ValueError as exc:
            assert "pixels will not be invented" in str(exc)
        else:
            raise AssertionError("An under-resolution final panel was accepted")
    print("standardize-sci-images self-check passed")


if __name__ == "__main__":
    main()

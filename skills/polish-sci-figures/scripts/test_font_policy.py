#!/usr/bin/env python3
"""Regression checks for strict target-font handling across the suite."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import pandas as pd
from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "skills" / "make-sci-data-figures" / "scripts"))
sys.path.insert(0, str(ROOT / "skills" / "standardize-sci-images" / "scripts"))

from figure_workbench import generate, read_table, resolve_font  # noqa: E402
from standardize_images import standardize  # noqa: E402


KNOWN_FONT = "DejaVu Sans"
MISSING_FONT = "Definitely Missing Scientific Font 130"


def expect_value_error(callable_, phrase: str) -> None:
    try:
        callable_()
    except ValueError as exc:
        assert phrase.lower() in str(exc).lower(), str(exc)
    else:
        raise AssertionError(f"Expected ValueError containing {phrase!r}")


def write_group_data(path: Path) -> None:
    frame = pd.DataFrame({
        "sample": [f"C{i}" for i in range(4)] + [f"T{i}" for i in range(4)],
        "condition": ["Control"] * 4 + ["Treatment"] * 4,
        "response": [1.0, 1.1, 0.9, 1.2, 2.0, 2.2, 1.8, 2.1],
    })
    frame.to_csv(path, index=False)


def write_image_manifest(root: Path) -> Path:
    image = Image.new("L", (120, 90), color=110)
    image_path = root / "source.png"
    image.save(image_path)
    manifest = root / "manifest.csv"
    pd.DataFrame([{
        "file": image_path.name,
        "output_name": "panel",
        "um_per_pixel": 0.5,
    }]).to_csv(manifest, index=False)
    return manifest


def main() -> None:
    actual, path, fallback, final_ok = resolve_font(KNOWN_FONT)
    assert actual == KNOWN_FONT
    assert path and fallback is False and final_ok is True

    expect_value_error(lambda: resolve_font(MISSING_FONT), "required font")
    actual, path, fallback, final_ok = resolve_font(MISSING_FONT, allow_fallback=True)
    assert actual == KNOWN_FONT and path and fallback is True and final_ok is False

    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        data = root / "data.csv"
        write_group_data(data)
        expect_value_error(
            lambda: generate(
                data, "condition", "response", "independent", root / "no_font",
                subject="sample", order_text="Control,Treatment",
                font_requested=MISSING_FONT,
            ),
            "required font",
        )
        generate(
            data, "condition", "response", "independent", root / "fallback",
            subject="sample", order_text="Control,Treatment",
            font_requested=MISSING_FONT,
            allow_font_fallback=True,
        )
        analysis = json.loads((root / "fallback" / "analysis_plan.json").read_text(encoding="utf-8"))
        assert analysis["font"]["requested"] == MISSING_FONT
        assert analysis["font"]["actual"] == KNOWN_FONT
        assert analysis["font"]["fallback"] is True
        assert analysis["font"]["final_delivery_allowed"] is False

        manifest = write_image_manifest(root)
        expect_value_error(
            lambda: standardize(manifest, root / "image_no_font", scale_bar_um=10, font=MISSING_FONT),
            "required font",
        )
        records = standardize(
            manifest, root / "image_fallback", scale_bar_um=10,
            font=MISSING_FONT, allow_font_fallback=True,
        )
        assert records[0]["font"]["requested"] == MISSING_FONT
        assert records[0]["font"]["actual"] == KNOWN_FONT
        assert records[0]["font"]["fallback"] is True
        assert records[0]["font"]["final_delivery_allowed"] is False

        expect_value_error(lambda: read_table(root / "legacy.xls"), "legacy .xls")

    print("font policy checks passed")


if __name__ == "__main__":
    main()

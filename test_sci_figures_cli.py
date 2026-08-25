#!/usr/bin/env python3
"""Smoke tests for the unified sci_figures.py CLI."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import pandas as pd


ROOT = Path(__file__).resolve().parent
CLI = ROOT / "sci_figures.py"
PYTHON = sys.executable


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    completed = subprocess.run(
        [PYTHON, str(CLI), *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if check and completed.returncode != 0:
        raise AssertionError(completed.stdout)
    return completed


def main() -> None:
    for args in (
        ("--help",),
        ("doctor", "--help"),
        ("inspect", "--help"),
        ("route", "--help"),
        ("qa", "--help"),
    ):
        assert "usage:" in run(*args).stdout.lower()

    assert run("doctor", "--font", "DejaVu Sans").returncode == 0

    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        frame = pd.DataFrame({
            "sample_id": [f"C{i}" for i in range(4)] + [f"T{i}" for i in range(4)],
            "condition": ["Control"] * 4 + ["Treatment"] * 4,
            "response": [1.0, 1.1, 0.9, 1.2, 2.0, 2.2, 1.8, 2.1],
        })
        csv = root / "data.csv"
        xlsx = root / "data.xlsx"
        frame.to_csv(csv, index=False)
        frame.to_excel(xlsx, index=False)

        inspected = run("inspect", str(csv), "--json").stdout
        payload = json.loads(inspected)
        assert "group-comparison" in payload["candidate_structures"]
        assert payload["duplicate_rows"] == 0

        inspected_xlsx = run("inspect", str(xlsx), "--json").stdout
        assert json.loads(inspected_xlsx)["rows"] == len(frame)

        routed = run("route", str(csv)).stdout
        assert "figure_workbench.py generate" in routed

        svg = root / "figure.svg"
        svg.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="30mm" '
            'viewBox="0 0 500 300"><text x="20" y="20" fill="#000000">Live text</text>'
            '<path fill="#0072B2" d="M20 40h80v40h-80z"/></svg>',
            encoding="utf-8",
        )
        assert run("qa", str(svg)).returncode == 0

    print("sci_figures.py CLI smoke tests passed")


if __name__ == "__main__":
    main()

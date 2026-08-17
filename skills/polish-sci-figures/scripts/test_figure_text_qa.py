#!/usr/bin/env python3
"""Regression checks for Matplotlib missing-glyph warning detection."""

from __future__ import annotations

import warnings

from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.figure import Figure

from figure_text_qa import MISSING_GLYPH, audit_figure_text


OLD_WARNING = "Glyph 20013 missing from current font"
NEW_WARNING = "Glyph 20013 (\\N{CJK UNIFIED IDEOGRAPH-4E2D}) missing from font(s) Arial"


def audit_emitted_warning(message: str) -> list[str]:
    fig = Figure(figsize=(1, 1))
    canvas = FigureCanvasAgg(fig)
    canvas.draw()

    def emit_warning() -> None:
        warnings.warn(message, UserWarning, stacklevel=2)

    canvas.draw = emit_warning
    return audit_figure_text(fig, [], require_aligned_grid=False)


def main() -> None:
    assert MISSING_GLYPH.search(OLD_WARNING)
    assert MISSING_GLYPH.search(NEW_WARNING)
    for message in (OLD_WARNING, NEW_WARNING):
        issues = audit_emitted_warning(message)
        assert any("font lacks a required glyph" in issue for issue in issues), issues

    unrelated = "renderer emitted an unrelated warning"
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        issues = audit_emitted_warning(unrelated)
    assert not issues
    assert any(unrelated in str(item.message) for item in caught)

    with warnings.catch_warnings():
        warnings.simplefilter("error", UserWarning)
        try:
            audit_emitted_warning(unrelated)
        except UserWarning as exc:
            assert unrelated in str(exc)
        else:
            raise AssertionError("an unrelated renderer warning was swallowed")

    print("figure_text_qa missing-glyph regression checks passed")


if __name__ == "__main__":
    main()

"""Fail fast on titles, text collisions, clipping, and scientific typography."""
from __future__ import annotations

from collections.abc import Iterable
import warnings

from matplotlib.axes import Axes
from matplotlib.figure import Figure
from matplotlib.text import Text


FORBIDDEN_TEXT = (
    "IC50", "EC50", "ED50", "LD50", "log2", "log10", "CO2",
    "cm^2", " x 10", "10^-", "P =", "p =", "r =", "AUC=",
)


def audit_figure_text(
    fig: Figure,
    axes: Iterable[Axes] | None = None,
    *,
    allow_panel_titles: bool = False,
) -> list[str]:
    """Return title and notation failures found in a Matplotlib figure."""
    issues: list[str] = []
    checked_axes = list(fig.axes if axes is None else axes)

    with warnings.catch_warnings():
        warnings.filterwarnings(
            "error", message=r"Glyph .* missing from current font",
            category=UserWarning,
        )
        try:
            fig.canvas.draw()
        except UserWarning as exc:
            issues.append(f"font lacks a required scientific glyph: {exc}")

    renderer = fig.canvas.get_renderer()
    figure_box = fig.bbox
    tick_labels = {
        text for ax in fig.axes
        for text in (*ax.get_xticklabels(), *ax.get_yticklabels())
    }
    visible_text: list[tuple[Text, object]] = []
    for text in fig.findobj(Text):
        if text in tick_labels or not text.get_visible() or not text.get_text():
            continue
        box = text.get_window_extent(renderer)
        visible_text.append((text, box.padded(-1)))
        if (box.x0 < figure_box.x0 - 1 or box.y0 < figure_box.y0 - 1
                or box.x1 > figure_box.x1 + 1 or box.y1 > figure_box.y1 + 1):
            issues.append(f"text is clipped by the canvas: {text.get_text()!r}")

    rendered_ticks: list[Text] = []
    for ax in fig.axes:
        x0, x1 = sorted(ax.get_xlim())
        y0, y1 = sorted(ax.get_ylim())
        rendered_ticks.extend(
            text for text in ax.get_xticklabels()
            if text.get_visible() and text.get_text()
            and x0 <= text.get_position()[0] <= x1
        )
        rendered_ticks.extend(
            text for text in ax.get_yticklabels()
            if text.get_visible() and text.get_text()
            and y0 <= text.get_position()[1] <= y1
        )
    visible_text.extend(
        (text, text.get_window_extent(renderer).padded(-1))
        for text in rendered_ticks
    )
    for index, (first, first_box) in enumerate(visible_text):
        for second, second_box in visible_text[index + 1:]:
            if first_box.overlaps(second_box):
                issues.append(
                    f"text collision: {first.get_text()!r} with {second.get_text()!r}"
                )

    if not allow_panel_titles:
        for index, ax in enumerate(checked_axes, start=1):
            title = ax.get_title().strip()
            if title:
                issues.append(f"panel {index} contains a forbidden title: {title!r}")
        if fig._suptitle is not None and fig._suptitle.get_text().strip():
            issues.append("figure contains a forbidden internal title")

    for text in fig.findobj(Text):
        value = text.get_text()
        for token in FORBIDDEN_TEXT:
            if token in value:
                issues.append(f"replace {token!r} with publication notation in {value!r}")
        if (text.get_fontstyle() in {"italic", "oblique"}
                and any(token in value for token in ("P ", "p ", "r "))):
            issues.append(f"do not italicize the whole statistical annotation {value!r}")

    return list(dict.fromkeys(issues))


def assert_figure_text_qa(
    fig: Figure,
    axes: Iterable[Axes] | None = None,
    *,
    allow_panel_titles: bool = False,
) -> None:
    """Raise when a figure fails the title or typography release gate."""
    issues = audit_figure_text(
        fig, axes, allow_panel_titles=allow_panel_titles,
    )
    if issues:
        raise AssertionError("\n".join(issues))

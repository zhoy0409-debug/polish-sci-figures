"""Add panel labels on a shared grid so same-row labels share a y position
and same-column labels share an x position.

Panel-label misalignment is the single most common release blocker for
multi-panel figures. Placing labels by hand per-axes drifts; this module
anchors every label in figure coordinates relative to each axis's bounding
box, so alignment is mathematical rather than eyeballed.

Usage
-----
    import matplotlib.pyplot as plt
    from panel_labels import add_panel_labels

    fig, axs = plt.subplots(2, 2)
    add_panel_labels(fig, axs.ravel(), style="(a)")

You can also pass explicit axes in reading order, or a dict mapping a label
string to an axis for full control.
"""
from __future__ import annotations

import string
from typing import Mapping, Sequence, Union

import matplotlib.pyplot as plt
from matplotlib.axes import Axes
from matplotlib.figure import Figure


def _label_sequence(style: str, n: int) -> list[str]:
    """Generate labels like (a) (b) ... or A B ... or a b ...."""
    letters = string.ascii_lowercase
    if style in ("(a)", "a)", "a"):
        upper = False
    elif style in ("(A)", "A)", "A"):
        upper = True
    else:
        raise ValueError(f"unsupported style {style!r}; use '(a)', 'a', '(A)', or 'A'")
    out = []
    for i in range(n):
        ch = letters[i].upper() if upper else letters[i]
        out.append(f"({ch})" if style.startswith("(") else ch)
    return out


def _cluster_ids(values: Sequence[float], threshold: float) -> list[int]:
    """Assign stable group ids to nearby coordinates."""
    ordered = sorted(enumerate(values), key=lambda item: item[1])
    ids = [0] * len(values)
    group = 0
    previous = None
    for index, value in ordered:
        if previous is not None and value - previous > threshold:
            group += 1
        ids[index] = group
        previous = value
    return ids


def add_panel_labels(
    fig: Figure,
    axes: Union[Sequence[Axes], Mapping[str, Axes]],
    style: str = "(a)",
    *,
    dx: float = -0.04,
    dy: float = 0.015,
    fontsize: float = 9,
    fontweight: str = "bold",
    ha: str = "right",
    va: str = "bottom",
    grid_cluster: float = 0.08,
) -> None:
    """Place aligned panel labels.

    Parameters
    ----------
    fig : the Figure.
    axes : axes in reading order, or a {label: axis} mapping to set labels
        explicitly (e.g. share one label across a spanning axis).
    style : '(a)', 'a', '(A)', or 'A'. Ignored when ``axes`` is a mapping.
    dx, dy : offset from the axis top-left corner, in figure fractions.
        dx is typically negative (left of the panel), dy positive (above it).
    fontsize, fontweight, ha, va : text styling; keep identical across every
        figure in the project so main and supplementary match.
    grid_cluster : maximum separation used to identify axes in the same
        row/column. Labels in each identified group are snapped to one shared
        coordinate and retain that row/column identity for later auditing.
    """
    if isinstance(axes, Mapping):
        items = list(axes.items())
    else:
        axes = list(axes)
        labels = _label_sequence(style, len(axes))
        items = list(zip(labels, axes))

    fig.canvas.draw()  # ensure axes positions are current
    bboxes = [ax.get_position() for _, ax in items]
    raw_x = [bbox.x0 + dx for bbox in bboxes]
    raw_y = [bbox.y1 + dy for bbox in bboxes]
    col_ids = _cluster_ids(raw_x, grid_cluster)
    row_ids = _cluster_ids(raw_y, grid_cluster)

    # Use the leftmost/topmost panel edge as the shared label anchor. This
    # aligns labels even when axes in a nominal row/column differ slightly.
    col_x = {group: min(x for x, gid in zip(raw_x, col_ids) if gid == group)
             for group in set(col_ids)}
    row_y = {group: max(y for y, gid in zip(raw_y, row_ids) if gid == group)
             for group in set(row_ids)}

    for (label, _), col_id, row_id in zip(items, col_ids, row_ids):
        text = fig.text(
            col_x[col_id], row_y[row_id], label,
            fontsize=fontsize, fontweight=fontweight,
            ha=ha, va=va,
        )
        # Persist intended membership so the audit catches any later drift,
        # regardless of how large the accidental offset becomes.
        text._panel_col_id = col_id
        text._panel_row_id = row_id


def audit_label_alignment(
    fig: Figure,
    cluster: float = 0.08,
    tol: float = 0.004,
) -> list[str]:
    """Report panel labels that are *meant* to share a row/column but do not.

    Labels created by :func:`add_panel_labels` retain their intended row and
    column ids, so any later drift is caught regardless of its magnitude. For
    manually created labels without that metadata, fall back to positional
    clustering.

    Tune ``cluster`` below the smallest real gap between distinct columns/rows
    if your layout packs them tighter than 0.08 of the figure width/height.

    Returns a list of human-readable warnings (empty when clean).
    """
    tracked = [t for t in fig.texts
               if hasattr(t, "_panel_row_id") and hasattr(t, "_panel_col_id")]
    labels = tracked or [t for t in fig.texts if len(t.get_text()) <= 4]
    warnings: list[str] = []
    if len(labels) < 2:
        return warnings

    if tracked:
        for attr, idx, name in (
            ("_panel_col_id", 0, "x (column)"),
            ("_panel_row_id", 1, "y (row)"),
        ):
            groups: dict[int, list[float]] = {}
            for text in labels:
                groups.setdefault(getattr(text, attr), []).append(
                    text.get_position()[idx]
                )
            for values in groups.values():
                spread = max(values) - min(values)
                if len(values) > 1 and spread > tol:
                    warnings.append(
                        f"panel labels meant to share an {name} position span "
                        f"{min(values):.3f}..{max(values):.3f} "
                        f"(delta={spread:.3f} > {tol}); snap them to a shared grid"
                    )
        return warnings

    for idx, name in ((0, "x (column)"), (1, "y (row)")):
        vals = sorted(t.get_position()[idx] for t in labels)
        # split the sorted positions into clusters wherever the gap exceeds
        # `cluster` -- each cluster is one intended column/row.
        groups: list[list[float]] = [[vals[0]]]
        for v in vals[1:]:
            if v - groups[-1][-1] <= cluster:
                groups[-1].append(v)
            else:
                groups.append([v])
        for g in groups:
            spread = max(g) - min(g)
            if len(g) > 1 and spread > tol:
                warnings.append(
                    f"panel labels meant to share an {name} position span "
                    f"{min(g):.3f}..{max(g):.3f} (delta={spread:.3f} > {tol}); "
                    f"snap them to a shared grid"
                )
    return warnings


if __name__ == "__main__":
    # Smoke test / worked example.
    plt.style.use("assets/sci_style.mplstyle") if False else None
    fig, axs = plt.subplots(2, 2, figsize=(4, 4))
    for ax in axs.ravel():
        ax.plot([0, 1], [0, 1])
    add_panel_labels(fig, axs.ravel(), style="(a)")
    clean = audit_label_alignment(fig)
    assert not clean, clean
    print("clean layout warnings: none")

    # Negative control: a gross offset must fail, not become a new "column".
    fig.texts[2].set_position(
        (fig.texts[2].get_position()[0] + 0.10, fig.texts[2].get_position()[1])
    )
    shifted = audit_label_alignment(fig)
    assert shifted, "0.10 panel-label offset was not detected"
    print("after 0.10 offset:", shifted)
    fig.savefig("panel_labels_demo.png", dpi=200)
    print("wrote panel_labels_demo.png")

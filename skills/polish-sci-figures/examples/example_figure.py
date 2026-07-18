"""Worked example: a compact, near-square 4-panel figure that exercises the
skill's rules -- bundled style, aligned panel labels, varied scientifically
appropriate forms, exact italic P values, stable semantic colors.

Run:  python examples/example_figure.py
Outputs: examples/example_figure.png / .svg / .pdf

This is a reference for *form and styling*, not real data. Numbers are synthetic.
"""
import os
import sys

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from panel_labels import add_panel_labels, audit_label_alignment  # noqa: E402

plt.style.use(os.path.join(ROOT, "assets", "sci_style.mplstyle"))

# Stable semantic palette: red = high/up, blue = low/down, gray = neutral.
RED, BLUE, GRAY = "#c0392b", "#2c6fbb", "#8a8f98"
rng = np.random.default_rng(7)

# 89 mm single-column width -> ~3.5 in; keep it near-square.
fig, axs = plt.subplots(2, 2, figsize=(3.5, 3.4), constrained_layout=True)
(a, b), (c, d) = axs

# (a) Distribution: points + box, not bars alone.
ctrl = rng.normal(1.0, 0.25, 20)
treat = rng.normal(1.45, 0.30, 20)
for i, (grp, col) in enumerate(((ctrl, BLUE), (treat, RED))):
    x = np.full_like(grp, i) + rng.uniform(-0.08, 0.08, len(grp))
    a.scatter(x, grp, s=6, color=col, alpha=0.8, zorder=3)
    a.boxplot(grp, positions=[i], widths=0.5, showfliers=False,
              medianprops=dict(color="k", lw=0.8))
a.set_xticks([0, 1]); a.set_xticklabels(["Ctrl", "Treat"])
a.set_ylabel("Expression (a.u.)")
# Add headroom so the P annotation sits in free space above the data, never
# overlapping the top whisker/outlier (a release-blocker if it did).
ymin, ymax = a.get_ylim()
a.set_ylim(ymin, ymax + 0.28 * (ymax - ymin))
a.text(0.5, a.get_ylim()[1], "P = 3.2 x 10^-4",
       ha="center", va="top", fontsize=6, fontstyle="italic")

# (b) Paired samples: slope lines.
pre = rng.normal(2.0, 0.4, 10)
post = pre + rng.normal(0.6, 0.3, 10)
for p0, p1 in zip(pre, post):
    b.plot([0, 1], [p0, p1], color=GRAY, lw=0.7, marker="o", ms=2.5,
           mfc=BLUE, mec="none")
b.set_xlim(-0.3, 1.3); b.set_xticks([0, 1]); b.set_xticklabels(["Pre", "Post"])
b.set_ylabel("Activity")
ymin, ymax = b.get_ylim()
b.set_ylim(ymin, ymax + 0.12 * (ymax - ymin))
b.text(0.5, b.get_ylim()[1], "P = 0.006", ha="center", va="top",
       fontsize=6, fontstyle="italic")

# (c) Ranked effects: horizontal lollipop, direction by color.
genes = ["Gene F", "Gene E", "Gene D", "Gene C", "Gene B", "Gene A"]
lfc = np.array([-1.8, -0.9, -0.3, 0.5, 1.4, 2.2])
cols = [BLUE if v < 0 else RED for v in lfc]
c.hlines(range(len(genes)), 0, lfc, color=cols, lw=1.0)
c.plot(lfc, range(len(genes)), "o", ms=3.5, color="none", mec="k", mew=0.4)
for y, (v, col) in enumerate(zip(lfc, cols)):
    c.plot(v, y, "o", ms=3.5, color=col)
c.axvline(0, color="k", lw=0.5)
c.set_yticks(range(len(genes))); c.set_yticklabels(genes)
c.set_xlabel("log2 fold change")

# (d) Many features x conditions: vector heatmap.
mat = rng.normal(0, 1, (6, 5))
mesh = d.pcolormesh(
    np.arange(6), np.arange(7), mat,
    cmap="RdBu_r", vmin=-2.5, vmax=2.5, shading="flat",
)
d.set_xticks(np.arange(5) + 0.5); d.set_xticklabels([f"C{i+1}" for i in range(5)])
d.set_yticks(np.arange(6) + 0.5); d.set_yticklabels(genes, fontsize=5.5)
d.set_ylim(6, 0)
cmap = plt.get_cmap("RdBu_r")
d.legend(
    handles=[
        Patch(facecolor=cmap(0.95), edgecolor="none", label="+2.5"),
        Patch(facecolor=cmap(0.50), edgecolor="0.7", label="0"),
        Patch(facecolor=cmap(0.05), edgecolor="none", label="-2.5"),
    ],
    title="z-score", loc="center left", bbox_to_anchor=(1.01, 0.5),
    handlelength=0.8, fontsize=5,
)

add_panel_labels(fig, [a, b, c, d], style="(a)", dx=-0.02, dy=0.005)

warns = audit_label_alignment(fig)
print("alignment warnings:", warns if warns else "none")

stem = os.path.join(HERE, "example_figure")
for ext in ("png", "svg", "pdf"):
    fig.savefig(f"{stem}.{ext}")
    print(f"wrote {stem}.{ext}")

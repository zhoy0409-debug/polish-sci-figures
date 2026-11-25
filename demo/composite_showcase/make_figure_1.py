"""Rebuild the synthetic bioinformatics showcase (Figure_1_Bioinformatics.png).

The example uses seeded synthetic data. Panel D plots a fixed illustrative
enrichment table. Counts, NES and permutation P, AUC and bootstrap intervals,
effect intervals, correlations and PCA variance are computed from the inputs.

Usage (from the repository root):
    python demo/composite_showcase/make_figure_1.py

The default font is Arial, matching the other showcase figures. If Arial is not
installed the script stops. For a layout preview on another machine, pass
--allow-font-fallback together with an explicit --out path.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib import font_manager
from matplotlib.colors import LinearSegmentedColormap, Normalize
from matplotlib.lines import Line2D
from matplotlib.patches import Ellipse
from scipy import stats

HERE = Path(__file__).resolve().parent
DEFAULT_OUT = HERE / "Figure_1_Bioinformatics.png"

BLUE = "#18549b"
RED = "#d3334c"
BLUE_LIGHT = "#6a8fc0"
RED_LIGHT = "#e27a8a"
GREY = "#c9ced6"
GUIDE = "#7e8b9d"
INK = "#1f2933"
LETTER = "#182d46"

FIG_W, FIG_H, DPI = 15.0, 13.2, 100
COL_X = (0.075, 0.405, 0.735)
ROW_Y = (0.705, 0.380, 0.060)
CELL_W, CELL_H = 0.235, 0.235


def configure(font: str) -> None:
    plt.rcParams.update({
        "font.family": font,
        "font.sans-serif": [font],
        "mathtext.fontset": "custom",
        "mathtext.rm": font,
        "mathtext.it": f"{font}:italic",
        "mathtext.bf": f"{font}:bold",
        "mathtext.default": "regular",
        "font.size": 11,
        "axes.labelsize": 13,
        "xtick.labelsize": 10.5,
        "ytick.labelsize": 10.5,
        "legend.fontsize": 10.5,
        "axes.linewidth": 0.9,
        "axes.edgecolor": INK,
        "axes.labelcolor": "black",
        "xtick.color": INK,
        "ytick.color": INK,
        "xtick.major.width": 0.8,
        "ytick.major.width": 0.8,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "svg.fonttype": "none",
        "pdf.fonttype": 42,
    })


def cell(fig, col: int, row: int, letter: str):
    x0, y0 = COL_X[col], ROW_Y[row]
    fig.text(x0 - 0.052, y0 + CELL_H + 0.030, letter, fontsize=21, fontweight="bold",
             color=LETTER, ha="left", va="bottom")
    return x0, y0


# --------------------------------------------------------------------------- A/B
CHROM_MB = [248, 242, 198, 190, 181, 171, 159, 145, 138, 134, 135, 133, 114, 107,
            102, 90, 83, 80, 59, 64, 47, 51, 156]
CHROM_NAMES = [str(i) for i in range(1, 23)] + ["X"]
N_VARIANTS = 59_800


def manhattan_data(rng, peaks):
    weights = np.array(CHROM_MB, float) / sum(CHROM_MB)
    counts = np.floor(weights * N_VARIANTS).astype(int)
    counts[0] += N_VARIANTS - counts.sum()
    chrom, pos = [], []
    for index, (n, length) in enumerate(zip(counts, CHROM_MB)):
        chrom.append(np.full(n, index))
        pos.append(np.sort(rng.uniform(0, length, n)))
    chrom, pos = np.concatenate(chrom), np.concatenate(pos)
    logp = -np.log10(rng.uniform(size=N_VARIANTS))
    leads = {}
    for name, (index, centre, height) in peaks.items():
        members = np.flatnonzero((chrom == index) & (np.abs(pos - centre) < 3.0))
        distance = np.abs(pos[members] - centre)
        linkage = np.exp(-distance / 0.8) * rng.uniform(0.35, 1.0, members.size)
        logp[members] = np.maximum(logp[members], height * linkage + rng.normal(0, 0.4, members.size))
        lead = members[np.argmin(distance)]
        logp[lead] = height
        if name:
            leads[name] = lead
    offsets = np.concatenate([[0], np.cumsum(np.array(CHROM_MB, float) + 12)])
    x = pos + offsets[chrom]
    centres = offsets[:-1] + np.array(CHROM_MB) / 2
    return x, np.clip(logp, 0, None), chrom, leads, centres, offsets[-1]


def thin_chromosome_labels(fig, ax, gap_px=2.5):
    """Keep a regular set of chromosome labels that fits at final size; X is always kept."""
    renderer = fig.canvas.get_renderer()
    labels = ax.get_xticklabels()
    boxes = [label.get_window_extent(renderer) for label in labels]

    def fits(indices):
        return all(boxes[b].x0 >= boxes[a].x1 + gap_px for a, b in zip(indices, indices[1:]))

    preferred = [CHROM_NAMES.index(name) for name in
                 [str(i) for i in range(1, 13)] + ["14", "16", "18", "20", "X"]]
    keep = preferred if fits(preferred) else None
    if keep is None:
        keep, right = [], -np.inf
        for index, box in enumerate(boxes[:-1]):
            if box.x0 >= right + gap_px:
                keep.append(index)
                right = box.x1
        while keep and boxes[-1].x0 < boxes[keep[-1]].x1 + gap_px:
            keep.pop()
        keep.append(len(labels) - 1)
    for index, label in enumerate(labels):
        label.set_visible(index in keep)


def draw_manhattan(fig, col, row, letter, rng, peaks, shades, cohort):
    x0, y0 = cell(fig, col, row, letter)
    ax = fig.add_axes([x0, y0, CELL_W, CELL_H])
    x, logp, chrom, leads, centres, end = manhattan_data(rng, peaks)
    colours = np.where(chrom % 2 == 0, shades[0], shades[1])
    ax.scatter(x, logp, s=2.2, c=colours, linewidths=0, rasterized=True)
    threshold = -np.log10(5e-8)
    ax.axhline(threshold, color=GUIDE, lw=0.9, ls=(0, (4, 3)))
    for name, lead in leads.items():
        top = logp[lead]
        ax.plot([x[lead], x[lead]], [top + 0.9, top + 2.3], color=INK, lw=0.8)
        ax.text(x[lead], top + 2.7, name, ha="center", va="bottom", fontsize=10)
    ax.text(0.02, 0.985, f"{cohort} · {len(logp):,} variants\nThreshold: $\\mathit{{P}}$ = 5 × 10$^{{-8}}$",
            transform=ax.transAxes, ha="left", va="top", fontsize=11, linespacing=1.35)
    ax.set_xlim(-10, end)
    ax.set_ylim(0, 36)
    ax.set_xticks(centres)
    ax.set_xticklabels(CHROM_NAMES, fontsize=8.2)
    ax.tick_params(axis="x", length=2.5, pad=2)
    ax.set_xlabel("Chromosome")
    ax.set_ylabel("$-$log$_{10}$ $\\mathit{P}$")
    return ax


# ----------------------------------------------------------------------------- C
DOWN_LABELS = [("TFRC", -2.05, 7.75), ("ACSL4", -2.25, 7.25), ("SLC7A11", -2.45, 6.80), ("GPX4", -2.65, 6.35)]
UP_LABELS = [("NCOA4", 2.05, 7.95), ("HMOX1", 2.25, 7.45), ("NFE2L2", 2.45, 6.95), ("FTH1", 2.65, 6.45)]
LABEL_COLUMN = 2.82


def draw_volcano(fig, rng):
    x0, y0 = cell(fig, 2, 0, "C")
    ax = fig.add_axes([x0, y0, CELL_W, CELL_H])
    null_fc = rng.normal(0, 0.42, 5600)
    null_y = np.abs(null_fc) * rng.uniform(0.2, 1.4, null_fc.size) + rng.exponential(0.22, null_fc.size)
    de_fc = np.concatenate([rng.uniform(-3.2, -0.6, 210), rng.uniform(0.6, 3.2, 210)])
    de_y = np.clip(0.9 * np.abs(de_fc) + rng.normal(0.9, 0.95, de_fc.size), 0.05, 5.9)
    fc = np.concatenate([null_fc, de_fc])
    y = np.clip(np.concatenate([null_y, de_y]), 0, 5.9)
    labelled_fc = np.array([item[1] for item in DOWN_LABELS + UP_LABELS])
    labelled_y = np.array([item[2] for item in DOWN_LABELS + UP_LABELS])
    fc, y = np.concatenate([fc, labelled_fc]), np.concatenate([y, labelled_y])
    significant = y > -np.log10(0.05)
    down = significant & (fc < -1)
    up = significant & (fc > 1)
    other = ~(down | up)
    ax.scatter(fc[other], y[other], s=7, color=GREY, alpha=0.75, linewidths=0, rasterized=True)
    ax.scatter(fc[down], y[down], s=13, color=BLUE_LIGHT, alpha=0.9, linewidths=0)
    ax.scatter(fc[up], y[up], s=13, color=RED_LIGHT, alpha=0.9, linewidths=0)
    for value in (-1, 1):
        ax.axvline(value, color=GUIDE, lw=0.85, ls=(0, (4, 3)))
    ax.axhline(-np.log10(0.05), color=GUIDE, lw=0.85, ls=(0, (4, 3)))
    ax.text(0, 10.2, "FDR < 0.05\n|log$_2$FC| > 1", ha="center", va="top", fontsize=10, linespacing=1.3)
    # Labels sit in a column above the point cloud; each leader starts at its
    # own label edge and runs to its point, ordered so leaders never cross.
    for labels, sign, ha, colour in ((DOWN_LABELS, -1, "right", BLUE), (UP_LABELS, 1, "left", RED)):
        for rank, (gene, gx, gy) in enumerate(labels):
            label_y = 9.55 - 0.92 * rank
            ax.scatter([gx], [gy], s=22, color=colour, linewidths=0, zorder=4)
            ax.plot([sign * (LABEL_COLUMN - 0.08), gx - sign * 0.05], [label_y, gy + 0.06], color=colour, lw=0.8, zorder=3)
            ax.text(sign * LABEL_COLUMN, label_y, gene, ha=ha, va="center", fontsize=10.5,
                    style="italic", color=colour, zorder=5)
    ax.set_xlim(-4.7, 4.7)
    ax.set_ylim(0, 10.5)
    ax.set_xlabel("log$_2$ fold change")
    ax.set_ylabel("$-$log$_{10}$ adjusted $\\mathit{P}$")
    handles = [Line2D([], [], ls="", marker="o", ms=5, color=GREY, label="Other"),
               Line2D([], [], ls="", marker="o", ms=5, color=BLUE_LIGHT, label=f"Down ({down.sum()})"),
               Line2D([], [], ls="", marker="o", ms=5, color=RED_LIGHT, label=f"Up ({up.sum()})")]
    ax.legend(handles=handles, ncol=3, frameon=False, loc="lower right", bbox_to_anchor=(1.0, 1.0),
              handletextpad=0.2, columnspacing=1.1, borderaxespad=0.3)
    return ax


# ----------------------------------------------------------------------------- D
TERMS = [("Ferroptosis", 0.337, 33, 10.1), ("GSH", 0.232, 24, 5.6), ("ROS", 0.186, 21, 4.4),
         ("Lipid", 0.133, 17, 3.7), ("Iron", 0.105, 14, 3.1), ("p53", 0.080, 12, 2.6),
         ("Cell cycle", 0.065, 10, 2.3), ("DNA repair", 0.050, 8, 2.0)]


def draw_enrichment(fig):
    x0, y0 = cell(fig, 0, 1, "D")
    ax = fig.add_axes([x0, y0, CELL_W, CELL_H])
    names = [t[0] for t in TERMS][::-1]
    ratio = np.array([t[1] for t in TERMS])[::-1]
    hits = np.array([t[2] for t in TERMS])[::-1]
    score = np.array([t[3] for t in TERMS])[::-1]
    # -log10 q is a one-directional magnitude: use a sequential map whose
    # lightest colour stays visible on white.
    cmap = LinearSegmentedColormap.from_list("q_sequential", ["#b9cbe3", BLUE, "#0b2a52"])
    norm = Normalize(0, 11)
    rows = np.arange(len(names))
    ax.hlines(rows, 0, ratio, color="#d5dce6", lw=1.1, zorder=1)
    ax.scatter(ratio, rows, s=hits * 7.5, c=score, cmap=cmap, norm=norm, edgecolor="white", lw=0.6, zorder=3)
    ax.set_yticks(rows)
    ax.set_yticklabels(names, fontsize=11)
    ax.set_xlim(0, 0.39)
    ax.set_ylim(-0.6, len(names) - 0.4)
    ax.tick_params(axis="y", length=0)
    ax.set_xlabel("Gene ratio")
    cax = fig.add_axes([x0 + CELL_W * 0.52, y0 + CELL_H + 0.018, CELL_W * 0.46, 0.008])
    bar = fig.colorbar(plt.cm.ScalarMappable(norm=norm, cmap=cmap), cax=cax, orientation="horizontal")
    bar.set_ticks([0, 5, 10])
    bar.ax.tick_params(labelsize=9.5, length=2, pad=1.5)
    bar.ax.xaxis.set_ticks_position("top")
    bar.outline.set_linewidth(0.5)
    fig.text(x0 + CELL_W * 0.50, y0 + CELL_H + 0.022, "$-$log$_{10}$ $\\mathit{q}$", ha="right", va="center", fontsize=10.5)
    for size, yy in ((15, 1.15), (30, 0.25)):
        ax.scatter([0.30], [yy], s=size * 7.5, color="#8193aa", edgecolor="white", lw=0.6)
        ax.text(0.322, yy, str(size), va="center", fontsize=10)
    ax.text(0.30, 1.85, "Hits", ha="center", va="bottom", fontsize=10.5)
    return ax


# ----------------------------------------------------------------------------- E
def draw_gsea(fig, rng):
    x0, y0 = cell(fig, 1, 1, "E")
    n_genes, n_hits = 1200, 55
    metric = np.sort(rng.normal(0, 1, n_genes) * np.linspace(1.6, 0.4, n_genes))[::-1]
    metric = metric - np.median(metric)
    weights = np.exp(-np.arange(n_genes) / 260)
    hits = np.sort(rng.choice(n_genes, n_hits, replace=False, p=weights / weights.sum()))

    def running(indices):
        tag = np.zeros(n_genes, bool)
        tag[indices] = True
        hit_step = np.where(tag, np.abs(metric), 0)
        hit_step = hit_step / hit_step.sum()
        miss_step = np.where(tag, 0, 1 / (n_genes - indices.size))
        return np.cumsum(hit_step - miss_step)

    curve = running(hits)
    es = curve[np.argmax(np.abs(curve))]
    perm = np.array([running(np.sort(rng.choice(n_genes, n_hits, replace=False))) for _ in range(500)])
    perm_es = perm[np.arange(500), np.argmax(np.abs(perm), axis=1)]
    positive = perm_es[perm_es > 0]
    nes = es / positive.mean()
    p_value = (np.sum(perm_es >= es) + 1) / (perm_es.size + 1)

    top_h, tick_h, gap = 0.62, 0.075, 0.012
    ax = fig.add_axes([x0, y0 + CELL_H * (1 - top_h), CELL_W, CELL_H * top_h])
    ax_tick = fig.add_axes([x0, y0 + CELL_H * (1 - top_h - tick_h) - gap * 0.5, CELL_W, CELL_H * tick_h])
    ax_metric = fig.add_axes([x0, y0, CELL_W, CELL_H * (1 - top_h - tick_h) - gap * 1.5])
    ax.plot(np.arange(n_genes), curve, color=RED, lw=1.6, label="Oxidative-stress set")
    ax.axhline(0, color=GUIDE, lw=0.7)
    ax.set_xlim(0, n_genes)
    ax.set_ylim(-0.12, max(curve) / 0.62)
    ax.set_xticks([])
    ax.spines["bottom"].set_visible(False)
    ax.set_ylabel("Enrichment score")
    ax.text(0.03, 0.97, f"NES = {nes:.2f}\n$\\mathit{{P}}$ = {p_value:.3f}\n{n_hits} genes; 500 permutations",
            transform=ax.transAxes, ha="left", va="top", fontsize=10.5, linespacing=1.3)
    ax.legend(frameon=False, loc="upper right", handlelength=1.6, borderaxespad=0.2)
    ax_tick.vlines(hits, 0, 1, color=INK, lw=0.8)
    ax_tick.set_xlim(0, n_genes)
    ax_tick.set_ylim(0, 1)
    ax_tick.axis("off")
    ax_metric.fill_between(np.arange(n_genes), metric, 0, color="#b9cbe3", lw=0)
    ax_metric.axhline(0, color=GUIDE, lw=0.6)
    ax_metric.set_xlim(0, n_genes)
    ax_metric.set_yticks([])
    ax_metric.spines["left"].set_visible(False)
    ax_metric.set_xlabel("Ranked gene list")
    return ax


# ----------------------------------------------------------------------------- F
VARIABLES = ["ROS", "LPO", "Iron", "GPX4", "GSH", "NRF2", "EdU", "CCN", "Growth"]


def draw_correlation(fig, rng):
    x0, y0 = cell(fig, 2, 1, "F")
    ax = fig.add_axes([x0 + 0.012, y0, CELL_W - 0.012, CELL_H])
    n = 60
    factors = rng.normal(size=(n, 3))
    factors[:, 1] -= 0.1 * factors[:, 0]
    columns = [0.82 * factors[:, k // 3] + 0.57 * rng.normal(size=n) for k in range(9)]
    r = np.corrcoef(np.column_stack(columns), rowvar=False)
    cmap = LinearSegmentedColormap.from_list("r_diverging", [BLUE, "#f7f7f7", RED])
    mesh = ax.pcolormesh(np.arange(10) - 0.5, np.arange(10) - 0.5, r, cmap=cmap, vmin=-1, vmax=1,
                         edgecolor="white", lw=0.8)
    for i in range(9):
        for j in range(9):
            value = r[i, j]
            text = f"{value:.2f}".replace("-", "−") if round(value, 2) != 0 else "0.00"
            ax.text(j, i, text, ha="center", va="center", fontsize=9.6,
                    color="white" if abs(value) > 0.85 else INK)
    ax.set_xlim(-0.5, 8.5)
    ax.set_ylim(8.5, -0.5)
    ax.set_xticks(range(9))
    ax.set_xticklabels(VARIABLES, rotation=55, ha="right", rotation_mode="anchor", fontsize=10.5)
    ax.set_yticks(range(9))
    ax.set_yticklabels(VARIABLES, fontsize=11)
    ax.tick_params(length=0)
    for side in ("left", "bottom"):
        ax.spines[side].set_visible(False)
    cax = fig.add_axes([x0 + CELL_W * 0.40, y0 + CELL_H + 0.018, CELL_W * 0.58, 0.008])
    bar = fig.colorbar(mesh, cax=cax, orientation="horizontal")
    bar.set_ticks([-1, 0, 1])
    bar.set_ticklabels(["−1", "0", "1"])
    bar.ax.tick_params(labelsize=9.5, length=2, pad=1.5)
    bar.ax.xaxis.set_ticks_position("top")
    bar.outline.set_linewidth(0.5)
    fig.text(x0 + CELL_W * 0.38, y0 + CELL_H + 0.022, "$\\mathit{r}$", ha="right", va="center", fontsize=11)
    return ax


# ----------------------------------------------------------------------------- G
def roc_curve(labels, scores):
    order = np.argsort(-scores)
    labels = labels[order]
    tpr = np.concatenate([[0], np.cumsum(labels) / labels.sum()])
    fpr = np.concatenate([[0], np.cumsum(1 - labels) / (1 - labels).sum()])
    return fpr, tpr


def auc_score(labels, scores):
    positive, negative = scores[labels == 1], scores[labels == 0]
    return stats.mannwhitneyu(positive, negative).statistic / (positive.size * negative.size)


def draw_roc(fig, rng):
    x0, y0 = cell(fig, 0, 2, "G")
    ax = fig.add_axes([x0, y0, CELL_W, CELL_H])
    labels = np.r_[np.ones(110), np.zeros(110)].astype(int)
    ax.plot([0, 1], [0, 1], color="#aeb6c1", lw=0.8, ls=(0, (4, 3)))
    for name, separation, colour in (("Model 1", 1.42, BLUE), ("Model 2", 1.75, RED)):
        scores = rng.normal(0, 1, labels.size) + separation * labels
        auc = auc_score(labels, scores)
        boot = []
        for _ in range(2000):
            pick = rng.integers(0, labels.size, labels.size)
            if labels[pick].min() == labels[pick].max():
                continue
            boot.append(auc_score(labels[pick], scores[pick]))
        low, high = np.percentile(boot, [2.5, 97.5])
        fpr, tpr = roc_curve(labels, scores)
        ax.step(fpr, tpr, where="post", color=colour, lw=1.6,
                label=f"{name}: {auc:.2f} ({low:.2f}–{high:.2f})")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1.02)
    ax.set_xticks(np.linspace(0, 1, 5))
    ax.set_yticks(np.linspace(0, 1, 5))
    ax.set_xlabel("False positive rate")
    ax.set_ylabel("True positive rate")
    ax.legend(title="AUC (95% CI)", frameon=False, loc="lower right", fontsize=10, title_fontsize=10.5,
              handlelength=1.4, borderaxespad=0.3)
    return ax


# ----------------------------------------------------------------------------- H
EFFECTS = [("ROS", 0.55), ("Iron", 0.95), ("LPO", 0.62), ("Cell cycle", -0.30), ("DNA synth.", -0.62), ("Redox", -0.68)]


def draw_forest(fig, rng):
    x0, y0 = cell(fig, 1, 2, "H")
    ax = fig.add_axes([x0, y0, CELL_W, CELL_H])
    n = 14
    rows = np.arange(len(EFFECTS))[::-1]
    for row, (name, shift) in zip(rows, EFFECTS):
        control = rng.normal(0, 1, n)
        treated = rng.normal(shift, 1, n)
        diff = treated.mean() - control.mean()
        se = np.sqrt(treated.var(ddof=1) / n + control.var(ddof=1) / n)
        half = stats.t.ppf(0.975, 2 * n - 2) * se
        colour = RED if diff > 0 else BLUE
        ax.plot([diff - half, diff + half], [row, row], color=colour, lw=1.5)
        for end in (diff - half, diff + half):
            ax.plot([end, end], [row - 0.12, row + 0.12], color=colour, lw=1.2)
        ax.scatter([diff], [row], s=42, color=colour, zorder=3)
    ax.axvline(0, color=GUIDE, lw=0.9, ls=(0, (4, 3)))
    ax.set_yticks(rows)
    ax.set_yticklabels([e[0] for e in EFFECTS], fontsize=11)
    ax.tick_params(axis="y", length=0)
    ax.set_ylim(-0.6, len(EFFECTS) - 0.4)
    ends = np.array([line.get_xdata() for line in ax.lines]).ravel()
    span = max(abs(ends.min()), abs(ends.max())) * 1.12
    ax.set_xlim(-span, span)
    ax.set_xlabel("Mean effect (95% CI)")
    return ax


# ----------------------------------------------------------------------------- I
GENES = ["SLC7A11", "GPX4", "TFRC", "HMOX1", "NFE2L2", "FTH1"]
GROUPS = [("Ctrl", BLUE), ("Stress", RED), ("Rescue", "#9fb3cc")]


def _segment_hits_box(p, q, box, pad=2.0):
    """True when the display-space segment p–q enters the padded box."""
    x0, y0, x1, y1 = box.x0 - pad, box.y0 - pad, box.x1 + pad, box.y1 + pad
    t0, t1 = 0.0, 1.0
    dx, dy = q[0] - p[0], q[1] - p[1]
    for pv, qv in ((-dx, p[0] - x0), (dx, x1 - p[0]), (-dy, p[1] - y0), (dy, y1 - p[1])):
        if pv == 0:
            if qv < 0:
                return False
            continue
        t = qv / pv
        if pv < 0:
            t0 = max(t0, t)
        else:
            t1 = min(t1, t)
        if t0 > t1:
            return False
    return True


def place_loading_labels(fig, ax, tips, names, points):
    """Place each loading label beside its arrow tip where it covers no point, arrow or label."""
    renderer = fig.canvas.get_renderer()
    to_px = ax.transData.transform
    point_px = to_px(points)
    radius = np.sqrt(13) / 2 * fig.dpi / 72 + 1.5
    origin = to_px([[0, 0]])[0]
    arrows = [(origin, to_px([tip])[0]) for tip in tips]
    axes_box = ax.get_window_extent(renderer)
    placed = []
    for tip, name in zip(tips, names):
        base = np.arctan2(tip[1], tip[0])
        best = None
        for turn in (0, 25, -25, 50, -50, 80, -80, 115, -115, 180):
            for distance in (0.15, 0.3, 0.5, 0.75, 1.0):
                angle = base + np.radians(turn)
                anchor = tip + distance * np.array([np.cos(angle), np.sin(angle)])
                ha = "left" if np.cos(angle) > 0.35 else "right" if np.cos(angle) < -0.35 else "center"
                va = "bottom" if np.sin(angle) > 0.35 else "top" if np.sin(angle) < -0.35 else "center"
                text = ax.text(*anchor, name, ha=ha, va=va, fontsize=10, style="italic", color=INK, zorder=5)
                box = text.get_window_extent(renderer)
                text.remove()
                cx = np.clip(point_px[:, 0], box.x0, box.x1)
                cy = np.clip(point_px[:, 1], box.y0, box.y1)
                cost = 10 * int(np.sum(np.hypot(point_px[:, 0] - cx, point_px[:, 1] - cy) < radius))
                cost += 50 * sum(_segment_hits_box(a, b, box) for a, b in arrows)
                cost += 100 * sum(box.overlaps(other.padded(2)) for other in placed)
                centre = np.array([(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2])
                gaps = [np.hypot(*(centre - to_px([other])[0])) for other in tips]
                own = np.hypot(*(centre - to_px([tip])[0]))
                cost += 40 if own > min(gaps) + 1e-6 else 0
                inside = (box.x0 >= axes_box.x0 + 2 and box.x1 <= axes_box.x1 - 2
                          and box.y0 >= axes_box.y0 + 2 and box.y1 <= axes_box.y1 - 2)
                cost += 0 if inside else 1000
                cost += distance + abs(turn) / 400
                if best is None or cost < best[0]:
                    best = (cost, anchor, ha, va, box)
        _, anchor, ha, va, box = best
        ax.text(*anchor, name, ha=ha, va=va, fontsize=10, style="italic", color=INK, zorder=5)
        placed.append(box)


def draw_pca(fig, rng):
    x0, y0 = cell(fig, 2, 2, "I")
    # Columns follow GENES; rows are Ctrl, Stress and Rescue group means.
    means = np.array([[0.5, 1.0, 0.9, -1.0, -0.4, -0.9],
                      [-1.3, -1.2, 0.3, 1.0, 1.1, 0.5],
                      [0.9, 0.4, -1.2, 0.2, -0.8, 0.6]])
    data, group = [], []
    for index, centre in enumerate(means):
        data.append(centre + rng.normal(0, 0.38, (30, len(GENES))))
        group += [index] * 30
    data, group = np.vstack(data), np.array(group)
    z = (data - data.mean(0)) / data.std(0, ddof=1)
    u, s, vt = np.linalg.svd(z, full_matrices=False)
    scores = u[:, :2] * s[:2]
    explained = s ** 2 / np.sum(s ** 2) * 100
    loadings = vt[:2].T
    x_limit = np.ceil((np.max(np.abs(scores[:, 0])) + 0.7) * 2) / 2
    y_limit = np.ceil((np.max(np.abs(scores[:, 1])) + 0.6) * 2) / 2

    main_w, main_h = CELL_W * 0.78, CELL_H * 0.78
    ax = fig.add_axes([x0, y0, main_w, main_h])
    ax_top = fig.add_axes([x0, y0 + main_h + 0.006, main_w, CELL_H - main_h - 0.006])
    ax_right = fig.add_axes([x0 + main_w + 0.005, y0, CELL_W - main_w - 0.005, main_h])
    chi = np.sqrt(stats.chi2.ppf(0.95, 2))
    grid_x = np.linspace(-x_limit, x_limit, 240)
    grid_y = np.linspace(-y_limit, y_limit, 240)
    for index, (name, colour) in enumerate(GROUPS):
        pts = scores[group == index]
        cov = np.cov(pts, rowvar=False)
        values, vectors = np.linalg.eigh(cov)
        angle = np.degrees(np.arctan2(vectors[1, 1], vectors[0, 1]))
        ax.add_patch(Ellipse(pts.mean(0), 2 * chi * np.sqrt(values[1]), 2 * chi * np.sqrt(values[0]),
                             angle=angle, facecolor=colour, alpha=0.13, edgecolor="none", zorder=1))
        ax.scatter(pts[:, 0], pts[:, 1], s=13, color=colour, alpha=0.9, linewidths=0, zorder=2, label=name)
        density_x = stats.gaussian_kde(pts[:, 0])(grid_x)
        density_y = stats.gaussian_kde(pts[:, 1])(grid_y)
        ax_top.fill_between(grid_x, density_x, color=colour, alpha=0.30, lw=0)
        ax_top.plot(grid_x, density_x, color=colour, lw=1.1)
        ax_right.fill_betweenx(grid_y, density_y, color=colour, alpha=0.30, lw=0)
        ax_right.plot(density_y, grid_y, color=colour, lw=1.1)
    ax.set_xlim(-x_limit, x_limit)
    ax.set_ylim(-y_limit, y_limit)
    tips = loadings / np.max(np.linalg.norm(loadings, axis=1)) * 2.0
    for tip in tips:
        ax.annotate("", tip, (0, 0), arrowprops=dict(arrowstyle="-|>", color=INK, lw=0.9, mutation_scale=9), zorder=4)
    fig.canvas.draw()
    place_loading_labels(fig, ax, tips, GENES, scores)
    ax.set_xlabel(f"PC1 ({explained[0]:.1f}%)")
    ax.set_ylabel(f"PC2 ({explained[1]:.1f}%)")
    for side in ("top", "right"):
        ax.spines[side].set_visible(True)
    for marginal in (ax_top, ax_right):
        marginal.set_xticks([])
        marginal.set_yticks([])
        marginal.axis("off")
    ax_top.set_xlim(ax.get_xlim())
    ax_top.set_ylim(bottom=0)
    ax_right.set_ylim(ax.get_ylim())
    ax_right.set_xlim(left=0)
    handles, names = ax.get_legend_handles_labels()
    fig.legend(handles, names, loc="lower left", frameon=False, fontsize=10, markerscale=1.3, handletextpad=0.1,
               bbox_to_anchor=(x0 + main_w + 0.004, y0 + main_h + 0.002), borderaxespad=0, labelspacing=0.25)
    return ax


def build_figure(font: str = "Arial"):
    configure(font)
    rng = np.random.default_rng(20261004)
    fig = plt.figure(figsize=(FIG_W, FIG_H), dpi=DPI, facecolor="white")
    discovery = {"rsS001": (2, 92, 21.5), "rsS002": (7, 61, 20.0), "rsS003": (13, 54, 23.5), "rsS004": (19, 31, 26.0),
                 "": (5, 110, 11.0)}
    replication = {"rsS001": (2, 92, 19.0), "rsS002": (7, 61, 16.5), "rsS003": (13, 54, 21.0), "rsS004": (19, 31, 24.0),
                   "": (10, 70, 8.5)}
    manhattans = [draw_manhattan(fig, 0, 0, "A", rng, discovery, ("#a8223c", "#de6577"), "Discovery"),
                  draw_manhattan(fig, 1, 0, "B", rng, replication, (BLUE, BLUE_LIGHT), "Replication")]
    draw_volcano(fig, rng)
    draw_enrichment(fig)
    draw_gsea(fig, rng)
    draw_correlation(fig, rng)
    draw_roc(fig, rng)
    draw_forest(fig, rng)
    draw_pca(fig, rng)
    fig.canvas.draw()
    for ax in manhattans:
        thin_chromosome_labels(fig, ax)
    return fig


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=None, help=f"output PNG (default: {DEFAULT_OUT.name})")
    parser.add_argument("--font", default="Arial")
    parser.add_argument("--allow-font-fallback", action="store_true",
                        help="render a layout preview with a substitute font; requires --out")
    args = parser.parse_args(argv)
    font = args.font
    try:
        font_manager.findfont(font_manager.FontProperties(family=font), fallback_to_default=False)
    except ValueError:
        if not args.allow_font_fallback:
            print(f"Font {font!r} is not installed; the showcase requires it.", file=sys.stderr)
            return 2
        if args.out is None:
            print("A fallback preview needs an explicit --out path.", file=sys.stderr)
            return 2
        font = "Liberation Sans"
        print(f"Preview only: rendering with {font!r} instead of {args.font!r}.", file=sys.stderr)
    out = args.out or DEFAULT_OUT
    fig = build_figure(font)
    fig.savefig(out, dpi=DPI, facecolor="white", metadata={"Author": "a", "Software": None})
    plt.close(fig)
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

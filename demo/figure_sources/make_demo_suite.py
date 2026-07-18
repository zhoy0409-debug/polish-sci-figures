"""Generate a six-figure publication-style demo suite.

All values are deterministic synthetic data for visual demonstration only.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.path import Path as MplPath
from matplotlib.patches import Circle, FancyArrowPatch, Patch, Polygon
from matplotlib.ticker import NullFormatter


SKILL = Path(os.environ.get(
    "POLISH_SCI_SKILL",
    str(Path.home() / ".codex" / "skills" / "polish-sci-figures"),
))
sys.path.insert(0, str(SKILL / "scripts"))
from panel_labels import add_panel_labels, audit_label_alignment  # noqa: E402

plt.style.use(SKILL / "assets" / "sci_style.mplstyle")
plt.rcParams.update({"font.family": "Arial", "axes.titlesize": 8})

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "final_figures"
OUT.mkdir(parents=True, exist_ok=True)

RED = "#C43C2F"
BLUE = "#2F6FB3"
GRAY = "#8B929B"
DARK = "#252A31"
LIGHT = "#D9DDE2"
TEAL = "#238B8E"
GOLD = "#D79A2B"
PURPLE = "#775DA6"
GREEN = "#4F8A5B"
rng = np.random.default_rng(20260715)


def finish(fig, axes, stem: str, *, label_dx: float = -0.018) -> None:
    """Apply the shared release checks and export all master formats."""
    add_panel_labels(fig, axes, style="(a)", dx=label_dx, dy=0.008,
                     fontsize=9, grid_cluster=0.10)
    warnings = audit_label_alignment(fig)
    assert not warnings, warnings
    for ext in ("png", "svg", "pdf"):
        path = OUT / f"{stem}.{ext}"
        fig.savefig(path, dpi=300 if ext == "png" else None)
        print(f"wrote {path}")
    preview = ROOT / f"{stem}.png"
    fig.savefig(preview, dpi=300)
    print(f"wrote {preview}")
    plt.close(fig)


def figure_1_efficacy() -> None:
    fig, axs = plt.subplots(2, 2, figsize=(7.1, 5.3), constrained_layout=True)
    a, b, c, d = axs.ravel()

    # Distribution + individual observations.
    vehicle = rng.normal(1.05, 0.18, 24)
    treated = rng.normal(0.62, 0.15, 24)
    data = [vehicle, treated]
    violin = a.violinplot(data, positions=[0, 1], widths=0.78,
                          showextrema=False)
    for body, color in zip(violin["bodies"], (GRAY, BLUE)):
        body.set_facecolor(color)
        body.set_edgecolor(color)
        body.set_alpha(0.18)
    a.boxplot(data, positions=[0, 1], widths=0.25, showfliers=False,
              medianprops={"color": DARK, "lw": 1.1},
              boxprops={"color": DARK}, whiskerprops={"color": DARK},
              capprops={"color": DARK})
    for x0, values, color in zip((0, 1), data, (GRAY, BLUE)):
        x = x0 + rng.uniform(-0.10, 0.10, len(values))
        a.scatter(x, values, s=14, color=color, alpha=0.78,
                  edgecolor="white", linewidth=0.25, zorder=3)
    y = 1.48
    a.plot([0, 0, 1, 1], [y - 0.025, y, y, y - 0.025], color=DARK, lw=0.7)
    a.text(0.5, y + 0.025, "P = 4.8 x 10^-4",
           ha="center", va="bottom", fontstyle="italic")
    a.set(xticks=[0, 1], xticklabels=["Vehicle", "CX-17"],
          ylabel="Relative tumor volume", ylim=(0.25, 1.62),
          title="Tumor response")

    # Paired pre/post response.
    pre = rng.normal(1.0, 0.18, 14)
    post = pre + rng.normal(0.63, 0.18, 14)
    for p0, p1 in zip(pre, post):
        b.plot([0, 1], [p0, p1], color=GRAY, lw=0.75, zorder=1)
    b.scatter(np.zeros_like(pre), pre, s=18, color=GRAY, zorder=2)
    b.scatter(np.ones_like(post), post, s=18, color=RED, zorder=2)
    b.text(0.5, 2.05, "P = 0.002", ha="center", va="top",
           fontstyle="italic")
    b.set(xlim=(-0.35, 1.35), ylim=(0.55, 2.08), xticks=[0, 1],
          xticklabels=["Baseline", "Day 14"], ylabel="CD8 activation score",
          title="Paired pharmacodynamic response")

    # Dose-response with uncertainty.
    dose = np.geomspace(0.03, 10, 9)
    reps = np.clip(100 / (1 + (dose[:, None] / 0.72) ** 1.35)
                   + rng.normal(0, 3.0, (len(dose), 8)), 0, 105)
    mean = reps.mean(axis=1)
    sem = reps.std(axis=1, ddof=1) / np.sqrt(reps.shape[1])
    c.fill_between(dose, mean - sem, mean + sem, color=BLUE, alpha=0.18)
    c.plot(dose, mean, "o-", color=BLUE, ms=3.6, lw=1.2)
    c.axhline(50, color=LIGHT, lw=0.7)
    c.axvline(0.72, color=LIGHT, lw=0.7)
    c.text(0.84, 0.84, "IC50 = 0.72 µM", transform=c.transAxes,
           ha="right")
    c.set_xscale("log")
    c.set_xticks([0.03, 0.1, 1, 10])
    c.set_xticklabels(["0.03", "0.1", "1", "10"])
    c.set(xlabel="CX-17 (µM)", ylabel="Cell viability (%)", ylim=(0, 106),
          title="Dose-response")

    # Forest plot: point estimates and confidence intervals.
    groups = ["All tumors", "Target-high", "Target-low", "Prior therapy"]
    effect = np.array([-0.74, -1.02, -0.34, -0.63])
    lo = np.array([-1.01, -1.36, -0.78, -1.09])
    hi = np.array([-0.47, -0.68, 0.10, -0.17])
    ypos = np.arange(len(groups))
    colors = [BLUE if upper < 0 else GRAY for upper in hi]
    for y0, value, low, high, color in zip(ypos, effect, lo, hi, colors):
        d.errorbar(value, y0, xerr=[[value - low], [high - value]], fmt="o",
                   color=color, ecolor=color, capsize=2, ms=4, lw=1.1)
    d.axvline(0, color=DARK, lw=0.7)
    d.set(yticks=ypos, yticklabels=groups,
          xlabel="Standardized treatment effect (95% CI)", xlim=(-1.55, 0.35),
          title="Subgroup consistency")
    d.invert_yaxis()
    d.text(0.02, 0.02, "Favors CX-17", transform=d.transAxes,
           ha="left", va="bottom", color=BLUE)

    finish(fig, [a, b, c, d], "Fig1_Efficacy")


def figure_2_mechanism() -> None:
    fig, axs = plt.subplots(2, 2, figsize=(7.1, 5.3), constrained_layout=True)
    a, b, c, d = axs.ravel()

    # Time course: stable semantic colors (red up, blue down).
    time = np.array([0, 2, 6, 12, 24])
    perk = np.array([1.00, 0.79, 0.55, 0.39, 0.31])
    casp = np.array([1.00, 1.10, 1.36, 1.71, 2.06])
    for values, color, label in ((perk, BLUE, "p-ERK"),
                                 (casp, RED, "Cleaved caspase-3")):
        err = np.array([0.04, 0.05, 0.06, 0.07, 0.08])
        a.fill_between(time, values - err, values + err, color=color, alpha=0.16)
        a.plot(time, values, "o-", color=color, label=label, ms=3.4)
    a.set(xlabel="Time after CX-17 (h)", ylabel="Relative signal",
          xticks=time, ylim=(0.15, 2.25), title="Pathway kinetics")
    a.legend(loc="upper left")

    # Correlation with fitted relationship.
    suppression = rng.uniform(12, 82, 34)
    apoptosis = 0.63 * suppression + 13 + rng.normal(0, 7.0, len(suppression))
    slope, intercept = np.polyfit(suppression, apoptosis, 1)
    xx = np.linspace(8, 86, 100)
    r = np.corrcoef(suppression, apoptosis)[0, 1]
    b.scatter(suppression, apoptosis, s=18, color=GRAY, alpha=0.82,
              edgecolor="white", linewidth=0.25)
    b.plot(xx, slope * xx + intercept, color=RED, lw=1.2)
    b.text(0.05, 0.93, f"r = {r:.2f}", transform=b.transAxes,
           ha="left", va="top")
    b.set(xlabel="Target suppression (%)", ylabel="Apoptotic cells (%)",
          xlim=(5, 90), ylim=(5, 75), title="Target-response coupling")

    # Enrichment bubble plot.
    pathways = ["Oxidative phosphorylation", "Cell cycle", "MYC targets",
                "Interferon response", "Apoptosis"]
    nes = np.array([-2.35, -1.82, -1.18, 1.42, 2.31])
    ratio = np.array([0.31, 0.26, 0.19, 0.23, 0.36])
    ypos = np.arange(len(pathways))
    colors = [BLUE if value < 0 else RED for value in nes]
    c.hlines(ypos, 0, nes, color=colors, lw=1.0, alpha=0.75)
    c.scatter(nes, ypos, s=420 * ratio, color=colors, edgecolor="white",
              linewidth=0.45, zorder=3)
    c.axvline(0, color=DARK, lw=0.6)
    c.set(yticks=ypos, yticklabels=pathways, xlabel="Normalized enrichment score",
          xlim=(-2.8, 2.8), title="Pathway enrichment")
    c.text(0.98, 0.02, "Bubble area = gene ratio", transform=c.transAxes,
           ha="right", va="bottom", color=GRAY, fontsize=6)

    # Compact expression heatmap.
    genes = ["DUSP6", "MYC", "CCND1", "BAX", "CASP3", "IFIT1"]
    matrix = np.array([
        [0.0, -0.6, -1.2, -1.7, -2.0],
        [0.1, -0.4, -1.0, -1.5, -1.8],
        [0.0, -0.2, -0.8, -1.3, -1.5],
        [0.0, 0.3, 0.8, 1.3, 1.6],
        [0.0, 0.2, 0.7, 1.4, 1.9],
        [0.0, 0.4, 1.0, 1.3, 1.5],
    ])
    d.pcolormesh(np.arange(6), np.arange(7), matrix, cmap="RdBu_r",
                 vmin=-2.2, vmax=2.2, shading="flat")
    d.set(xticks=np.arange(5) + 0.5, xticklabels=["0", "2", "6", "12", "24"],
          yticks=np.arange(len(genes)) + 0.5, yticklabels=genes,
          xlabel="Time (h)", title="Transcriptional program")
    d.set_ylim(len(genes), 0)
    cmap = plt.get_cmap("RdBu_r")
    d.legend(handles=[
        Patch(facecolor=cmap(0.95), edgecolor="none", label="+2"),
        Patch(facecolor=cmap(0.50), edgecolor=LIGHT, label="0"),
        Patch(facecolor=cmap(0.05), edgecolor="none", label="-2"),
    ], title="z-score", loc="center left", bbox_to_anchor=(1.01, 0.5),
       handlelength=0.9)

    finish(fig, [a, b, c, d], "Fig2_Mechanism")


def figure_3_validation() -> None:
    fig, axs = plt.subplots(2, 2, figsize=(7.1, 5.3), constrained_layout=True)
    a, b, c, d = axs.ravel()

    # Volcano plot with restrained annotation.
    n = 420
    logfc = rng.normal(0, 1.05, n)
    score = np.clip(np.abs(logfc) * 1.35 + rng.gamma(1.0, 0.7, n), 0, 6.2)
    selected = {
        "BAX": (2.35, 5.5), "CASP3": (1.85, 4.7), "IFIT1": (1.45, 4.0),
        "MYC": (-2.25, 5.2), "CCND1": (-1.72, 4.4), "DUSP6": (-1.38, 3.8),
    }
    for i, (_, (x0, y0)) in enumerate(selected.items()):
        logfc[i], score[i] = x0, y0
    sig_up = (logfc > 1) & (score > 1.3)
    sig_down = (logfc < -1) & (score > 1.3)
    colors = np.where(sig_up, RED, np.where(sig_down, BLUE, LIGHT))
    a.scatter(logfc, score, s=10, color=colors, alpha=0.78, edgecolor="none")
    a.axvline(-1, color=GRAY, lw=0.6, ls="--")
    a.axvline(1, color=GRAY, lw=0.6, ls="--")
    a.axhline(1.3, color=GRAY, lw=0.6, ls="--")
    for name, (x0, y0) in selected.items():
        a.annotate(name, (x0, y0), xytext=(3 if x0 > 0 else -3, 3),
                   textcoords="offset points", ha="left" if x0 > 0 else "right",
                   fontsize=6, color=DARK)
    a.set(xlabel="log2 fold change", ylabel="-log10(FDR)",
          xlim=(-3.5, 3.5), ylim=(0, 6.4), title="Differential expression")

    # ROC curves without an extra dependency.
    fpr = np.linspace(0, 1, 101)
    discovery = 1 - (1 - fpr) ** 5.2
    validation = 1 - (1 - fpr) ** 3.8
    auc_discovery = np.sum((discovery[1:] + discovery[:-1]) * np.diff(fpr) / 2)
    auc_validation = np.sum((validation[1:] + validation[:-1]) * np.diff(fpr) / 2)
    b.plot(fpr, discovery, color=RED, lw=1.3,
           label=f"Discovery  AUC={auc_discovery:.2f}")
    b.plot(fpr, validation, color=BLUE, lw=1.3,
           label=f"Validation  AUC={auc_validation:.2f}")
    b.plot([0, 1], [0, 1], color=GRAY, lw=0.7, ls="--")
    b.set(xlabel="1 - specificity", ylabel="Sensitivity", xlim=(0, 1),
          ylim=(0, 1.02), title="Independent classifier validation")
    b.set_aspect("equal", adjustable="box")
    b.legend(loc="lower right")

    # Kaplan-Meier style survival curves.
    months = np.arange(0, 37, 3)
    low = np.array([1.00, .97, .94, .91, .88, .84, .81, .78, .74, .71, .68, .65, .62])
    high = np.array([1.00, .92, .83, .75, .66, .59, .51, .45, .39, .34, .30, .27, .24])
    c.step(months, low, where="post", color=BLUE, lw=1.4, label="Low-risk score")
    c.step(months, high, where="post", color=RED, lw=1.4, label="High-risk score")
    c.plot(months[[4, 8, 11]], low[[4, 8, 11]], "+", color=BLUE, ms=5)
    c.plot(months[[3, 7, 10]], high[[3, 7, 10]], "+", color=RED, ms=5)
    c.text(0.97, 0.95, "Log-rank P = 0.012", transform=c.transAxes,
           ha="right", va="top", fontstyle="italic")
    c.set(xlabel="Time (months)", ylabel="Overall survival", xlim=(0, 36),
          ylim=(0, 1.03), title="Risk stratification")
    c.legend(loc="lower left")

    # Multivariable model forest plot.
    features = ["Risk score", "Stage III/IV", "Age >65", "CX-17 treatment"]
    odds = np.array([2.42, 1.88, 1.22, 0.54])
    lo = np.array([1.61, 1.20, 0.82, 0.34])
    hi = np.array([3.63, 2.94, 1.82, 0.86])
    ypos = np.arange(len(features))
    colors = [RED, RED, GRAY, BLUE]
    for y0, value, low, high, color in zip(ypos, odds, lo, hi, colors):
        d.errorbar(value, y0, xerr=[[value - low], [high - value]], fmt="o",
                   color=color, ecolor=color, capsize=2, ms=4, lw=1.1)
    d.axvline(1, color=DARK, lw=0.7)
    d.set_xscale("log")
    d.set(yticks=ypos, yticklabels=features, xlabel="Adjusted hazard ratio (95% CI)",
          xlim=(0.25, 5.0), title="Multivariable model")
    d.set_xticks([0.5, 1, 2, 4])
    d.set_xticklabels(["0.5", "1", "2", "4"])
    d.xaxis.set_minor_formatter(NullFormatter())
    d.invert_yaxis()

    finish(fig, [a, b, c, d], "Fig3_Validation")


def figure_4_cell_atlas() -> None:
    fig, axs = plt.subplots(2, 2, figsize=(7.1, 5.3), constrained_layout=True)
    a, b, c, d = axs.ravel()

    # Organic, non-isotropic UMAP-like manifolds with related immune states nearby.
    specs = [
        ("CD4 T", BLUE, (-2.55, 1.10), (0.68, 0.30), 18, 0.22, 260),
        ("CD8 T", "#6FA4D1", (-1.35, 1.55), (0.74, 0.26), -12, -0.18, 280),
        ("NK", GREEN, (-0.25, 1.28), (0.40, 0.22), 6, 0.12, 150),
        ("B", PURPLE, (-2.80, -0.12), (0.40, 0.27), -8, -0.10, 135),
        ("Myeloid", GOLD, (-1.10, -0.75), (0.92, 0.48), -14, 0.28, 420),
        ("Tumor", RED, (1.45, 0.48), (1.10, 0.58), 14, -0.34, 520),
        ("Fibroblast", TEAL, (1.55, -1.18), (0.78, 0.27), 17, 0.22, 230),
        ("Endothelial", "#7B8794", (0.20, -1.18), (0.44, 0.23), -8, -0.12, 140),
    ]
    label_positions = {
        "CD4 T": (-3.25, 1.95), "CD8 T": (-1.55, 2.20), "NK": (-0.18, 1.95),
        "B": (-3.35, -0.72), "Myeloid": (-1.30, -1.85), "Tumor": (2.45, 1.70),
        "Fibroblast": (2.20, -1.80), "Endothelial": (0.15, -1.78),
    }
    for name, color, center, scale, angle, bend, n in specs:
        z = rng.normal(size=(n, 2))
        z[:, 0] += bend * (z[:, 1] ** 2 - 1) + 0.08 * np.sin(3 * z[:, 1])
        z[:, 1] += 0.09 * np.sin(2.2 * z[:, 0])
        z *= np.asarray(scale)
        radians = np.deg2rad(angle)
        rotation = np.array([[np.cos(radians), -np.sin(radians)],
                             [np.sin(radians), np.cos(radians)]])
        cloud = z @ rotation.T + np.asarray(center)
        a.scatter(cloud[:, 0], cloud[:, 1], s=3.4, color=color, alpha=0.70,
                  edgecolor="none", rasterized=False)
        a.annotate(name, xy=center, xytext=label_positions[name],
                   color=color, fontsize=5.8, fontweight="bold", ha="center",
                   arrowprops={"arrowstyle": "-", "color": color, "lw": 0.55})
    a.set(xlabel="UMAP 1", ylabel="UMAP 2", title="Integrated cell atlas",
          xlim=(-3.9, 3.1), ylim=(-2.15, 2.45))
    a.set_xticks([])
    a.set_yticks([])

    # Myeloid subclustering with a fitted principal trajectory over the embedding.
    t_main = rng.uniform(0, 1, 620)
    main_x = -2.55 + 4.75 * t_main + 0.18 * np.sin(3 * np.pi * t_main)
    main_y = 0.62 * np.sin(1.35 * np.pi * t_main) - 0.22 * t_main
    main_x += rng.normal(0, 0.13, len(t_main))
    main_y += rng.normal(0, 0.15, len(t_main))
    t_branch = rng.uniform(0.42, 1, 230)
    s = (t_branch - 0.42) / 0.58
    branch_x = -0.55 + 2.25 * s + rng.normal(0, 0.13, len(s))
    branch_y = 0.48 - 1.55 * s + 0.10 * np.sin(2 * np.pi * s)
    branch_y += rng.normal(0, 0.13, len(s))
    tx = np.r_[main_x, branch_x]
    ty = np.r_[main_y, branch_y]
    pseudotime = np.r_[t_main, t_branch]
    time_colors = ["#D9E8F5", "#A7CBE5", "#6EA7D0", "#3E7EB6", "#1F568B"]
    for k, color in enumerate(time_colors):
        mask = (pseudotime >= k / 5) & (pseudotime <= (k + 1) / 5)
        b.scatter(tx[mask], ty[mask], s=4.2, color=color, edgecolor="none", alpha=0.76)
    curve_t = np.linspace(0, 1, 160)
    b.plot(-2.55 + 4.75 * curve_t + 0.18 * np.sin(3 * np.pi * curve_t),
           0.62 * np.sin(1.35 * np.pi * curve_t) - 0.22 * curve_t,
           color=DARK, lw=0.8)
    curve_s = np.linspace(0, 1, 100)
    b.plot(-0.55 + 2.25 * curve_s,
           0.48 - 1.55 * curve_s + 0.10 * np.sin(2 * np.pi * curve_s),
           color=DARK, lw=0.8)
    b.text(-2.58, -0.28, "Mono", color=GRAY, fontsize=6)
    b.text(2.18, -0.20, "TAM", color=BLUE, fontsize=6, ha="right")
    b.text(2.34, -1.43, "DC-like", color=BLUE, fontsize=6, ha="right",
           va="bottom")
    b.legend(handles=[Patch(facecolor=color, edgecolor="none", label=label)
                      for color, label in zip(time_colors, ["0", ".25", ".5", ".75", "1"])],
             title="Pseudotime", ncol=5, loc="lower left", fontsize=5.1,
             title_fontsize=5.4, handlelength=0.7, columnspacing=0.55)
    b.set(xlabel="UMAP 1", ylabel="UMAP 2", title="Myeloid-state trajectory",
          xlim=(-2.9, 2.5), ylim=(-1.55, 1.05))
    b.set_xticks([])
    b.set_yticks([])

    # Hexagonal spatial spots on an irregular tissue section, with a scale bar.
    theta = np.linspace(0, 2 * np.pi, 240)
    radius = 1 + 0.11 * np.sin(3 * theta + 0.5) + 0.07 * np.cos(5 * theta)
    boundary = np.c_[2.30 * radius * np.cos(theta), 1.50 * radius * np.sin(theta)]
    tissue_path = MplPath(boundary, closed=True)
    c.add_patch(Polygon(boundary, closed=True, facecolor="#F6EEEA", edgecolor=DARK,
                        linewidth=0.75, zorder=0))
    spots = []
    for row, y0 in enumerate(np.arange(-1.62, 1.63, 0.16)):
        xs = np.arange(-2.55, 2.56, 0.16) + (0.08 if row % 2 else 0)
        spots.extend((x0, y0) for x0 in xs)
    spots = np.asarray(spots)
    spots = spots[tissue_path.contains_points(spots)]
    tumor_score = np.exp(-((spots[:, 0] - 0.70) ** 2 / 0.80 +
                           (spots[:, 1] - 0.15) ** 2 / 0.48))
    immune_score = np.exp(-((spots[:, 0] + 0.35) ** 2 / 0.34 +
                            (spots[:, 1] - 0.55) ** 2 / 0.22))
    myeloid_score = np.exp(-((spots[:, 0] - 0.05) ** 2 / 0.50 +
                             (spots[:, 1] + 0.65) ** 2 / 0.25))
    domain = np.full(len(spots), 3)
    domain[myeloid_score > 0.42] = 2
    domain[immune_score > 0.38] = 1
    domain[tumor_score > 0.36] = 0
    spatial_colors = np.array([RED, BLUE, GOLD, TEAL])
    c.scatter(spots[:, 0], spots[:, 1], s=7.2, color=spatial_colors[domain],
              edgecolor="white", linewidth=0.22, zorder=2)
    tumor_outline = 1 + 0.09 * np.sin(4 * theta)
    c.plot(0.70 + 0.95 * tumor_outline * np.cos(theta),
           0.15 + 0.68 * tumor_outline * np.sin(theta),
           color=RED, lw=0.65, ls="--", zorder=3)
    c.legend(handles=[Patch(facecolor=color, edgecolor="none", label=label)
                      for color, label in zip(spatial_colors,
                                              ["Tumor", "T cell", "Myeloid", "Stroma"])],
             loc="upper left", ncol=2, fontsize=5.4, handlelength=0.8,
             columnspacing=0.8)
    c.plot([1.25, 2.00], [-1.47, -1.47], color=DARK, lw=1.8)
    c.text(1.625, -1.39, "500 µm", ha="center", va="bottom", fontsize=5.6)
    c.set_aspect("equal")
    c.set(xlim=(-2.65, 2.65), ylim=(-1.75, 1.75), title="Spatially mapped cell states")
    c.set_xticks([])
    c.set_yticks([])
    for spine in c.spines.values():
        spine.set_visible(False)

    # Cell-type marker dot plot.
    cell_types = ["CD4 T", "CD8 T", "NK", "Myeloid", "Tumor", "Fibroblast", "Endothelial"]
    genes = ["CD3D", "CD8A", "NKG7", "LST1", "EPCAM", "COL1A1", "VWF"]
    expression = np.array([
        [0.95, 0.20, 0.12, 0.05, 0.03, 0.03, 0.02],
        [0.88, 0.92, 0.42, 0.05, 0.03, 0.03, 0.02],
        [0.20, 0.55, 0.95, 0.08, 0.03, 0.02, 0.03],
        [0.05, 0.04, 0.18, 0.96, 0.05, 0.10, 0.05],
        [0.03, 0.03, 0.05, 0.06, 0.97, 0.08, 0.03],
        [0.03, 0.02, 0.03, 0.12, 0.05, 0.96, 0.10],
        [0.02, 0.02, 0.04, 0.08, 0.04, 0.12, 0.97],
    ])
    fraction = np.clip(expression + rng.normal(0, 0.08, expression.shape), 0.04, 1)
    palette = np.array(["#E6E8EB", "#B9D6E8", "#72A9CF", "#2F6FB3"])
    for iy in range(len(cell_types)):
        for ix in range(len(genes)):
            level = min(int(expression[iy, ix] * 4), 3)
            d.scatter(ix, iy, s=18 + 120 * fraction[iy, ix],
                      color=palette[level], edgecolor="white", linewidth=0.4)
    d.set(xticks=np.arange(len(genes)), xticklabels=genes,
          yticks=np.arange(len(cell_types)), yticklabels=cell_types,
          title="Canonical marker expression")
    d.tick_params(axis="x", rotation=42)
    d.set_xlim(-0.65, len(genes) + 1.45)
    d.set_ylim(len(cell_types) - 0.35, -0.65)
    d.grid(color="#ECEEF1", lw=0.45)
    d.legend(handles=[
        plt.Line2D([], [], marker="o", ls="", ms=4, color=GRAY,
                   label="25% cells"),
        plt.Line2D([], [], marker="o", ls="", ms=8, color=GRAY,
                   label="75% cells"),
    ], loc="center right", fontsize=5.8)

    finish(fig, [a, b, c, d], "Fig4_CellAtlas")


def figure_5_systems_map() -> None:
    fig, axs = plt.subplots(2, 2, figsize=(7.1, 5.3), constrained_layout=True)
    a, b, c, d = axs.ravel()

    # Directed intercellular signaling map.
    labels = ["Tumor", "T cell", "Myeloid", "Stromal", "Endothelial", "NK"]
    node_colors = [RED, BLUE, GOLD, TEAL, PURPLE, GREEN]
    angles = np.linspace(np.pi / 2, np.pi / 2 + 2 * np.pi, len(labels), endpoint=False)
    coords = np.c_[1.18 * np.cos(angles), 1.18 * np.sin(angles)]
    edges = [(0, 1, 4.8), (2, 0, 4.0), (3, 0, 3.3), (1, 2, 2.8),
             (4, 3, 2.3), (5, 0, 3.6), (0, 4, 2.1), (2, 1, 2.5)]
    for source, target, weight in edges:
        start, end = coords[source], coords[target]
        curve = 0.20 if (source + target) % 2 else -0.20
        arrow = FancyArrowPatch(start, end, connectionstyle=f"arc3,rad={curve}",
                                arrowstyle="-|>", mutation_scale=6,
                                lw=0.35 + 0.32 * weight, color=node_colors[source],
                                alpha=0.48, shrinkA=15, shrinkB=15)
        a.add_patch(arrow)
    for angle, (x, y), label, color in zip(angles, coords, labels, node_colors):
        a.add_patch(Circle((x, y), 0.14, facecolor=color, edgecolor="white", lw=1.0,
                           zorder=3))
        tx, ty = 1.48 * np.cos(angle), 1.48 * np.sin(angle)
        ha = "center" if abs(tx) < 0.25 else ("left" if tx > 0 else "right")
        a.text(tx, ty, label, ha=ha, va="center", fontsize=5.8,
               color=color, fontweight="bold", zorder=4)
    a.set_xlim(-1.6, 1.6)
    a.set_ylim(-1.55, 1.55)
    a.set_aspect("equal")
    a.set_xticks([])
    a.set_yticks([])
    for spine in a.spines.values():
        spine.set_visible(False)
    a.set_title("Cell-cell communication network", pad=4)

    # Multi-omic pathway activity matrix.
    pathways = ["MAPK", "Apoptosis", "IFN", "Cell cycle", "Hypoxia", "EMT"]
    layers = ["RNA", "Protein", "ATAC", "Metabolite"]
    activity = np.array([
        [-1.7, -1.3, -0.9, -0.4],
        [1.6, 1.3, 0.8, 0.5],
        [1.1, 0.7, 1.5, 0.2],
        [-1.4, -1.1, -0.7, -0.3],
        [0.4, 0.9, 0.3, 1.4],
        [0.7, 0.4, 1.0, 0.8],
    ])
    b.pcolormesh(np.arange(5), np.arange(7), activity, cmap="RdBu_r",
                 vmin=-2, vmax=2, shading="flat", edgecolors="white", linewidth=0.8)
    for iy in range(activity.shape[0]):
        for ix in range(activity.shape[1]):
            b.text(ix + 0.5, iy + 0.5, f"{activity[iy, ix]:+.1f}",
                   ha="center", va="center", fontsize=5.8,
                   color="white" if abs(activity[iy, ix]) > 1.0 else DARK)
    b.set(xticks=np.arange(len(layers)) + 0.5, xticklabels=layers,
          yticks=np.arange(len(pathways)) + 0.5, yticklabels=pathways,
          title="Cross-platform pathway activity")
    b.set_ylim(len(pathways), 0)
    b.tick_params(length=0)

    # Causal mediation diagram with effect sizes.
    nodes = {
        "CX-17": (0.12, 0.60, BLUE),
        "Target\nsuppression": (0.38, 0.78, TEAL),
        "Apoptosis": (0.66, 0.78, RED),
        "Tumor\nresponse": (0.87, 0.46, PURPLE),
        "Immune\nactivation": (0.50, 0.25, GOLD),
    }
    links = [
        ("CX-17", "Target\nsuppression", "0.74"),
        ("Target\nsuppression", "Apoptosis", "0.61"),
        ("Apoptosis", "Tumor\nresponse", "0.49"),
        ("CX-17", "Immune\nactivation", "0.38"),
        ("Immune\nactivation", "Tumor\nresponse", "0.27"),
    ]
    for source, target, effect in links:
        x0, y0, color = nodes[source]
        x1, y1, _ = nodes[target]
        c.annotate("", xy=(x1, y1), xytext=(x0, y0),
                   arrowprops={"arrowstyle": "-|>", "color": color,
                               "lw": 1.0, "shrinkA": 15, "shrinkB": 15})
        c.text((x0 + x1) / 2, (y0 + y1) / 2 + 0.045, effect,
               fontsize=5.8, color=DARK, ha="center", va="center",
               bbox={"boxstyle": "round,pad=0.12", "fc": "white",
                     "ec": "none", "alpha": 0.9})
    for label, (x, y, color) in nodes.items():
        c.add_patch(Circle((x, y), 0.083, facecolor=color, edgecolor="white", lw=1.0,
                           transform=c.transAxes, zorder=3))
        c.text(x, y, label, transform=c.transAxes, ha="center", va="center",
               fontsize=5.1, color="white", fontweight="bold", zorder=4)
    c.text(0.98, 0.03, "Standardized path coefficients", transform=c.transAxes,
           ha="right", color=GRAY, fontsize=6)
    c.axis("off")
    c.set_title("Causal mediation model", pad=4)

    # Vector response landscape with two optimization trajectories.
    x = np.linspace(-2.5, 2.5, 80)
    y = np.linspace(-2.1, 2.1, 70)
    xx, yy = np.meshgrid(x, y)
    zz = (1.25 * np.exp(-((xx - 0.85) ** 2 + (yy - 0.5) ** 2) / 0.75)
          + 0.85 * np.exp(-((xx + 1.1) ** 2 + (yy + 0.65) ** 2) / 1.0)
          - 0.16 * (xx ** 2 + yy ** 2))
    d.contourf(xx, yy, zz, levels=9,
               colors=["#F3F4F6", "#E6EDF3", "#D1E1EC", "#B6D1E1", "#95BED3",
                       "#70A6C1", "#4C8CAE", "#347497", "#245C7B"])
    d.contour(xx, yy, zz, levels=7, colors="white", linewidths=0.45, alpha=0.8)
    paths = [np.c_[np.linspace(-2.0, 0.8, 16),
                   np.linspace(1.5, 0.5, 16) + 0.12 * np.sin(np.linspace(0, 3, 16))],
             np.c_[np.linspace(2.0, 0.8, 16),
                   np.linspace(-1.5, 0.5, 16) - 0.10 * np.sin(np.linspace(0, 3, 16))]]
    for path, color, label in zip(paths, [GOLD, RED], ["Schedule A", "Schedule B"]):
        d.plot(path[:, 0], path[:, 1], "o-", color=color, ms=2.5, lw=1.0,
               label=label, markeredgecolor="white", markeredgewidth=0.25)
    d.scatter([0.85], [0.5], s=34, marker="*", color="white", edgecolor=DARK,
              linewidth=0.5, zorder=5)
    d.set(xlabel="Target engagement", ylabel="Immune activation",
          title="Therapeutic response landscape")
    d.legend(loc="lower right", fontsize=6.2)

    finish(fig, [a, b, c, d], "Fig5_SystemsMap", label_dx=0.014)


def figure_6_model_insight() -> None:
    fig, axs = plt.subplots(2, 2, figsize=(7.1, 5.3), constrained_layout=True)
    a, b, c, d = axs.ravel()

    # SHAP-style feature impact map.
    features = ["Target score", "T-cell state", "Tumor burden", "IFN module", "Age"]
    spreads = [0.78, 0.62, 0.48, 0.40, 0.28]
    for y0, (feature, spread) in enumerate(zip(features, spreads)):
        values = np.clip(rng.normal(0, spread, 90), -1.8, 1.8)
        feature_value = np.clip(0.5 + 0.28 * values / spread + rng.normal(0, 0.12, 90), 0, 1)
        jitter = rng.normal(0, 0.085, len(values))
        bins = np.digitize(feature_value, [0.25, 0.50, 0.75])
        point_colors = np.array([BLUE, "#7EA5C8", "#C49A9A", RED])[bins]
        a.scatter(values, y0 + jitter, s=9, color=point_colors, alpha=0.72,
                  edgecolor="none")
    a.axvline(0, color=GRAY, lw=0.7)
    a.set(yticks=np.arange(len(features)), yticklabels=features,
          xlabel="Feature contribution", title="Model explanation map")
    a.set_ylim(len(features) - 0.45, -0.55)
    a.text(0.02, 0.02, "Low feature value", transform=a.transAxes,
           color=BLUE, fontsize=6)
    a.text(0.98, 0.02, "High feature value", transform=a.transAxes,
           color=RED, fontsize=6, ha="right")

    # Calibration curves with uncertainty envelopes.
    predicted = np.linspace(0.05, 0.95, 10)
    observed_internal = np.clip(predicted + 0.03 * np.sin(6 * predicted), 0, 1)
    observed_external = np.clip(predicted ** 1.10 + 0.035 * np.cos(5 * predicted), 0, 1)
    b.plot([0, 1], [0, 1], color=GRAY, lw=0.7, ls="--", label="Ideal")
    for observed, color, label, band in [
        (observed_internal, RED, "Internal", 0.045),
        (observed_external, BLUE, "External", 0.065),
    ]:
        b.fill_between(predicted, np.clip(observed - band, 0, 1),
                       np.clip(observed + band, 0, 1), color=color, alpha=0.14)
        b.plot(predicted, observed, "o-", color=color, ms=3.2, lw=1.15, label=label)
    b.set(xlabel="Predicted probability", ylabel="Observed probability",
          xlim=(0, 1), ylim=(0, 1), title="Cross-cohort calibration")
    b.set_aspect("equal", adjustable="box")
    b.legend(loc="upper left", fontsize=6.2)

    # Decision-curve analysis.
    threshold = np.linspace(0.05, 0.80, 90)
    model = 0.22 * np.exp(-1.7 * threshold) - 0.025 * threshold
    clinical = 0.15 * np.exp(-2.5 * threshold) - 0.045 * threshold
    treat_all = 0.16 - 0.27 * threshold / (1 - threshold)
    c.plot(threshold, model, color=RED, lw=1.35, label="Integrated model")
    c.plot(threshold, clinical, color=BLUE, lw=1.2, label="Clinical model")
    c.plot(threshold, treat_all, color=GRAY, lw=0.9, ls="--", label="Treat all")
    c.axhline(0, color=DARK, lw=0.7, label="Treat none")
    c.fill_between(threshold, clinical, model, where=model >= clinical,
                   color=RED, alpha=0.10)
    c.set(xlabel="Risk threshold", ylabel="Net benefit", ylim=(-0.08, 0.24),
          title="Clinical utility")
    c.legend(loc="upper right", fontsize=6.2)

    # Repeated external validation as estimates with confidence intervals.
    cohorts = ["Discovery", "Hospital A", "Hospital B", "Prospective"]
    auc = np.array([0.89, 0.85, 0.82, 0.84])
    lo = np.array([0.85, 0.80, 0.76, 0.78])
    hi = np.array([0.93, 0.90, 0.88, 0.90])
    ypos = np.arange(len(cohorts))
    d.hlines(ypos, lo, hi, color=[RED, BLUE, BLUE, TEAL], lw=1.6)
    d.scatter(auc, ypos, s=30, color=[RED, BLUE, BLUE, TEAL],
              edgecolor="white", linewidth=0.55, zorder=3)
    for y0, value in zip(ypos, auc):
        d.text(0.972, y0, f"{value:.2f}", ha="right", va="center",
               fontsize=6.2, fontweight="bold")
    d.axvline(0.80, color=GRAY, lw=0.7, ls="--")
    d.set(yticks=ypos, yticklabels=cohorts, xlabel="AUC (95% CI)",
          xlim=(0.68, 0.98), title="Transportability across cohorts")
    d.invert_yaxis()

    finish(fig, [a, b, c, d], "Fig6_ModelInsight")


if __name__ == "__main__":
    figure_1_efficacy()
    figure_2_mechanism()
    figure_3_validation()
    figure_4_cell_atlas()
    figure_5_systems_map()
    figure_6_model_insight()
    print("all panel-alignment audits passed")

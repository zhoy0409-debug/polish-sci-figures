"""Generate a three-figure publication-style demo suite.

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
from matplotlib.patches import Patch


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
rng = np.random.default_rng(20260715)


def finish(fig, axes, stem: str) -> None:
    """Apply the shared release checks and export all master formats."""
    add_panel_labels(fig, axes, style="(a)", dx=-0.018, dy=0.008,
                     fontsize=9, grid_cluster=0.10)
    warnings = audit_label_alignment(fig)
    assert not warnings, warnings
    for ext in ("png", "svg", "pdf"):
        path = OUT / f"{stem}.{ext}"
        fig.savefig(path, dpi=300 if ext == "png" else None)
        print(f"wrote {path}")
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
    a.text(0.5, y + 0.025, r"$\mathit{P} = 4.8 \times 10^{-4}$",
           ha="center", va="bottom")
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
    b.text(0.5, 2.05, r"$\mathit{P} = 0.002$", ha="center", va="top")
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
    c.text(0.84, 0.84, "IC$_{50}$ = 0.72 µM", transform=c.transAxes,
           ha="right")
    c.set_xscale("log")
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
    a.set(xlabel="log$_2$ fold change", ylabel="-log$_{10}$(FDR)",
          xlim=(-3.5, 3.5), ylim=(0, 6.4), title="Differential expression")

    # ROC curves without an extra dependency.
    fpr = np.linspace(0, 1, 101)
    discovery = 1 - (1 - fpr) ** 5.2
    validation = 1 - (1 - fpr) ** 3.8
    auc_discovery = np.trapz(discovery, fpr)
    auc_validation = np.trapz(validation, fpr)
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
    c.text(0.97, 0.95, r"Log-rank $\mathit{P} = 0.012$", transform=c.transAxes,
           ha="right", va="top")
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
    d.invert_yaxis()

    finish(fig, [a, b, c, d], "Fig3_Validation")


if __name__ == "__main__":
    figure_1_efficacy()
    figure_2_mechanism()
    figure_3_validation()
    print("all panel-alignment audits passed")

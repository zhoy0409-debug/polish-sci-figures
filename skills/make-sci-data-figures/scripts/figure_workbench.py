#!/usr/bin/env python3
"""Reproducible raw-data-to-figure workbench.

The implementation is intentionally small: it handles common independent and
paired group comparisons, records every assumption, and refuses to pretend it
covers complex experimental designs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import os
import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from PIL import Image
from scipy import stats

FIGSIZE = (4.8, 3.6)
DPI = 200
DEFAULT_FONT = "Arial"
RNG_SEED = 20260719

# Some Windows Arial files contain optional metadata tables that fontTools does
# not subset into PDF. The artwork remains valid; keep that harmless internals
# message out of the user-facing command log.
logging.getLogger("fontTools.subset").setLevel(logging.ERROR)


def read_table(path: Path, sheet: str | int = 0) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path)
    if suffix in {".tsv", ".txt"}:
        return pd.read_csv(path, sep="\t")
    if suffix in {".xlsx", ".xls"}:
        return pd.read_excel(path, sheet_name=sheet)
    raise ValueError(f"Unsupported input type: {suffix}. Use CSV, TSV, or XLSX.")


def json_ready(value):
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return None if not np.isfinite(value) else float(value)
    if isinstance(value, (np.ndarray,)):
        return value.tolist()
    if pd.isna(value):
        return None
    return value


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False, default=json_ready), encoding="utf-8")


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_palettes() -> dict[str, list[str]]:
    path = Path(__file__).resolve().parents[1] / "assets" / "palettes.json"
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_palette(name: str, colors: str | None, n: int) -> list[str]:
    if colors:
        palette = [c.strip() for c in colors.split(",") if c.strip()]
    else:
        palettes = load_palettes()
        if name not in palettes:
            raise ValueError(f"Unknown palette '{name}'. Choose from: {', '.join(palettes)}")
        palette = palettes[name]
    if len(palette) < n:
        palette = (palette * math.ceil(n / len(palette)))[:n]
    return palette[:n]


def resolve_font(requested: str) -> tuple[str, str | None]:
    try:
        path = fm.findfont(requested, fallback_to_default=False)
        return requested, path
    except ValueError:
        fallback_path = fm.findfont("DejaVu Sans")
        return "DejaVu Sans", fallback_path


def style(font: str) -> None:
    plt.rcParams.update({
        "font.family": font,
        "font.size": 10.5,
        "axes.labelsize": 12,
        "xtick.labelsize": 10.5,
        "ytick.labelsize": 10.5,
        "legend.fontsize": 10,
        "mathtext.fontset": "custom",
        "mathtext.rm": font,
        "mathtext.it": f"{font}:italic",
        "mathtext.bf": f"{font}:bold",
        "axes.linewidth": 0.8,
        "xtick.major.width": 0.8,
        "ytick.major.width": 0.8,
        "svg.fonttype": "none",
        "pdf.fonttype": 42,
        "savefig.transparent": False,
    })


def profile_data(df: pd.DataFrame, group: str | None = None, value: str | None = None,
                 subject: str | None = None) -> dict:
    profile = {
        "rows": int(len(df)),
        "columns": list(df.columns),
        "column_types": {c: str(df[c].dtype) for c in df.columns},
        "missing": {c: int(df[c].isna().sum()) for c in df.columns},
        "duplicate_rows": int(df.duplicated().sum()),
        "warnings": [],
    }
    if group:
        if group not in df:
            raise ValueError(f"Group column '{group}' was not found.")
        profile["group_counts"] = {str(k): int(v) for k, v in df[group].value_counts(dropna=False).items()}
    if value:
        if value not in df:
            raise ValueError(f"Value column '{value}' was not found.")
        numeric = pd.to_numeric(df[value], errors="coerce")
        profile["non_numeric_outcomes"] = int((df[value].notna() & numeric.isna()).sum())
        profile["outcome_summary"] = {
            "n": int(numeric.notna().sum()), "mean": numeric.mean(), "sd": numeric.std(),
            "median": numeric.median(), "min": numeric.min(), "max": numeric.max(),
        }
    if subject:
        if subject not in df:
            raise ValueError(f"Subject column '{subject}' was not found.")
        if group:
            repeats = df.groupby(subject)[group].nunique(dropna=True)
            profile["subjects"] = int(df[subject].nunique(dropna=True))
            profile["subjects_in_multiple_groups"] = int((repeats > 1).sum())
            profile["duplicate_unit_group_rows"] = int(df.duplicated([subject, group], keep=False).sum())
    else:
        profile["warnings"].append(
            "No subject/biological-unit column was declared; independence cannot be verified from the table."
        )
    return profile


def bootstrap_ci(values: np.ndarray, statistic=np.mean, seed: int = RNG_SEED,
                 iterations: int = 5000) -> tuple[float, float]:
    values = np.asarray(values, dtype=float)
    values = values[np.isfinite(values)]
    if len(values) < 2:
        return (float("nan"), float("nan"))
    rng = np.random.default_rng(seed)
    indices = rng.integers(0, len(values), size=(iterations, len(values)))
    sampled = values[indices]
    estimates = np.apply_along_axis(statistic, 1, sampled)
    return tuple(np.percentile(estimates, [2.5, 97.5]))


def mean_ci(values: np.ndarray) -> tuple[float, float]:
    values = np.asarray(values, dtype=float)
    if len(values) < 2:
        return (float("nan"), float("nan"))
    mean = float(np.mean(values))
    half = float(stats.t.ppf(0.975, len(values) - 1) * stats.sem(values))
    return mean - half, mean + half


def welch_difference_ci(reference: np.ndarray, comparison: np.ndarray) -> tuple[float, float, float]:
    n0, n1 = len(reference), len(comparison)
    v0, v1 = np.var(reference, ddof=1), np.var(comparison, ddof=1)
    se2 = v0 / n0 + v1 / n1
    if se2 <= 0:
        return (float("nan"), float("nan"), float("nan"))
    df = se2**2 / ((v0 / n0) ** 2 / (n0 - 1) + (v1 / n1) ** 2 / (n1 - 1))
    difference = float(np.mean(comparison) - np.mean(reference))
    half = float(stats.t.ppf(0.975, df) * math.sqrt(se2))
    return difference - half, difference + half, float(df)


def welch_anova(groups: list[np.ndarray]) -> tuple[float, float, float, float]:
    """Welch one-way ANOVA without assuming equal variances."""
    groups = [np.asarray(g, float) for g in groups]
    n = np.array([len(g) for g in groups], float)
    means = np.array([np.mean(g) for g in groups])
    variances = np.array([np.var(g, ddof=1) for g in groups])
    if np.any(n < 2) or np.any(variances <= 0):
        return (float("nan"), float("nan"), float("nan"), float("nan"))
    weights = n / variances
    mean_w = np.sum(weights * means) / np.sum(weights)
    k = len(groups)
    term = np.sum(((1 - weights / np.sum(weights)) ** 2) / (n - 1))
    numerator = np.sum(weights * (means - mean_w) ** 2) / (k - 1)
    denominator = 1 + (2 * (k - 2) / (k**2 - 1)) * term
    f_value = numerator / denominator
    df1 = k - 1
    df2 = (k**2 - 1) / (3 * term)
    p_value = stats.f.sf(f_value, df1, df2)
    return float(f_value), float(p_value), float(df1), float(df2)


def format_p_value(p: float) -> str:
    """Return an exact compact value; italic P is added separately by mathtext."""
    if not np.isfinite(p):
        return "unavailable"
    if p != 0 and abs(p) < 0.001:
        exponent = int(math.floor(math.log10(abs(p))))
        coefficient = p / (10**exponent)
        return f"{coefficient:.2f} $\\times$ 10$^{{{exponent}}}$"
    return f"{p:.3f}"


def analyse(df: pd.DataFrame, group: str, value: str, order: list[str], design: str,
            subject: str | None) -> tuple[dict, pd.DataFrame]:
    if not subject:
        raise ValueError("Inference requires --unit with the biological experimental-unit column.")
    work = df[[c for c in [group, value, subject] if c]].copy()
    numeric = pd.to_numeric(work[value], errors="coerce")
    invalid_numeric = work[value].notna() & numeric.isna()
    if invalid_numeric.any():
        examples = work.loc[invalid_numeric, value].astype(str).drop_duplicates().head(5).tolist()
        raise ValueError(f"Outcome column contains non-numeric values that need an explicit rule: {examples}")
    work[value] = numeric
    before = len(work)
    work = work.dropna(subset=[group, value])
    if work[subject].isna().any():
        raise ValueError("The biological experimental-unit column contains missing IDs.")
    if not np.isfinite(work[value].to_numpy(float)).all():
        raise ValueError("The outcome column contains infinite values; resolve them before analysis.")
    dropped = before - len(work)
    arrays = [work.loc[work[group].astype(str) == g, value].to_numpy(float) for g in order]
    if any(len(x) < 3 for x in arrays):
        raise ValueError("Inferential output requires at least three biological experimental units per group.")
    if design == "independent" and work[subject].duplicated(keep=False).any():
        raise ValueError(
            "Independent data contain repeated experimental-unit IDs. Use a paired/repeated/nested design or "
            "declare how technical replicates are aggregated; rows will not be silently treated as independent."
        )
    diagnostics = {}
    for name, values in zip(order, arrays):
        q1, q3 = np.percentile(values, [25, 75])
        iqr = q3 - q1
        outliers = int(np.sum((values < q1 - 1.5 * iqr) | (values > q3 + 1.5 * iqr))) if iqr > 0 else 0
        diagnostics[name] = {
            "n": len(values),
            "skewness": float(stats.skew(values, bias=False)),
            "iqr_rule_outlier_count": outliers,
            "shape_warning": "Distribution diagnostics are unstable with n < 8." if len(values) < 8 else None,
        }
    result = {
        "design": design,
        "group_order": order,
        "group_n": {g: int(len(x)) for g, x in zip(order, arrays)},
        "rows_dropped_for_missing_group_or_outcome": int(dropped),
        "primary_estimand": None,
        "primary_test": None,
        "sensitivity_test": None,
        "multiplicity": "No pairwise family was tested by this workbench.",
        "assumption_diagnostics": diagnostics,
        "limitations": [],
    }
    if len(order) == 2 and design == "independent":
        a, b = arrays
        diff = float(np.mean(b) - np.mean(a))
        ci_low, ci_high, welch_df = welch_difference_ci(a, b)
        rng = np.random.default_rng(RNG_SEED)
        boot = np.array([
            np.mean(rng.choice(b, len(b), replace=True)) - np.mean(rng.choice(a, len(a), replace=True))
            for _ in range(5000)
        ])
        t = stats.ttest_ind(b, a, equal_var=False, nan_policy="omit")
        mw = stats.mannwhitneyu(b, a, alternative="two-sided")
        result["primary_estimand"] = {"name": f"mean({order[1]}) - mean({order[0]})", "estimate": diff,
                                       "ci95": [ci_low, ci_high], "ci_method": "Welch-Satterthwaite",
                                       "bootstrap_ci95_sensitivity": np.percentile(boot, [2.5, 97.5]).tolist()}
        result["primary_test"] = {"name": "Welch two-sample t-test", "statistic": t.statistic,
                                   "degrees_of_freedom": welch_df, "p_value": t.pvalue}
        result["sensitivity_test"] = {"name": "Mann-Whitney U rank/distribution test",
                                       "statistic": mw.statistic, "p_value": mw.pvalue}
        result["limitations"].append("Independence is a user-declared assumption; verify the biological unit.")
    elif len(order) == 2 and design == "paired":
        if not subject:
            raise ValueError("Paired design requires --subject.")
        duplicate_cells = work.duplicated([subject, group], keep=False)
        if duplicate_cells.any():
            raise ValueError(
                "Paired data contain multiple rows for the same subject and group. Declare whether these are "
                "technical replicates, repeated measurements, or separate biological units before aggregation/modeling."
            )
        pivot = work.pivot(index=subject, columns=group, values=value)
        missing_cols = [g for g in order if g not in pivot]
        if missing_cols:
            raise ValueError(f"Paired groups missing from subject table: {missing_cols}")
        complete = pivot[order].dropna()
        if len(complete) < 3:
            raise ValueError("Paired inference needs at least three complete pairs.")
        diffs = complete[order[1]].to_numpy() - complete[order[0]].to_numpy()
        ci = mean_ci(diffs)
        t = stats.ttest_rel(complete[order[1]], complete[order[0]])
        try:
            wilcoxon = stats.wilcoxon(diffs)
            sensitivity = {"name": "Wilcoxon signed-rank test", "statistic": wilcoxon.statistic,
                           "p_value": wilcoxon.pvalue}
        except ValueError as exc:
            sensitivity = {"name": "Wilcoxon signed-rank test", "error": str(exc)}
        result["complete_pairs"] = int(len(complete))
        result["incomplete_subjects_excluded"] = int(len(pivot) - len(complete))
        result["primary_estimand"] = {"name": f"paired mean({order[1]} - {order[0]})",
                                       "estimate": float(np.mean(diffs)), "ci95": list(ci),
                                       "ci_method": "paired t interval",
                                       "bootstrap_ci95_sensitivity": list(bootstrap_ci(diffs))}
        result["primary_test"] = {"name": "Paired t-test", "statistic": t.statistic, "p_value": t.pvalue}
        result["sensitivity_test"] = sensitivity
        return result, complete.reset_index()
    elif len(order) > 2 and design == "independent":
        f_value, p_value, df1, df2 = welch_anova(arrays)
        kw = stats.kruskal(*arrays)
        result["primary_estimand"] = {
            "name": "group means with 95% t confidence intervals",
            "groups": {g: {"mean": float(np.mean(x)), "ci95": list(mean_ci(x)),
                            "bootstrap_ci95_sensitivity": list(bootstrap_ci(x))}
                       for g, x in zip(order, arrays)},
        }
        result["primary_test"] = {"name": "Welch one-way ANOVA", "statistic": f_value,
                                   "p_value": p_value, "df1": df1, "df2": df2}
        result["sensitivity_test"] = {"name": "Kruskal-Wallis rank/distribution test",
                                       "statistic": kw.statistic, "p_value": kw.pvalue}
        result["limitations"].append("A global test does not identify pairwise differences; no post-hoc claims were made.")
    else:
        raise ValueError("This compact workbench supports paired designs only for exactly two groups.")
    return result, work


def add_stat_line(fig, analysis: dict) -> None:
    primary = analysis.get("primary_test") or {}
    p = primary.get("p_value", float("nan"))
    estimand = analysis.get("primary_estimand") or {}
    if "estimate" in estimand and "ci95" in estimand:
        low, high = estimand["ci95"]
        line = f"Mean difference = {estimand['estimate']:.3g} (95% CI {low:.3g} to {high:.3g})"
    else:
        line = "Group estimates with 95% CIs"
    if analysis.get("display_p_value"):
        line += f"; $\\it{{P}}$ = {format_p_value(p)}"
    # Align the evidence line to the plotting area's left edge.  This keeps a
    # candidate series visually square instead of letting different text
    # lengths create a ragged right-anchored hierarchy.
    fig.text(0.20, 0.945, line,
             ha="left", va="top", fontsize=9.5, color="#333333")


def finish_axes(fig, ax, ylabel: str) -> None:
    ax.set_ylabel(ylabel)
    ax.set_xlabel("")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", color="#D9DEE4", linewidth=0.6, alpha=0.75, zorder=0)
    ax.set_axisbelow(True)
    fig.subplots_adjust(left=0.20, right=0.96, bottom=0.20, top=0.82)


def plot_points_ci(work: pd.DataFrame, group: str, value: str, order: list[str], colors: list[str],
                   ylabel: str, analysis: dict):
    fig, ax = plt.subplots(figsize=FIGSIZE)
    rng = np.random.default_rng(RNG_SEED)
    for i, (g, color) in enumerate(zip(order, colors)):
        vals = work.loc[work[group].astype(str) == g, value].to_numpy(float)
        jitter = rng.uniform(-0.16, 0.16, size=len(vals))
        ax.scatter(np.full(len(vals), i) + jitter, vals, s=24, alpha=0.72, color=color,
                   edgecolor="white", linewidth=0.35, zorder=3)
        mean = np.mean(vals)
        lo, hi = mean_ci(vals)
        ax.errorbar(i, mean, yerr=[[mean - lo], [hi - mean]], fmt="o", color="#20242A",
                    markerfacecolor="white", markeredgewidth=1.2, markersize=5.5,
                    capsize=4, linewidth=1.25, zorder=5)
    ax.set_xticks(range(len(order)), order)
    finish_axes(fig, ax, ylabel)
    add_stat_line(fig, analysis)
    return fig


def plot_box_points(work: pd.DataFrame, group: str, value: str, order: list[str], colors: list[str],
                    ylabel: str, analysis: dict):
    fig, ax = plt.subplots(figsize=FIGSIZE)
    arrays = [work.loc[work[group].astype(str) == g, value].to_numpy(float) for g in order]
    bp = ax.boxplot(arrays, positions=range(len(order)), widths=0.48, patch_artist=True,
                    showfliers=False, medianprops={"color": "#20242A", "linewidth": 1.2},
                    whiskerprops={"color": "#606872"}, capprops={"color": "#606872"})
    for patch, color in zip(bp["boxes"], colors):
        patch.set(facecolor=color, alpha=0.22, edgecolor=color, linewidth=1.1)
    rng = np.random.default_rng(RNG_SEED)
    for i, (vals, color) in enumerate(zip(arrays, colors)):
        ax.scatter(np.full(len(vals), i) + rng.uniform(-0.14, 0.14, len(vals)), vals,
                   s=23, color=color, alpha=0.72, edgecolor="white", linewidth=0.35, zorder=3)
    ax.set_xticks(range(len(order)), order)
    finish_axes(fig, ax, ylabel)
    add_stat_line(fig, analysis)
    return fig


def plot_violin_points(work: pd.DataFrame, group: str, value: str, order: list[str], colors: list[str],
                       ylabel: str, analysis: dict):
    fig, ax = plt.subplots(figsize=FIGSIZE)
    arrays = [work.loc[work[group].astype(str) == g, value].to_numpy(float) for g in order]
    vp = ax.violinplot(arrays, positions=range(len(order)), widths=0.74,
                       showmeans=False, showmedians=True, showextrema=False)
    for body, color in zip(vp["bodies"], colors):
        body.set_facecolor(color)
        body.set_edgecolor(color)
        body.set_alpha(0.20)
    vp["cmedians"].set_color("#20242A")
    rng = np.random.default_rng(RNG_SEED)
    for i, (vals, color) in enumerate(zip(arrays, colors)):
        ax.scatter(np.full(len(vals), i) + rng.uniform(-0.12, 0.12, len(vals)), vals,
                   s=21, color=color, alpha=0.72, edgecolor="white", linewidth=0.3, zorder=3)
    ax.set_xticks(range(len(order)), order)
    finish_axes(fig, ax, ylabel)
    add_stat_line(fig, analysis)
    return fig


def plot_paired(complete: pd.DataFrame, subject: str, order: list[str], colors: list[str],
                ylabel: str, analysis: dict):
    fig, ax = plt.subplots(figsize=FIGSIZE)
    for _, row in complete.iterrows():
        ax.plot([0, 1], [row[order[0]], row[order[1]]], color="#A9B0B7", linewidth=0.8, alpha=0.75, zorder=1)
    for i, (g, color) in enumerate(zip(order, colors)):
        ax.scatter(np.full(len(complete), i), complete[g], s=28, color=color,
                   edgecolor="white", linewidth=0.35, zorder=3)
    ax.set_xticks([0, 1], order)
    finish_axes(fig, ax, ylabel)
    add_stat_line(fig, analysis)
    return fig


def plot_paired_difference(complete: pd.DataFrame, order: list[str], color: str,
                           ylabel: str, analysis: dict):
    fig, ax = plt.subplots(figsize=FIGSIZE)
    diffs = complete[order[1]].to_numpy(float) - complete[order[0]].to_numpy(float)
    rng = np.random.default_rng(RNG_SEED)
    ax.scatter(rng.uniform(-0.10, 0.10, len(diffs)), diffs, s=26, color=color, alpha=0.75,
               edgecolor="white", linewidth=0.35, zorder=3)
    mean = float(np.mean(diffs))
    low, high = analysis["primary_estimand"]["ci95"]
    ax.errorbar(0, mean, yerr=[[mean - low], [high - mean]], fmt="o", color="#20242A",
                markerfacecolor="white", markeredgewidth=1.2, markersize=5.5,
                capsize=4, linewidth=1.25, zorder=5)
    ax.axhline(0, color="#8E98A3", linewidth=0.8, linestyle="--", zorder=1)
    ax.set_xticks([0], [f"{order[1]} − {order[0]}"])
    finish_axes(fig, ax, f"Difference in {ylabel}")
    add_stat_line(fig, analysis)
    return fig


def save_figure(fig, stem: Path) -> None:
    for ext in ("png", "svg", "pdf"):
        output = stem.with_suffix(f".{ext}")
        fig.savefig(output, dpi=DPI, facecolor="white")
        if ext == "svg":
            # Matplotlib leaves spaces at the ends of multi-line path data.
            # Removing them is semantics-preserving and keeps the public
            # artifact friendly to source-control whitespace checks.
            svg = output.read_text(encoding="utf-8")
            output.write_text("\n".join(line.rstrip() for line in svg.splitlines()) + "\n", encoding="utf-8")
    plt.close(fig)


def make_gallery(pngs: list[Path], output: Path) -> None:
    images = []
    for path in pngs:
        with Image.open(path) as opened:
            images.append(opened.convert("RGB"))
    width = max(im.width for im in images)
    height = max(im.height for im in images)
    gutter = 24
    # A vertical contact sheet preserves each panel's intended reading size on
    # a README page.  Three-across thumbnails make otherwise adequate type
    # illegible and introduce unrequested mini-titles.
    canvas = Image.new("RGB", (width, height * len(images) + gutter * (len(images) - 1)), "white")
    for i, im in enumerate(images):
        canvas.paste(im, ((width - im.width) // 2, i * (height + gutter)))
    canvas.save(output)


def generate(input_path: Path, group: str, value: str, design: str, outdir: Path,
             subject: str | None = None, order_text: str | None = None,
             palette_name: str = "zhoy_muted", colors_text: str | None = None,
             unit_label: str | None = None, font_requested: str = DEFAULT_FONT,
             outcome_type: str = "continuous", scope: str = "exploratory",
             show_p_value: bool = False) -> list[Path]:
    df = read_table(input_path)
    if group not in df or value not in df:
        raise ValueError(f"Expected columns '{group}' and '{value}'. Found: {list(df.columns)}")
    observed = [str(x) for x in df[group].dropna().drop_duplicates()]
    order = [x.strip() for x in order_text.split(",")] if order_text else observed
    missing_groups = [x for x in order if x not in observed]
    if missing_groups:
        raise ValueError(f"Requested group order contains absent groups: {missing_groups}")
    if set(order) != set(observed):
        raise ValueError("--order must contain every observed group exactly once.")
    if not subject:
        raise ValueError("--unit is required so rows cannot be mistaken for independent biological replicates.")
    if outcome_type != "continuous":
        raise ValueError("This workbench currently supports continuous outcomes only.")
    if show_p_value and scope != "confirmatory":
        raise ValueError("--show-p-value requires --scope confirmatory and a pre-specified analysis family.")
    outdir.mkdir(parents=True, exist_ok=True)
    profile = profile_data(df, group, value, subject)
    actual_font, font_path = resolve_font(font_requested)
    if actual_font != font_requested:
        profile["warnings"].append(
            f"Requested font '{font_requested}' was unavailable; rendered with '{actual_font}'. Regenerate on a system with the target font before submission."
        )
    style(actual_font)
    analysis, plotting_data = analyse(df, group, value, order, design, subject)
    analysis["experimental_unit_column"] = subject
    analysis["outcome_type"] = outcome_type
    analysis["scope"] = scope
    analysis["display_p_value"] = bool(show_p_value)
    if scope == "exploratory":
        analysis["limitations"].append(
            "Exploratory scope: P values are recorded for transparency but are not displayed or treated as confirmatory."
        )
    else:
        analysis["limitations"].append(
            "Confirmatory scope is user-declared. Verify that the outcome, contrast, analysis family, stopping rule, "
            "and any multiplicity control were pre-specified; this workbench cannot infer a study protocol."
        )
    analysis["font"] = {
        "requested": font_requested,
        "actual": actual_font,
        "file": Path(font_path).name if font_path else None,
    }
    analysis["source_file"] = input_path.name
    analysis["source_sha256"] = file_sha256(input_path)
    analysis["synthetic_example"] = "synthetic" in input_path.name.lower()
    colors = resolve_palette(palette_name, colors_text, len(order))
    ylabel = value if not unit_label else f"{value} ({unit_label})"
    figures = []
    if design == "paired":
        stem = outdir / "paired_trajectories"
        save_figure(plot_paired(plotting_data, subject, order, colors, ylabel, analysis), stem)
        figures.append(stem.with_suffix(".png"))
        stem = outdir / "paired_difference"
        save_figure(plot_paired_difference(plotting_data, order, colors[1], ylabel, analysis), stem)
        figures.append(stem.with_suffix(".png"))
    else:
        stem = outdir / "raw_points_estimate_ci"
        save_figure(plot_points_ci(plotting_data, group, value, order, colors, ylabel, analysis), stem)
        figures.append(stem.with_suffix(".png"))
        stem = outdir / "box_raw_points"
        save_figure(plot_box_points(plotting_data, group, value, order, colors, ylabel, analysis), stem)
        figures.append(stem.with_suffix(".png"))
        counts = [int((plotting_data[group].astype(str) == g).sum()) for g in order]
        if min(counts) >= 10:
            stem = outdir / "violin_raw_points"
            save_figure(plot_violin_points(plotting_data, group, value, order, colors, ylabel, analysis), stem)
            figures.append(stem.with_suffix(".png"))
        else:
            analysis["limitations"].append("Violin candidate omitted because at least one group had fewer than 10 observations.")
    write_json(outdir / "data_profile.json", profile)
    write_json(outdir / "analysis_plan.json", analysis)
    try:
        recipe_input = os.path.relpath(input_path.resolve(), start=outdir.resolve())
    except ValueError:
        recipe_input = str(input_path.resolve())
    recipe = {
        "input": recipe_input, "group": group, "value": value, "design": design,
        "subject": subject, "order": order, "palette": palette_name, "colors": colors_text,
        "unit_label": unit_label, "font": font_requested, "outcome_type": outcome_type,
        "scope": scope, "show_p_value": show_p_value, "figsize_inches": FIGSIZE,
        "note": "Recoloring must not change data, statistics, geometry, labels, or group order.",
    }
    write_json(outdir / "figure_recipe.json", recipe)
    make_gallery(figures, outdir / "candidate_gallery.png")
    return figures


def run_profile(args) -> None:
    df = read_table(Path(args.input))
    payload = profile_data(df, args.group, args.value, args.subject)
    if args.output:
        write_json(Path(args.output), payload)
    else:
        print(json.dumps(payload, indent=2, ensure_ascii=False, default=json_ready))


def run_generate(args) -> None:
    files = generate(Path(args.input), args.group, args.value, args.design, Path(args.outdir),
                     args.subject, args.order, args.palette, args.colors, args.unit_label, args.font,
                     args.outcome_type, args.scope, args.show_p_value)
    print(f"Generated {len(files)} candidates in {Path(args.outdir).resolve()}")


def run_recolor(args) -> None:
    recipe_path = Path(args.recipe).resolve()
    recipe = json.loads(recipe_path.read_text(encoding="utf-8"))
    source = Path(recipe["input"])
    if not source.is_absolute():
        source = (recipe_path.parent / source).resolve()
    generate(source, recipe["group"], recipe["value"], recipe["design"],
             Path(args.outdir), recipe.get("subject"), ",".join(recipe["order"]),
             args.palette, args.colors, recipe.get("unit_label"), recipe.get("font", DEFAULT_FONT),
             recipe.get("outcome_type", "continuous"), recipe.get("scope", "exploratory"),
             recipe.get("show_p_value", False))
    print(f"Recolored figures written to {Path(args.outdir).resolve()}")


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)
    profile = sub.add_parser("profile", help="Inspect structure and missingness before inference")
    profile.add_argument("input")
    profile.add_argument("--group")
    profile.add_argument("--value")
    profile.add_argument("--unit", dest="subject")
    profile.add_argument("--output")
    profile.set_defaults(func=run_profile)
    gen = sub.add_parser("generate", help="Generate fixed-canvas figure candidates")
    gen.add_argument("input")
    gen.add_argument("--group", required=True)
    gen.add_argument("--value", required=True)
    gen.add_argument("--design", required=True, choices=["independent", "paired"])
    gen.add_argument("--unit", dest="subject", required=True,
                     help="Column identifying the biological experimental unit")
    gen.add_argument("--order", required=True, help="Comma-separated authoritative group order")
    gen.add_argument("--outcome-type", required=True, choices=["continuous"])
    gen.add_argument("--scope", choices=["exploratory", "confirmatory"], default="exploratory")
    gen.add_argument("--show-p-value", action="store_true")
    gen.add_argument("--palette", default="zhoy_muted")
    gen.add_argument("--colors", help="Comma-separated hex colors; overrides --palette")
    gen.add_argument("--unit-label")
    gen.add_argument("--font", default=DEFAULT_FONT)
    gen.add_argument("--outdir", required=True)
    gen.set_defaults(func=run_generate)
    recolor = sub.add_parser("recolor", help="Rerender a saved recipe using a new palette")
    recolor.add_argument("recipe")
    recolor.add_argument("--palette", default="okabe_ito")
    recolor.add_argument("--colors")
    recolor.add_argument("--outdir", required=True)
    recolor.set_defaults(func=run_recolor)
    return p


def main() -> None:
    warnings.filterwarnings("once", category=UserWarning)
    args = parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

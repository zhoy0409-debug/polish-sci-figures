#!/usr/bin/env python3
"""Validated figure families for common scientific data structures.

This module complements ``figure_workbench.py``.  The original workbench owns
inferential continuous-outcome group comparisons; this one provides rigorous
descriptive workflows for relationships, longitudinal trajectories,
compositions, and tidy matrices without inventing specialist inference.
"""

from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
import numpy as np
import pandas as pd
from scipy import stats
from scipy.cluster import hierarchy
from scipy.spatial.distance import pdist

from figure_workbench import (
    DEFAULT_FONT,
    FIGSIZE,
    clean_axis,
    file_sha256,
    make_gallery,
    mean_ci,
    read_table,
    resolve_font,
    resolve_palette,
    save_figure,
    style,
    write_json,
)

RNG_SEED = 20260719


def _require_columns(df: pd.DataFrame, columns: list[str]) -> None:
    missing = [column for column in columns if column not in df]
    if missing:
        raise ValueError(f"Missing required columns: {missing}. Found: {list(df.columns)}")


def _numeric(series: pd.Series, name: str) -> pd.Series:
    converted = pd.to_numeric(series, errors="coerce")
    bad = series.notna() & converted.isna()
    if bad.any():
        examples = series[bad].astype(str).drop_duplicates().head(3).tolist()
        raise ValueError(f"Column '{name}' contains non-numeric values, for example {examples}.")
    return converted


def _font_profile(requested: str) -> tuple[str, dict]:
    actual, path = resolve_font(requested)
    payload = {
        "requested": requested,
        "actual": actual,
        "file": Path(path).name if path else None,
        "warning": None,
    }
    if actual != requested:
        payload["warning"] = (
            f"Requested font '{requested}' was unavailable; rendered with '{actual}'. "
            "Regenerate where the target font is installed before submission."
        )
    style(actual)
    return actual, payload


def _profile(
    input_path: Path, df: pd.DataFrame, used: pd.DataFrame, font: dict, columns: list[str]
) -> dict:
    return {
        "source_file": input_path.name,
        "source_sha256": file_sha256(input_path),
        "rows_input": int(len(df)),
        "rows_used": int(len(used)),
        "rows_excluded_for_missing_required_values": int(len(df) - len(used)),
        "columns_used": columns,
        "duplicate_rows": int(df.duplicated().sum()),
        "font": font,
        "synthetic_example": "synthetic" in input_path.name.lower(),
    }


def _axis(ax) -> None:
    clean_axis(ax)
    ax.tick_params(length=3.5, pad=3)


def _display_label(name: str) -> str:
    """Make machine-friendly headers readable without altering scientific case."""
    text = str(name).replace("_", " ").strip()
    if text and text.islower():
        text = text[0].upper() + text[1:]
    return text


def _finish(fig) -> None:
    fig.subplots_adjust(left=0.17, right=0.96, bottom=0.17, top=0.96)


def _save_bundle(
    outdir: Path, figures: list[tuple[str, plt.Figure]], profile: dict, analysis: dict, recipe: dict
) -> list[Path]:
    outdir.mkdir(parents=True, exist_ok=True)
    pngs: list[Path] = []
    for name, fig in figures:
        stem = outdir / name
        save_figure(fig, stem)
        pngs.append(stem.with_suffix(".png"))
    write_json(outdir / "data_profile.json", profile)
    write_json(outdir / "analysis_plan.json", analysis)
    write_json(outdir / "figure_recipe.json", recipe)
    make_gallery(pngs, outdir / "candidate_gallery.png")
    return pngs


def _relative_input(input_path: Path, outdir: Path) -> str:
    try:
        return os.path.relpath(input_path.resolve(), start=outdir.resolve())
    except ValueError:
        return str(input_path.resolve())


def _fit_summary(x: np.ndarray, y: np.ndarray) -> dict:
    pearson = stats.pearsonr(x, y)
    spearman = stats.spearmanr(x, y)
    fit = stats.linregress(x, y)
    return {
        "n": int(len(x)),
        "pearson_r": float(pearson[0]),
        "pearson_p": float(pearson[1]),
        "spearman_rho": float(spearman[0]),
        "spearman_p": float(spearman[1]),
        "linear_slope": float(fit.slope),
        "linear_slope_se": float(fit.stderr),
        "linear_intercept": float(fit.intercept),
        "linear_r_squared": float(fit.rvalue**2),
    }


def _regression_band(ax, x: np.ndarray, y: np.ndarray, color: str) -> None:
    fit = stats.linregress(x, y)
    x_grid = np.linspace(float(np.min(x)), float(np.max(x)), 160)
    y_fit = fit.intercept + fit.slope * x_grid
    residuals = y - (fit.intercept + fit.slope * x)
    dof = len(x) - 2
    if dof > 0 and np.var(x, ddof=1) > 0:
        residual_se = math.sqrt(float(np.sum(residuals**2)) / dof)
        x_bar = float(np.mean(x))
        ssx = float(np.sum((x - x_bar) ** 2))
        band_se = residual_se * np.sqrt(1 / len(x) + (x_grid - x_bar) ** 2 / ssx)
        delta = stats.t.ppf(0.975, dof) * band_se
        ax.fill_between(
            x_grid, y_fit - delta, y_fit + delta, color=color, alpha=0.13, linewidth=0, zorder=1
        )
    ax.plot(x_grid, y_fit, color=color, linewidth=1.7, zorder=2)


def _relationship_figures(
    data: pd.DataFrame, x: str, y: str, group: str | None, colors: list[str]
) -> list[tuple[str, plt.Figure]]:
    groups = [None] if group is None else data[group].astype(str).drop_duplicates().tolist()
    fig, ax = plt.subplots(figsize=FIGSIZE)
    for index, level in enumerate(groups):
        subset = data if level is None else data[data[group].astype(str) == level]
        color = colors[index]
        ax.scatter(
            subset[x],
            subset[y],
            s=28,
            color=color,
            alpha=0.72,
            edgecolor="white",
            linewidth=0.35,
            label=level,
            zorder=3,
        )
        if len(subset) >= 4 and subset[x].nunique() > 1 and subset[y].nunique() > 1:
            _regression_band(ax, subset[x].to_numpy(float), subset[y].to_numpy(float), color)
    ax.set_xlabel(_display_label(x))
    ax.set_ylabel(_display_label(y))
    if group is not None:
        ax.legend(frameon=False, loc="best", handletextpad=0.45)
    _axis(ax)
    _finish(fig)

    fig_joint = plt.figure(figsize=FIGSIZE)
    grid = fig_joint.add_gridspec(4, 4, hspace=0.08, wspace=0.08)
    ax_top = fig_joint.add_subplot(grid[0, :3])
    ax_main = fig_joint.add_subplot(grid[1:, :3])
    ax_right = fig_joint.add_subplot(grid[1:, 3])
    for index, level in enumerate(groups):
        subset = data if level is None else data[data[group].astype(str) == level]
        color = colors[index]
        label = None if level is None else level
        ax_main.scatter(
            subset[x],
            subset[y],
            s=24,
            color=color,
            alpha=0.68,
            edgecolor="white",
            linewidth=0.3,
            label=label,
        )
        ax_top.hist(
            subset[x],
            bins="auto",
            density=True,
            histtype="stepfilled",
            color=color,
            alpha=0.22,
            linewidth=1.0,
        )
        ax_right.hist(
            subset[y],
            bins="auto",
            density=True,
            orientation="horizontal",
            histtype="stepfilled",
            color=color,
            alpha=0.22,
            linewidth=1.0,
        )
    ax_main.set_xlabel(_display_label(x))
    ax_main.set_ylabel(_display_label(y))
    if group is not None:
        ax_main.legend(frameon=False, loc="best", handletextpad=0.35)
    _axis(ax_main)
    ax_top.set_axis_off()
    ax_right.set_axis_off()
    fig_joint.subplots_adjust(left=0.17, right=0.96, bottom=0.17, top=0.96)
    return [("relationship_regression", fig), ("relationship_joint_distribution", fig_joint)]


def relationship(
    input_path: Path,
    x: str,
    y: str,
    unit: str,
    outdir: Path,
    group: str | None = None,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    df = read_table(input_path)
    columns = [unit, x, y] + ([group] if group else [])
    _require_columns(df, columns)
    data = df[columns].dropna().copy()
    data[x], data[y] = _numeric(data[x], x), _numeric(data[y], y)
    if data[unit].duplicated().any():
        raise ValueError(
            "Relationship analysis requires one row per biological unit; repeated unit IDs were found."
        )
    if len(data) < 6:
        raise ValueError("Relationship analysis requires at least six complete biological units.")
    if data[x].nunique() < 3 or data[y].nunique() < 3:
        raise ValueError("Relationship analysis requires variation in both numeric variables.")
    levels = ["all"] if group is None else data[group].astype(str).drop_duplicates().tolist()
    if group and any((data[group].astype(str) == level).sum() < 4 for level in levels):
        raise ValueError("Each displayed group needs at least four complete biological units.")
    _, font_info = _font_profile(font)
    colors = resolve_palette(palette, colors_text, len(levels))
    estimates = {"overall": _fit_summary(data[x].to_numpy(float), data[y].to_numpy(float))}
    if group:
        estimates["by_group"] = {
            level: _fit_summary(
                data.loc[data[group].astype(str) == level, x].to_numpy(float),
                data.loc[data[group].astype(str) == level, y].to_numpy(float),
            )
            for level in levels
        }
    analysis = {
        "family": "relationship",
        "experimental_unit_column": unit,
        "estimands": estimates,
        "inference_scope": "association",
        "decisions": [
            "Pearson correlation and ordinary least-squares slope describe linear association.",
            "Spearman correlation is retained as a monotonic sensitivity summary.",
            "When groups are present, group-specific lines are displayed; no cross-group slope difference is claimed.",
        ],
        "limitations": [
            "Association is not causation.",
            "Measurement error, nonlinear structure, confounding, censoring, and "
            "clustered sampling require a specified model.",
            "Recorded P values are descriptive unless the hypothesis and multiplicity family were pre-specified.",
        ],
    }
    recipe = {
        "family": "relationship",
        "input": _relative_input(input_path, outdir),
        "x": x,
        "y": y,
        "unit": unit,
        "group": group,
        "palette": palette,
        "colors": colors_text,
        "font": font,
        "figsize_inches": FIGSIZE,
        "note": "Palette changes preserve data, fits, limits, labels, and grouping.",
    }
    figures = _relationship_figures(data, x, y, group, colors)
    return _save_bundle(
        outdir, figures, _profile(input_path, df, data, font_info, columns), analysis, recipe
    )


def _time_summary(data: pd.DataFrame, group: str, time: str, value: str) -> list[dict]:
    result = []
    for (level, moment), subset in data.groupby([group, time], sort=False):
        values = subset[value].to_numpy(float)
        low, high = mean_ci(values)
        result.append(
            {
                "group": str(level),
                "time": float(moment),
                "n_units": int(len(values)),
                "mean": float(np.mean(values)),
                "ci95": [low, high],
            }
        )
    return result


def _timecourse_figures(
    data: pd.DataFrame, time: str, value: str, group: str, unit: str, colors: list[str]
) -> list[tuple[str, plt.Figure]]:
    levels = data[group].astype(str).drop_duplicates().tolist()
    fig, ax = plt.subplots(figsize=FIGSIZE)
    for index, level in enumerate(levels):
        subset = data[data[group].astype(str) == level]
        color = colors[index]
        for _, subject_data in subset.groupby(unit, sort=False):
            subject_data = subject_data.sort_values(time)
            ax.plot(
                subject_data[time],
                subject_data[value],
                color=color,
                alpha=0.16,
                linewidth=0.8,
                zorder=1,
            )
        summary = subset.groupby(time, sort=True)[value].agg(["mean", "count", "sem"]).reset_index()
        critical = summary["count"].map(lambda n: stats.t.ppf(0.975, n - 1) if n > 1 else np.nan)
        delta = critical * summary["sem"]
        ax.fill_between(
            summary[time].to_numpy(float),
            (summary["mean"] - delta).to_numpy(float),
            (summary["mean"] + delta).to_numpy(float),
            color=color,
            alpha=0.16,
            linewidth=0,
        )
        ax.plot(
            summary[time],
            summary["mean"],
            marker="o",
            markersize=4.5,
            color=color,
            linewidth=1.8,
            label=level,
            zorder=3,
        )
    ax.set_xlabel(_display_label(time))
    ax.set_ylabel(_display_label(value))
    ax.legend(frameon=False, handletextpad=0.4)
    _axis(ax)
    _finish(fig)

    centered = data.copy()
    baseline = centered.sort_values(time).groupby(unit, sort=False)[value].first()
    centered["__change"] = centered[value] - centered[unit].map(baseline)
    fig_change, ax_change = plt.subplots(figsize=FIGSIZE)
    for index, level in enumerate(levels):
        subset = centered[centered[group].astype(str) == level]
        summary = (
            subset.groupby(time, sort=True)["__change"].agg(["mean", "count", "sem"]).reset_index()
        )
        critical = summary["count"].map(lambda n: stats.t.ppf(0.975, n - 1) if n > 1 else np.nan)
        delta = critical * summary["sem"]
        ax_change.fill_between(
            summary[time].to_numpy(float),
            (summary["mean"] - delta).to_numpy(float),
            (summary["mean"] + delta).to_numpy(float),
            color=colors[index],
            alpha=0.17,
            linewidth=0,
        )
        ax_change.plot(
            summary[time],
            summary["mean"],
            marker="o",
            markersize=4.5,
            color=colors[index],
            linewidth=1.8,
            label=level,
        )
    ax_change.axhline(0, color="#8E98A3", linestyle=(0, (3, 2)), linewidth=0.85)
    ax_change.set_xlabel(_display_label(time))
    ax_change.set_ylabel(f"Change in {str(value).replace('_', ' ')}")
    ax_change.legend(frameon=False, handletextpad=0.4)
    _axis(ax_change)
    _finish(fig_change)
    return [("timecourse_trajectories", fig), ("timecourse_change_from_baseline", fig_change)]


def timecourse(
    input_path: Path,
    time: str,
    value: str,
    group: str,
    unit: str,
    outdir: Path,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    df = read_table(input_path)
    columns = [unit, group, time, value]
    _require_columns(df, columns)
    data = df[columns].dropna().copy()
    data[time], data[value] = _numeric(data[time], time), _numeric(data[value], value)
    if data.duplicated([unit, time]).any():
        raise ValueError("Each biological unit may have only one observation at each time value.")
    group_membership = data.groupby(unit)[group].nunique()
    if (group_membership > 1).any():
        raise ValueError(
            "A biological unit appears in multiple groups; encode crossover periods explicitly before plotting."
        )
    levels = data[group].astype(str).drop_duplicates().tolist()
    if len(levels) < 1 or any(
        data.loc[data[group].astype(str) == level, unit].nunique() < 3 for level in levels
    ):
        raise ValueError("Each group needs at least three biological units.")
    if any(data.loc[data[group].astype(str) == level, time].nunique() < 2 for level in levels):
        raise ValueError("Each group needs at least two observed time values.")
    _, font_info = _font_profile(font)
    colors = resolve_palette(palette, colors_text, len(levels))
    analysis = {
        "family": "timecourse",
        "experimental_unit_column": unit,
        "summary_by_group_and_time": _time_summary(data, group, time, value),
        "inference_scope": "descriptive longitudinal",
        "decisions": [
            "Faint lines preserve individual trajectories; thick lines and ribbons "
            "show group means and 95% t intervals.",
            "A second candidate subtracts each unit's earliest observed value to expose within-unit change.",
        ],
        "limitations": [
            "Pointwise intervals are not simultaneous confidence bands.",
            "No repeated-measures hypothesis test is run automatically.",
            "Inferential claims about time, group, interaction, nonlinear change, missingness, "
            "or random effects require a pre-specified mixed or longitudinal model.",
        ],
    }
    recipe = {
        "family": "timecourse",
        "input": _relative_input(input_path, outdir),
        "time": time,
        "value": value,
        "group": group,
        "unit": unit,
        "palette": palette,
        "colors": colors_text,
        "font": font,
        "figsize_inches": FIGSIZE,
        "note": "Palette changes preserve observations, summaries, intervals, labels, and group order.",
    }
    figures = _timecourse_figures(data, time, value, group, unit, colors)
    return _save_bundle(
        outdir, figures, _profile(input_path, df, data, font_info, columns), analysis, recipe
    )


def _composition_figures(
    proportions: pd.DataFrame, sample: str, category: str, group: str | None, colors: list[str]
) -> list[tuple[str, plt.Figure]]:
    sample_order = proportions[[sample] + ([group] if group else [])].drop_duplicates()
    if group:
        sample_order = sample_order.sort_values([group, sample], kind="stable")
    ordered_samples = sample_order[sample].astype(str).tolist()
    categories = proportions[category].astype(str).drop_duplicates().tolist()
    pivot = proportions.pivot(index=sample, columns=category, values="__proportion").fillna(0)
    pivot.index = pivot.index.astype(str)
    pivot = pivot.reindex(index=ordered_samples, columns=categories, fill_value=0)

    fig, ax = plt.subplots(figsize=FIGSIZE)
    bottom = np.zeros(len(pivot))
    x_pos = np.arange(len(pivot))
    for index, level in enumerate(categories):
        values = pivot[level].to_numpy(float)
        ax.bar(
            x_pos,
            values,
            bottom=bottom,
            width=0.82,
            color=colors[index],
            edgecolor="white",
            linewidth=0.35,
            label=level,
        )
        bottom += values
    ax.set_ylim(0, 1)
    ax.set_ylabel("Proportion")
    ax.set_xlabel(_display_label(sample))
    if len(pivot) <= 12:
        ax.set_xticks(x_pos, ordered_samples, rotation=45, ha="right")
    else:
        ax.set_xticks([])
    if group:
        cursor = 0
        group_counts = sample_order.groupby(group, sort=False)[sample].count()
        for group_name, count in group_counts.items():
            midpoint = cursor + (int(count) - 1) / 2
            ax.text(
                midpoint,
                1.015,
                str(group_name),
                transform=ax.get_xaxis_transform(),
                ha="center",
                va="bottom",
                fontsize=10,
                color="#3B4148",
                clip_on=False,
            )
            cursor += int(count)
            if cursor < len(sample_order):
                ax.axvline(cursor - 0.5, color="#6F7780", linewidth=0.7, zorder=5)
    ax.legend(
        frameon=False,
        bbox_to_anchor=(1.01, 1),
        loc="upper left",
        borderaxespad=0,
        handlelength=1.0,
        handletextpad=0.4,
    )
    clean_axis(ax)
    fig.subplots_adjust(left=0.17, right=0.77, bottom=0.20, top=0.91 if group else 0.96)

    cmap = LinearSegmentedColormap.from_list("composition", ["#FFFFFF", colors[0]])
    fig_heat, ax_heat = plt.subplots(figsize=FIGSIZE)
    image = ax_heat.imshow(
        pivot.to_numpy(float),
        aspect="auto",
        interpolation="nearest",
        cmap=cmap,
        vmin=0,
        vmax=max(0.01, float(pivot.to_numpy().max())),
    )
    ax_heat.set_xlabel(_display_label(category))
    ax_heat.set_ylabel(_display_label(sample))
    ax_heat.set_xticks(np.arange(len(categories)), categories, rotation=45, ha="right")
    if len(pivot) <= 14:
        ax_heat.set_yticks(np.arange(len(pivot)), ordered_samples)
    else:
        ax_heat.set_yticks([])
    for spine in ax_heat.spines.values():
        spine.set_visible(False)
    colorbar = fig_heat.colorbar(image, ax=ax_heat, fraction=0.045, pad=0.03)
    colorbar.set_label("Proportion")
    colorbar.outline.set_linewidth(0.6)
    fig_heat.subplots_adjust(left=0.18, right=0.91, bottom=0.24, top=0.96)
    return [("composition_stacked", fig), ("composition_heatmap", fig_heat)]


def composition(
    input_path: Path,
    sample: str,
    category: str,
    value: str,
    outdir: Path,
    group: str | None = None,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    df = read_table(input_path)
    columns = [sample, category, value] + ([group] if group else [])
    _require_columns(df, columns)
    data = df[columns].dropna().copy()
    data[sample] = data[sample].astype(str)
    data[category] = data[category].astype(str)
    if group:
        data[group] = data[group].astype(str)
    data[value] = _numeric(data[value], value)
    if (data[value] < 0).any():
        raise ValueError("Composition values must be non-negative.")
    if data.duplicated([sample, category]).any():
        raise ValueError(
            "Each sample-category cell must be unique; aggregate technical rows explicitly first."
        )
    if group and (data.groupby(sample)[group].nunique() > 1).any():
        raise ValueError("Each sample must belong to exactly one group.")
    totals = data.groupby(sample)[value].transform("sum")
    if (totals <= 0).any():
        raise ValueError("Every sample must have a positive total composition value.")
    data["__proportion"] = data[value] / totals
    categories = data[category].astype(str).drop_duplicates().tolist()
    samples = data[sample].drop_duplicates().tolist()
    if len(categories) < 2:
        raise ValueError("Composition data require at least two categories.")
    if len(categories) > 12:
        raise ValueError(
            "More than 12 categories would make the fixed publication canvas unreadable; "
            "pre-specify aggregation or use a specialist composition view."
        )
    _, font_info = _font_profile(font)
    colors = resolve_palette(palette, colors_text, len(categories))
    analysis = {
        "family": "composition",
        "sample_column": sample,
        "normalization": "Each sample was divided by its positive total; rows sum to one after normalization.",
        "samples": len(samples),
        "categories": categories,
        "sample_groups": (
            data[[sample, group]].drop_duplicates().set_index(sample)[group].to_dict()
            if group
            else None
        ),
        "inference_scope": "descriptive composition",
        "decisions": [
            "A 100% stacked view preserves each sample's whole composition.",
            "A sample-by-category heatmap exposes low-abundance and heterogeneous components.",
        ],
        "limitations": [
            "Components are dependent because each sample sums to one.",
            "No component-wise P values are generated.",
            "Differential abundance requires an explicit compositional model, zero treatment, "
            "covariates, and multiplicity plan.",
        ],
    }
    recipe = {
        "family": "composition",
        "input": _relative_input(input_path, outdir),
        "sample": sample,
        "category": category,
        "value": value,
        "group": group,
        "palette": palette,
        "colors": colors_text,
        "font": font,
        "figsize_inches": FIGSIZE,
        "note": "Palette changes preserve normalized values, sample/category order, labels, and geometry.",
    }
    figures = _composition_figures(data, sample, category, group, colors)
    return _save_bundle(
        outdir, figures, _profile(input_path, df, data, font_info, columns), analysis, recipe
    )


def _cluster_order(values: np.ndarray, axis: int) -> list[int]:
    observations = values if axis == 0 else values.T
    feature_means = np.mean(observations, axis=0)
    feature_sd = np.std(observations, axis=0, ddof=0)
    feature_sd[feature_sd == 0] = 1
    standardized = (observations - feature_means) / feature_sd
    distances = pdist(standardized, metric="euclidean")
    if not np.isfinite(distances).all() or np.allclose(distances, 0):
        return list(range(len(observations)))
    linkage = hierarchy.linkage(distances, method="average", optimal_ordering=True)
    return hierarchy.leaves_list(linkage).astype(int).tolist()


def _matrix_figures(pivot: pd.DataFrame, colors: list[str]) -> list[tuple[str, plt.Figure]]:
    values = pivot.to_numpy(float)
    crosses_zero = float(np.nanmin(values)) < 0 < float(np.nanmax(values))
    if crosses_zero:
        limit = float(np.nanmax(np.abs(values)))
        cmap = LinearSegmentedColormap.from_list("matrix", [colors[0], "#FFFFFF", colors[1]])
        vmin, vmax = -limit, limit
    else:
        cmap = LinearSegmentedColormap.from_list("matrix", ["#FFFFFF", colors[0]])
        vmin, vmax = float(np.nanmin(values)), float(np.nanmax(values))
    fig, ax = plt.subplots(figsize=FIGSIZE)
    image = ax.imshow(
        values, aspect="auto", interpolation="nearest", cmap=cmap, vmin=vmin, vmax=vmax
    )
    ax.set_xticks(np.arange(len(pivot.columns)), pivot.columns.astype(str), rotation=45, ha="right")
    ax.set_yticks(np.arange(len(pivot.index)), pivot.index.astype(str))
    for spine in ax.spines.values():
        spine.set_visible(False)
    colorbar = fig.colorbar(image, ax=ax, fraction=0.045, pad=0.03)
    colorbar.set_label("Value")
    colorbar.outline.set_linewidth(0.6)
    longest_row = max(len(str(label)) for label in pivot.index)
    left_margin = min(0.42, max(0.22, 0.16 + 0.0105 * longest_row))
    fig.subplots_adjust(left=left_margin, right=0.91, bottom=0.24, top=0.96)

    fig_dot, ax_dot = plt.subplots(figsize=FIGSIZE)
    row_grid, col_grid = np.indices(values.shape)
    finite = np.isfinite(values)
    magnitude = np.abs(values[finite])
    if magnitude.size and float(np.max(magnitude)) > 0:
        sizes = 22 + 150 * magnitude / float(np.max(magnitude))
    else:
        sizes = np.full(magnitude.shape, 35.0)
    ax_dot.scatter(
        col_grid[finite],
        row_grid[finite],
        s=sizes,
        c=values[finite],
        cmap=cmap,
        vmin=vmin,
        vmax=vmax,
        edgecolor="white",
        linewidth=0.4,
    )
    ax_dot.set_xlim(-0.6, len(pivot.columns) - 0.4)
    ax_dot.set_ylim(len(pivot.index) - 0.4, -0.6)
    ax_dot.set_xticks(
        np.arange(len(pivot.columns)), pivot.columns.astype(str), rotation=45, ha="right"
    )
    ax_dot.set_yticks(np.arange(len(pivot.index)), pivot.index.astype(str))
    ax_dot.grid(color="#E4E8EC", linewidth=0.55)
    for spine in ax_dot.spines.values():
        spine.set_visible(False)
    fig_dot.subplots_adjust(left=left_margin, right=0.96, bottom=0.24, top=0.96)
    return [("matrix_heatmap", fig), ("matrix_dotmap", fig_dot)]


def matrix(
    input_path: Path,
    row: str,
    column: str,
    value: str,
    outdir: Path,
    cluster: str = "auto",
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    df = read_table(input_path)
    columns = [row, column, value]
    _require_columns(df, columns)
    data = df[columns].dropna().copy()
    data[row] = data[row].astype(str)
    data[column] = data[column].astype(str)
    data[value] = _numeric(data[value], value)
    if data.duplicated([row, column]).any():
        raise ValueError("Each row-column matrix cell must be unique.")
    row_order = data[row].drop_duplicates().tolist()
    column_order = data[column].drop_duplicates().tolist()
    if not 2 <= len(row_order) <= 18 or not 2 <= len(column_order) <= 18:
        raise ValueError(
            "The fixed publication canvas supports 2-18 displayed rows and columns; "
            "filter or aggregate a high-dimensional matrix explicitly."
        )
    pivot = data.pivot(index=row, columns=column, values=value).reindex(
        index=row_order, columns=column_order
    )
    if pivot.isna().any().any() and cluster != "none":
        raise ValueError(
            "Clustering requires a complete matrix; use --cluster none or resolve missing cells explicitly."
        )
    actual_cluster = cluster
    if cluster == "auto":
        actual_cluster = (
            "both" if min(pivot.shape) >= 3 and not pivot.isna().any().any() else "none"
        )
    row_index = list(range(len(pivot.index)))
    column_index = list(range(len(pivot.columns)))
    if actual_cluster in {"rows", "both"}:
        row_index = _cluster_order(pivot.to_numpy(float), axis=0)
    if actual_cluster in {"columns", "both"}:
        column_index = _cluster_order(pivot.to_numpy(float), axis=1)
    pivot = pivot.iloc[row_index, column_index]
    _, font_info = _font_profile(font)
    colors = resolve_palette(palette, colors_text, 2)
    analysis = {
        "family": "matrix",
        "shape": [int(pivot.shape[0]), int(pivot.shape[1])],
        "ordering": actual_cluster,
        "clustering": (
            "Average-linkage hierarchical clustering of Euclidean distances after feature-wise standardization."
            if actual_cluster != "none"
            else "Input order preserved."
        ),
        "row_order": pivot.index.astype(str).tolist(),
        "column_order": pivot.columns.astype(str).tolist(),
        "inference_scope": "descriptive matrix",
        "decisions": [
            "The heatmap preserves signed magnitude; the dot map separates magnitude (size) "
            "from direction/value (color).",
            "A diverging scale is centered at zero only when values cross zero.",
        ],
        "limitations": [
            "Clustering is exploratory and does not establish biological classes.",
            "No multiple-testing or differential-analysis claims are generated from a display matrix.",
        ],
    }
    recipe = {
        "family": "matrix",
        "input": _relative_input(input_path, outdir),
        "row": row,
        "column": column,
        "value": value,
        "cluster": cluster,
        "palette": palette,
        "colors": colors_text,
        "font": font,
        "figsize_inches": FIGSIZE,
        "note": "Palette changes preserve values, clustering, order, labels, and geometry.",
    }
    figures = _matrix_figures(pivot, colors)
    return _save_bundle(
        outdir, figures, _profile(input_path, df, data, font_info, columns), analysis, recipe
    )


def recolor(recipe_path: Path, outdir: Path, palette: str, colors: str | None) -> list[Path]:
    recipe = json.loads(recipe_path.read_text(encoding="utf-8"))
    source = Path(recipe["input"])
    if not source.is_absolute():
        source = (recipe_path.parent / source).resolve()
    shared = {
        "outdir": outdir,
        "palette": palette,
        "colors_text": colors,
        "font": recipe.get("font", DEFAULT_FONT),
    }
    family = recipe["family"]
    if family == "relationship":
        return relationship(
            source, recipe["x"], recipe["y"], recipe["unit"], group=recipe.get("group"), **shared
        )
    if family == "timecourse":
        return timecourse(
            source, recipe["time"], recipe["value"], recipe["group"], recipe["unit"], **shared
        )
    if family == "composition":
        return composition(
            source,
            recipe["sample"],
            recipe["category"],
            recipe["value"],
            group=recipe.get("group"),
            **shared,
        )
    if family == "matrix":
        return matrix(
            source,
            recipe["row"],
            recipe["column"],
            recipe["value"],
            cluster=recipe.get("cluster", "auto"),
            **shared,
        )
    raise ValueError(f"Unsupported recipe family: {family}")


def _shared(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("input")
    parser.add_argument("--palette", default="zhoy_muted")
    parser.add_argument("--colors", help="Comma-separated hex colors; overrides --palette")
    parser.add_argument("--font", default=DEFAULT_FONT)
    parser.add_argument("--outdir", required=True)


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    sub = root.add_subparsers(dest="command", required=True)
    rel = sub.add_parser("relationship", help="Association, fitted trend, and joint distributions")
    _shared(rel)
    rel.add_argument("--x", required=True)
    rel.add_argument("--y", required=True)
    rel.add_argument("--unit", required=True)
    rel.add_argument("--group")
    rel.set_defaults(
        func=lambda a: relationship(
            Path(a.input), a.x, a.y, a.unit, Path(a.outdir), a.group, a.palette, a.colors, a.font
        )
    )
    time = sub.add_parser("timecourse", help="Individual trajectories and change from baseline")
    _shared(time)
    time.add_argument("--time", required=True)
    time.add_argument("--value", required=True)
    time.add_argument("--group", required=True)
    time.add_argument("--unit", required=True)
    time.set_defaults(
        func=lambda a: timecourse(
            Path(a.input),
            a.time,
            a.value,
            a.group,
            a.unit,
            Path(a.outdir),
            a.palette,
            a.colors,
            a.font,
        )
    )
    comp = sub.add_parser("composition", help="Normalized stacked composition and heatmap")
    _shared(comp)
    comp.add_argument("--sample", required=True)
    comp.add_argument("--category", required=True)
    comp.add_argument("--value", required=True)
    comp.add_argument("--group")
    comp.set_defaults(
        func=lambda a: composition(
            Path(a.input),
            a.sample,
            a.category,
            a.value,
            Path(a.outdir),
            a.group,
            a.palette,
            a.colors,
            a.font,
        )
    )
    mat = sub.add_parser("matrix", help="Cluster-aware heatmap and dot matrix")
    _shared(mat)
    mat.add_argument("--row", required=True)
    mat.add_argument("--column", required=True)
    mat.add_argument("--value", required=True)
    mat.add_argument(
        "--cluster", choices=["auto", "none", "rows", "columns", "both"], default="auto"
    )
    mat.set_defaults(
        func=lambda a: matrix(
            Path(a.input),
            a.row,
            a.column,
            a.value,
            Path(a.outdir),
            a.cluster,
            a.palette,
            a.colors,
            a.font,
        )
    )
    color = sub.add_parser("recolor", help="Rerender any saved family recipe with a new palette")
    color.add_argument("recipe")
    color.add_argument("--palette", default="okabe_ito")
    color.add_argument("--colors")
    color.add_argument("--outdir", required=True)
    color.set_defaults(
        func=lambda a: recolor(Path(a.recipe).resolve(), Path(a.outdir), a.palette, a.colors)
    )
    return root


def main() -> None:
    args = parser().parse_args()
    files = args.func(args)
    print(f"Generated {len(files)} validated candidates in {Path(args.outdir).resolve()}")


if __name__ == "__main__":
    main()

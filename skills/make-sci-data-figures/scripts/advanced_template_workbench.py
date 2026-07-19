#!/usr/bin/env python3
"""Validated scientific workflows distilled from the 1-124 template atlas."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.patches import Ellipse
import numpy as np
import pandas as pd
from scipy import optimize, stats

from data_family_workbench import (
    _axis,
    _display_label,
    _font_profile,
    _profile,
    _relative_input,
    _require_columns,
    _save_bundle,
    _numeric,
)
from figure_workbench import DEFAULT_FONT, FIGSIZE, read_table, resolve_palette

RNG_SEED = 20260719


def _prepare(
    input_path: Path, columns: list[str], numeric: list[str]
) -> tuple[pd.DataFrame, pd.DataFrame]:
    frame = read_table(input_path)
    _require_columns(frame, columns)
    data = frame[columns].dropna().copy()
    if data.empty:
        raise ValueError("No complete rows remain after required-value filtering.")
    for column in numeric:
        data[column] = _numeric(data[column], column)
    return frame, data


def _base_recipe(
    family: str,
    input_path: Path,
    outdir: Path,
    palette: str,
    colors: str | None,
    font: str,
    **parameters,
) -> dict:
    return {
        "family": family,
        "input": _relative_input(input_path, outdir),
        "palette": palette,
        "colors": colors,
        "font": font,
        "figsize_inches": FIGSIZE,
        "parameters": parameters,
        "note": "Palette changes preserve data, ordering, statistics, labels, and geometry.",
    }


def _label_margin(labels: list[str], minimum: float = 0.24) -> float:
    longest = max((len(label) for label in labels), default=0)
    return min(0.46, max(minimum, 0.16 + 0.0095 * longest))


def _trapezoid(y: np.ndarray, x: np.ndarray) -> float:
    """Integrate on both legacy NumPy and NumPy >=2.0/2.4."""
    if hasattr(np, "trapezoid"):
        return float(np.trapezoid(y, x))
    return float(np.trapz(y, x))


def forest(
    input_path: Path,
    term: str,
    estimate: str,
    low: str,
    high: str,
    outdir: Path,
    group: str | None = None,
    scale: str = "linear",
    reference: float | None = None,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    columns = [term, estimate, low, high] + ([group] if group else [])
    frame, data = _prepare(input_path, columns, [estimate, low, high])
    data[term] = data[term].astype(str)
    if ((data[low] > data[estimate]) | (data[estimate] > data[high])).any():
        raise ValueError("Every interval must satisfy lower <= estimate <= upper.")
    if scale == "log" and (data[[low, estimate, high]] <= 0).any().any():
        raise ValueError("Log-scale forest values and intervals must be positive.")
    reference = (1.0 if scale == "log" else 0.0) if reference is None else reference
    levels = (
        ["all"] if group is None else data[group].astype(str).drop_duplicates().tolist()
    )
    colors = resolve_palette(palette, colors_text, len(levels))
    _, font_info = _font_profile(font)
    ordered = data.iloc[::-1].reset_index(drop=True)
    labels = ordered[term].tolist()
    y = np.arange(len(ordered))
    color_map = {level: colors[index] for index, level in enumerate(levels)}
    point_colors = (
        [colors[0]]
        if group is None
        else [color_map[str(value)] for value in ordered[group]]
    )

    fig, ax = plt.subplots(figsize=FIGSIZE)
    for index, row in ordered.iterrows():
        ax.errorbar(
            row[estimate],
            index,
            xerr=[[row[estimate] - row[low]], [row[high] - row[estimate]]],
            fmt="o",
            color=point_colors[index],
            capsize=3.2,
            linewidth=1.25,
            markersize=5.2,
            markeredgecolor="white",
            markeredgewidth=0.45,
        )
    ax.axvline(reference, color="#66717C", linewidth=0.8, linestyle=(0, (3, 2)))
    ax.set_yticks(y, labels)
    ax.set_xlabel(_display_label(estimate))
    if scale == "log":
        ax.set_xscale("log")
    _axis(ax)
    fig.subplots_adjust(left=_label_margin(labels), right=0.96, bottom=0.17, top=0.96)

    fig_link, ax_link = plt.subplots(figsize=FIGSIZE)
    for index, row in ordered.iterrows():
        ax_link.plot(
            [reference, row[estimate]], [index, index], color="#C7CDD3", linewidth=1.0
        )
        ax_link.errorbar(
            row[estimate],
            index,
            xerr=[[row[estimate] - row[low]], [row[high] - row[estimate]]],
            fmt="o",
            color=point_colors[index],
            capsize=3.2,
            linewidth=1.2,
            markersize=5.1,
            markeredgecolor="white",
            markeredgewidth=0.45,
        )
    ax_link.axvline(reference, color="#66717C", linewidth=0.8)
    ax_link.set_yticks(y, labels)
    ax_link.set_xlabel(_display_label(estimate))
    if scale == "log":
        ax_link.set_xscale("log")
    _axis(ax_link)
    fig_link.subplots_adjust(
        left=_label_margin(labels), right=0.96, bottom=0.17, top=0.96
    )

    analysis = {
        "family": "forest",
        "inference_scope": "display of supplied estimates and intervals",
        "reference": reference,
        "scale": scale,
        "rows": int(len(data)),
        "limitations": [
            "The workbench does not recompute model estimates from raw observations.",
            "Verify model family, adjustment set, multiplicity, and interval definition upstream.",
        ],
    }
    recipe = _base_recipe(
        "forest",
        input_path,
        outdir,
        palette,
        colors_text,
        font,
        term=term,
        estimate=estimate,
        low=low,
        high=high,
        group=group,
        scale=scale,
        reference=reference,
    )
    return _save_bundle(
        outdir,
        [("forest_intervals", fig), ("forest_reference_linked", fig_link)],
        _profile(input_path, frame, data, font_info, columns),
        analysis,
        recipe,
    )


def volcano(
    input_path: Path,
    feature: str,
    effect: str,
    adjusted_p: str,
    outdir: Path,
    effect_threshold: float = 1.0,
    p_threshold: float = 0.05,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    columns = [feature, effect, adjusted_p]
    frame, data = _prepare(input_path, columns, [effect, adjusted_p])
    data[feature] = data[feature].astype(str)
    if ((data[adjusted_p] <= 0) | (data[adjusted_p] > 1)).any():
        raise ValueError("Adjusted P values must be in (0, 1].")
    if effect_threshold < 0 or not 0 < p_threshold < 1:
        raise ValueError(
            "Effect threshold must be non-negative and P threshold must be in (0, 1)."
        )
    _, font_info = _font_profile(font)
    colors = resolve_palette(palette, colors_text, 3)
    logp = -np.log10(data[adjusted_p].to_numpy(float))
    significant = data[adjusted_p].to_numpy(float) <= p_threshold
    direction = np.where(
        significant & (data[effect].to_numpy(float) >= effect_threshold),
        1,
        np.where(
            significant & (data[effect].to_numpy(float) <= -effect_threshold), -1, 0
        ),
    )
    point_colors = np.where(
        direction > 0, colors[1], np.where(direction < 0, colors[0], "#C9CFD5")
    )
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.scatter(
        data[effect],
        logp,
        s=24,
        c=point_colors,
        alpha=0.72,
        edgecolor="white",
        linewidth=0.25,
    )
    ax.axvline(effect_threshold, color="#8A949E", linewidth=0.75, linestyle=(0, (3, 2)))
    ax.axvline(
        -effect_threshold, color="#8A949E", linewidth=0.75, linestyle=(0, (3, 2))
    )
    ax.axhline(
        -math.log10(p_threshold), color="#8A949E", linewidth=0.75, linestyle=(0, (3, 2))
    )
    ax.set_xlabel(_display_label(effect))
    ax.set_ylabel(r"$-\log_{10}$(adjusted $P$)")
    _axis(ax)
    fig.subplots_adjust(left=0.18, right=0.96, bottom=0.17, top=0.96)

    ranked = data.assign(__score=np.abs(data[effect]) * logp, __direction=direction)
    ranked = (
        ranked[ranked.__direction != 0].nlargest(12, "__score").sort_values("__score")
    )
    if ranked.empty:
        ranked = (
            data.assign(__score=np.abs(data[effect]) * logp, __direction=0)
            .nlargest(min(12, len(data)), "__score")
            .sort_values("__score")
        )
    fig_hits, ax_hits = plt.subplots(figsize=FIGSIZE)
    y = np.arange(len(ranked))
    hit_colors = np.where(ranked[effect] >= 0, colors[1], colors[0])
    ax_hits.hlines(y, 0, ranked[effect], color="#CDD2D7", linewidth=1.0)
    ax_hits.scatter(
        ranked[effect], y, s=32, c=hit_colors, edgecolor="white", linewidth=0.4
    )
    ax_hits.axvline(0, color="#66717C", linewidth=0.8)
    labels = ranked[feature].tolist()
    ax_hits.set_yticks(y, labels)
    ax_hits.set_xlabel(_display_label(effect))
    _axis(ax_hits)
    fig_hits.subplots_adjust(
        left=_label_margin(labels), right=0.96, bottom=0.17, top=0.96
    )

    analysis = {
        "family": "volcano",
        "effect_threshold": effect_threshold,
        "adjusted_p_threshold": p_threshold,
        "up": int((direction > 0).sum()),
        "down": int((direction < 0).sum()),
        "inference_scope": "display of supplied effects and adjusted P values",
        "limitations": [
            "The ranking is exploratory and uses absolute effect multiplied by -log10(adjusted P).",
            "The upstream differential model, normalization, contrasts, and multiplicity method must be verified.",
        ],
    }
    recipe = _base_recipe(
        "volcano",
        input_path,
        outdir,
        palette,
        colors_text,
        font,
        feature=feature,
        effect=effect,
        adjusted_p=adjusted_p,
        effect_threshold=effect_threshold,
        p_threshold=p_threshold,
    )
    return _save_bundle(
        outdir,
        [("volcano", fig), ("volcano_ranked_hits", fig_hits)],
        _profile(input_path, frame, data, font_info, columns),
        analysis,
        recipe,
    )


def _matrix_figure(
    matrix: np.ndarray, labels: list[str], color: str, colorbar_label: str
) -> plt.Figure:
    cmap = LinearSegmentedColormap.from_list("matrix", ["#FFFFFF", color])
    fig, ax = plt.subplots(figsize=FIGSIZE)
    image = ax.imshow(
        matrix,
        cmap=cmap,
        aspect="equal",
        interpolation="nearest",
        vmin=0,
        vmax=max(1e-12, float(np.nanmax(matrix))),
    )
    ax.set_xticks(np.arange(len(labels)), labels, rotation=45, ha="right")
    ax.set_yticks(np.arange(len(labels)), labels)
    for i in range(len(labels)):
        for j in range(len(labels)):
            value = matrix[i, j]
            text = f"{value:.2f}" if np.nanmax(matrix) <= 1.000001 else f"{int(value)}"
            ax.text(
                j,
                i,
                text,
                ha="center",
                va="center",
                fontsize=9,
                color="white" if value > 0.58 * np.nanmax(matrix) else "#20252A",
            )
    for spine in ax.spines.values():
        spine.set_visible(False)
    colorbar = fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
    colorbar.set_label(colorbar_label)
    colorbar.outline.set_linewidth(0.6)
    fig.subplots_adjust(left=0.22, right=0.90, bottom=0.23, top=0.96)
    return fig


def confusion(
    input_path: Path,
    observed: str,
    predicted: str,
    unit: str,
    outdir: Path,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    columns = [unit, observed, predicted]
    frame, data = _prepare(input_path, columns, [])
    data[unit] = data[unit].astype(str)
    if data[unit].duplicated().any():
        raise ValueError(
            "Confusion matrices require one prediction per independent unit."
        )
    labels = data[observed].astype(str).drop_duplicates().tolist()
    labels += [
        value
        for value in data[predicted].astype(str).drop_duplicates()
        if value not in labels
    ]
    if len(labels) > 10:
        raise ValueError(
            "More than 10 classes would make the fixed publication canvas unreadable."
        )
    observed_values = data[observed].astype(str)
    predicted_values = data[predicted].astype(str)
    counts = (
        pd.crosstab(observed_values, predicted_values)
        .reindex(index=labels, columns=labels, fill_value=0)
        .to_numpy(float)
    )
    row_totals = counts.sum(axis=1, keepdims=True)
    normalized = np.divide(
        counts, row_totals, out=np.zeros_like(counts), where=row_totals > 0
    )
    _, font_info = _font_profile(font)
    colors = resolve_palette(palette, colors_text, 1)
    accuracy = float(np.trace(counts) / counts.sum())
    recall = np.diag(normalized)
    analysis = {
        "family": "confusion-matrix",
        "units": int(len(data)),
        "class_order": labels,
        "accuracy": accuracy,
        "macro_recall": float(np.mean(recall)),
        "inference_scope": "descriptive classification performance",
        "limitations": [
            "Performance is not labeled external or prospective unless the supplied cases are independently validated.",
            "Threshold selection, calibration, prevalence transport, and uncertainty require a declared validation plan.",
        ],
    }
    recipe = _base_recipe(
        "confusion-matrix",
        input_path,
        outdir,
        palette,
        colors_text,
        font,
        observed=observed,
        predicted=predicted,
        unit=unit,
    )
    return _save_bundle(
        outdir,
        [
            ("confusion_counts", _matrix_figure(counts, labels, colors[0], "Count")),
            (
                "confusion_row_normalized",
                _matrix_figure(normalized, labels, colors[0], "Row proportion"),
            ),
        ],
        _profile(input_path, frame, data, font_info, columns),
        analysis,
        recipe,
    )


def enrichment(
    input_path: Path,
    term: str,
    effect: str,
    adjusted_p: str,
    count: str,
    outdir: Path,
    category: str | None = None,
    top: int = 15,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    columns = [term, effect, adjusted_p, count] + ([category] if category else [])
    frame, data = _prepare(input_path, columns, [effect, adjusted_p, count])
    data[term] = data[term].astype(str)
    if ((data[adjusted_p] <= 0) | (data[adjusted_p] > 1)).any():
        raise ValueError("Adjusted P values must be in (0, 1].")
    if (data[count] <= 0).any():
        raise ValueError("Enrichment counts must be positive.")
    if not 3 <= top <= 25:
        raise ValueError("--top must be between 3 and 25 for final-size legibility.")
    selected = data.nsmallest(min(top, len(data)), adjusted_p).sort_values(effect)
    labels = selected[term].tolist()
    levels = (
        ["all"]
        if category is None
        else selected[category].astype(str).drop_duplicates().tolist()
    )
    colors = resolve_palette(palette, colors_text, max(2, len(levels)))
    color_map = {level: colors[index] for index, level in enumerate(levels)}
    point_colors = (
        [colors[0]]
        if category is None
        else [color_map[str(value)] for value in selected[category]]
    )
    _, font_info = _font_profile(font)
    logp = -np.log10(selected[adjusted_p].to_numpy(float))
    sizes = 28 + 150 * selected[count].to_numpy(float) / float(selected[count].max())
    y = np.arange(len(selected))

    fig, ax = plt.subplots(figsize=FIGSIZE)
    scatter = ax.scatter(
        selected[effect],
        y,
        s=sizes,
        c=logp,
        cmap="viridis",
        edgecolor="white",
        linewidth=0.4,
    )
    ax.set_yticks(y, labels)
    ax.set_xlabel(_display_label(effect))
    colorbar = fig.colorbar(scatter, ax=ax, fraction=0.045, pad=0.03)
    colorbar.set_label(r"$-\log_{10}$(adjusted $P$)")
    colorbar.outline.set_linewidth(0.6)
    _axis(ax)
    fig.subplots_adjust(left=_label_margin(labels), right=0.88, bottom=0.17, top=0.96)

    fig_lollipop, ax_lollipop = plt.subplots(figsize=FIGSIZE)
    ax_lollipop.hlines(y, 0, selected[effect], color="#CBD1D6", linewidth=1.0)
    ax_lollipop.scatter(
        selected[effect], y, s=36, c=point_colors, edgecolor="white", linewidth=0.4
    )
    ax_lollipop.axvline(0, color="#6E7780", linewidth=0.75)
    ax_lollipop.set_yticks(y, labels)
    ax_lollipop.set_xlabel(_display_label(effect))
    _axis(ax_lollipop)
    fig_lollipop.subplots_adjust(
        left=_label_margin(labels), right=0.96, bottom=0.17, top=0.96
    )

    analysis = {
        "family": "enrichment",
        "displayed_terms": int(len(selected)),
        "selection_rule": f"Smallest {adjusted_p}, capped at {top} terms",
        "inference_scope": "display of supplied enrichment results",
        "limitations": [
            "The upstream universe, ontology version, redundancy handling, and multiplicity method must be verified.",
            "Bubble size encodes supplied count and does not imply independent replication.",
        ],
    }
    recipe = _base_recipe(
        "enrichment",
        input_path,
        outdir,
        palette,
        colors_text,
        font,
        term=term,
        effect=effect,
        adjusted_p=adjusted_p,
        count=count,
        category=category,
        top=top,
    )
    return _save_bundle(
        outdir,
        [("enrichment_bubble", fig), ("enrichment_lollipop", fig_lollipop)],
        _profile(input_path, frame, data, font_info, columns),
        analysis,
        recipe,
    )


def _km_curve(
    time: np.ndarray, event: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    points = np.sort(np.unique(time[event == 1]))
    x, y, lower, upper = [0.0], [1.0], [1.0], [1.0]
    survival_value = 1.0
    greenwood = 0.0
    for point in points:
        at_risk = int(np.sum(time >= point))
        deaths = int(np.sum((time == point) & (event == 1)))
        survival_value *= 1.0 - deaths / at_risk
        if at_risk > deaths:
            greenwood += deaths / (at_risk * (at_risk - deaths))
        if 0 < survival_value < 1 and greenwood > 0:
            log_log = math.log(-math.log(survival_value))
            se_log_log = math.sqrt(greenwood) / abs(math.log(survival_value))
            interval_low = math.exp(-math.exp(log_log + 1.96 * se_log_log))
            interval_high = math.exp(-math.exp(log_log - 1.96 * se_log_log))
        else:
            interval_low = survival_value
            interval_high = survival_value
        x.append(float(point))
        y.append(float(survival_value))
        lower.append(interval_low)
        upper.append(interval_high)
    end = float(np.max(time))
    if x[-1] < end:
        x.append(end)
        y.append(y[-1])
        lower.append(lower[-1])
        upper.append(upper[-1])
    return np.asarray(x), np.asarray(y), np.asarray(lower), np.asarray(upper)


def _logrank(time: np.ndarray, event: np.ndarray, group: np.ndarray) -> float | None:
    levels = list(pd.Series(group).drop_duplicates())
    if len(levels) != 2:
        return None
    observed_minus_expected = 0.0
    variance = 0.0
    for point in np.sort(np.unique(time[event == 1])):
        at_risk = time >= point
        deaths = (time == point) & (event == 1)
        n = int(np.sum(at_risk))
        d = int(np.sum(deaths))
        n1 = int(np.sum(at_risk & (group == levels[0])))
        d1 = int(np.sum(deaths & (group == levels[0])))
        if n <= 1:
            continue
        observed_minus_expected += d1 - d * n1 / n
        variance += n1 * (n - n1) * d * (n - d) / (n * n * (n - 1))
    if variance <= 0:
        return None
    return float(stats.chi2.sf(observed_minus_expected**2 / variance, 1))


def survival(
    input_path: Path,
    time: str,
    event: str,
    group: str,
    unit: str,
    outdir: Path,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    columns = [time, event, group, unit]
    frame, data = _prepare(input_path, columns, [time, event])
    if data[unit].duplicated().any():
        raise ValueError("Survival input must contain one row per experimental unit.")
    if (data[time] < 0).any() or not set(data[event].unique()).issubset({0, 1}):
        raise ValueError(
            "Follow-up time must be non-negative and event must be coded 0/1."
        )
    levels = data[group].astype(str).drop_duplicates().tolist()
    if not 1 <= len(levels) <= 6:
        raise ValueError(
            "Survival display supports 1-6 groups at final publication size."
        )
    colors = resolve_palette(palette, colors_text, len(levels))
    _, font_info = _font_profile(font)
    fig, ax = plt.subplots(figsize=FIGSIZE)
    curves: dict[str, tuple[np.ndarray, ...]] = {}
    for color, level in zip(colors, levels):
        subset = data[data[group].astype(str) == level]
        curve = _km_curve(subset[time].to_numpy(float), subset[event].to_numpy(int))
        curves[level] = curve
        x, y, lower, upper = curve
        ax.step(x, y, where="post", color=color, linewidth=1.55, label=level)
        ax.fill_between(
            x, lower, upper, step="post", color=color, alpha=0.12, linewidth=0
        )
        censored = subset[subset[event] == 0]
        censor_y = [
            y[np.searchsorted(x, value, side="right") - 1] for value in censored[time]
        ]
        ax.scatter(
            censored[time], censor_y, marker="|", s=34, color=color, linewidth=1.0
        )
    ax.set(
        xlabel=_display_label(time), ylabel="Survival probability", ylim=(-0.02, 1.03)
    )
    ax.legend(frameon=False, loc="best")
    _axis(ax)
    fig.subplots_adjust(left=0.18, right=0.96, bottom=0.17, top=0.96)

    ticks = np.linspace(0, float(data[time].max()), 5)
    fig_risk, (ax_curve, ax_risk) = plt.subplots(
        2,
        1,
        figsize=FIGSIZE,
        sharex=True,
        gridspec_kw={"height_ratios": [4, 1.25], "hspace": 0.08},
    )
    for color, level in zip(colors, levels):
        x, y, _, _ = curves[level]
        ax_curve.step(x, y, where="post", color=color, linewidth=1.5, label=level)
    ax_curve.set_ylabel("Survival probability")
    ax_curve.set_ylim(-0.02, 1.03)
    ax_curve.legend(frameon=False, loc="best")
    _axis(ax_curve)
    for row, (color, level) in enumerate(zip(colors, levels)):
        subset = data[data[group].astype(str) == level]
        for tick in ticks:
            ax_risk.text(
                tick,
                row,
                str(int(np.sum(subset[time] >= tick))),
                ha="center",
                va="center",
                color=color,
            )
    ax_risk.set_yticks(range(len(levels)), levels)
    ax_risk.invert_yaxis()
    ax_risk.set_xticks(ticks)
    ax_risk.set_xlabel(_display_label(time))
    ax_risk.set_ylabel("At risk")
    _axis(ax_risk)
    fig_risk.subplots_adjust(
        left=_label_margin(levels, 0.2), right=0.96, bottom=0.19, top=0.96
    )
    p_value = _logrank(
        data[time].to_numpy(float),
        data[event].to_numpy(int),
        data[group].astype(str).to_numpy(),
    )
    analysis = {
        "family": "survival",
        "groups": levels,
        "experimental_unit_column": unit,
        "log_rank_p_two_groups": p_value,
        "confidence_interval": "pointwise 95% log-log Greenwood interval",
        "inference_scope": "Kaplan-Meier descriptive estimates; unadjusted log-rank only for exactly two groups",
        "limitations": [
            "Independent censoring and correct event coding must be justified.",
            "Use a prespecified Cox model for adjusted effects; this workflow does not invent hazard ratios.",
        ],
    }
    recipe = _base_recipe(
        "survival",
        input_path,
        outdir,
        palette,
        colors_text,
        font,
        time=time,
        event=event,
        group=group,
        unit=unit,
    )
    return _save_bundle(
        outdir,
        [("kaplan_meier", fig), ("kaplan_meier_risk_table", fig_risk)],
        _profile(input_path, frame, data, font_info, columns),
        analysis,
        recipe,
    )


def _four_pl(
    log_dose: np.ndarray,
    bottom: float,
    top: float,
    log_mid: float,
    hill: float,
    direction: float,
) -> np.ndarray:
    exponent = (log_dose - log_mid) * hill * direction
    return bottom + (top - bottom) / (1.0 + 10.0**exponent)


def dose_response(
    input_path: Path,
    dose: str,
    response: str,
    group: str,
    outdir: Path,
    unit: str | None = None,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    columns = [dose, response, group] + ([unit] if unit else [])
    frame, data = _prepare(input_path, columns, [dose, response])
    if (data[dose] <= 0).any():
        raise ValueError("Dose values must be positive for log-dose fitting.")
    levels = data[group].astype(str).drop_duplicates().tolist()
    colors = resolve_palette(palette, colors_text, len(levels))
    _, font_info = _font_profile(font)
    fig, ax = plt.subplots(figsize=FIGSIZE)
    fig_resid, ax_resid = plt.subplots(figsize=FIGSIZE)
    fits: dict[str, dict] = {}
    for color, level in zip(colors, levels):
        subset = data[data[group].astype(str) == level]
        if subset[dose].nunique() < 4 or len(subset) < 6:
            raise ValueError(
                f"Group '{level}' needs at least 4 dose levels and 6 observations."
            )
        x = np.log10(subset[dose].to_numpy(float))
        y = subset[response].to_numpy(float)
        association = stats.spearmanr(x, y)
        correlation = getattr(association, "statistic", association[0])
        direction = 1.0 if correlation < 0 else -1.0
        spread = max(float(np.ptp(y)), float(np.std(y)), 1e-3)
        initial = [float(np.min(y)), float(np.max(y)), float(np.median(x)), 1.0]
        bounds = (
            [
                float(np.min(y) - spread),
                float(np.min(y) - spread),
                float(np.min(x) - 2),
                0.05,
            ],
            [
                float(np.max(y) + spread),
                float(np.max(y) + spread),
                float(np.max(x) + 2),
                10.0,
            ],
        )
        model = lambda z, bottom, top, log_mid, hill: _four_pl(
            z, bottom, top, log_mid, hill, direction
        )
        parameters, covariance = optimize.curve_fit(
            model, x, y, p0=initial, bounds=bounds, maxfev=30000
        )
        grid = np.linspace(float(np.min(x)), float(np.max(x)), 240)
        fitted = model(x, *parameters)
        ax.scatter(
            subset[dose],
            y,
            s=22,
            color=color,
            alpha=0.72,
            edgecolor="white",
            linewidth=0.35,
        )
        ax.plot(
            10**grid,
            model(grid, *parameters),
            color=color,
            linewidth=1.6,
            label=level,
        )
        ax_resid.scatter(fitted, y - fitted, s=22, color=color, alpha=0.75, label=level)
        se = math.sqrt(max(0.0, float(covariance[2, 2])))
        fits[level] = {
            "midpoint": float(10 ** parameters[2]),
            "midpoint_95_ci": [
                float(10 ** (parameters[2] - 1.96 * se)),
                float(10 ** (parameters[2] + 1.96 * se)),
            ],
            "direction": "decreasing" if direction == 1 else "increasing",
        }
    ax.set_xscale("log")
    ax.set(xlabel=_display_label(dose), ylabel=_display_label(response))
    ax.legend(frameon=False)
    _axis(ax)
    ax_resid.axhline(0, color="#8F98A1", linewidth=0.8)
    ax_resid.set(xlabel="Fitted response", ylabel="Residual")
    ax_resid.legend(frameon=False)
    _axis(ax_resid)
    for figure in (fig, fig_resid):
        figure.subplots_adjust(left=0.18, right=0.96, bottom=0.17, top=0.96)
    analysis = {
        "family": "dose-response",
        "model": "four-parameter logistic on log10 dose",
        "fits": fits,
        "experimental_unit_column": unit,
        "limitations": [
            "Midpoint is labelled generically; call it IC50/EC50 only when the endpoint and direction justify that term.",
            "Replicate hierarchy is preserved only when the supplied unit column identifies it; verify weighting and repeated-measures structure.",
        ],
    }
    recipe = _base_recipe(
        "dose-response",
        input_path,
        outdir,
        palette,
        colors_text,
        font,
        dose=dose,
        response=response,
        group=group,
        unit=unit,
    )
    return _save_bundle(
        outdir,
        [("dose_response", fig), ("dose_response_residuals", fig_resid)],
        _profile(input_path, frame, data, font_info, columns),
        analysis,
        recipe,
    )


def _roc_points(
    y_true: np.ndarray, scores: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    order = np.argsort(-scores, kind="mergesort")
    y = y_true[order]
    thresholds = np.r_[np.inf, scores[order]]
    positives = max(1, int(np.sum(y == 1)))
    negatives = max(1, int(np.sum(y == 0)))
    tpr = np.r_[0.0, np.cumsum(y == 1) / positives]
    fpr = np.r_[0.0, np.cumsum(y == 0) / negatives]
    precision = np.r_[1.0, np.cumsum(y == 1) / np.arange(1, len(y) + 1)]
    return fpr, tpr, precision, thresholds


def roc(
    input_path: Path,
    outcome: str,
    score: str,
    unit: str,
    outdir: Path,
    cohort: str | None = None,
    positive: str = "1",
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    columns = [outcome, score, unit] + ([cohort] if cohort else [])
    frame, data = _prepare(input_path, columns, [score])
    if data[unit].duplicated().any():
        raise ValueError("ROC input must contain one prediction per experimental unit.")
    y = (data[outcome].astype(str) == str(positive)).astype(int)
    if y.nunique() != 2:
        raise ValueError("Outcome must contain both positive and negative classes.")
    data = data.assign(_truth=y)
    levels = (
        ["all"]
        if cohort is None
        else data[cohort].astype(str).drop_duplicates().tolist()
    )
    colors = resolve_palette(palette, colors_text, len(levels))
    _, font_info = _font_profile(font)
    fig, ax = plt.subplots(figsize=FIGSIZE)
    fig_pr, ax_pr = plt.subplots(figsize=FIGSIZE)
    metrics = {}
    rng = np.random.default_rng(RNG_SEED)
    for color, level in zip(colors, levels):
        subset = data if cohort is None else data[data[cohort].astype(str) == level]
        truth = subset["_truth"].to_numpy(int)
        values = subset[score].to_numpy(float)
        if len(np.unique(truth)) != 2:
            raise ValueError(f"Cohort '{level}' must contain both classes.")
        fpr, tpr, precision, _ = _roc_points(truth, values)
        auc = _trapezoid(tpr, fpr)
        boot = []
        for _ in range(500):
            index = rng.integers(0, len(truth), len(truth))
            if len(np.unique(truth[index])) == 2:
                bfpr, btpr, _, _ = _roc_points(truth[index], values[index])
                boot.append(_trapezoid(btpr, bfpr))
        ci = np.quantile(boot, [0.025, 0.975]).tolist() if boot else [None, None]
        ax.plot(
            fpr, tpr, color=color, linewidth=1.55, label=f"{level}  AUC = {auc:.2f}"
        )
        recall = tpr
        ax_pr.plot(recall, precision, color=color, linewidth=1.55, label=level)
        metrics[level] = {
            "n": int(len(subset)),
            "prevalence": float(np.mean(truth)),
            "auc": auc,
            "bootstrap_95_ci": ci,
        }
    ax.plot([0, 1], [0, 1], linestyle="--", color="#A6ADB4", linewidth=0.8)
    ax.set(xlabel="1 − specificity", ylabel="Sensitivity", xlim=(0, 1), ylim=(0, 1.01))
    ax.legend(frameon=False, loc="lower right")
    _axis(ax)
    ax_pr.set(xlabel="Recall", ylabel="Precision", xlim=(0, 1), ylim=(0, 1.01))
    ax_pr.legend(frameon=False, loc="best")
    _axis(ax_pr)
    for figure in (fig, fig_pr):
        figure.subplots_adjust(left=0.18, right=0.96, bottom=0.17, top=0.96)
    analysis = {
        "family": "roc",
        "positive_label": str(positive),
        "metrics": metrics,
        "experimental_unit_column": unit,
        "limitations": [
            "Bootstrap intervals are internal and do not establish external validity.",
            "Declare training, tuning, and held-out cohorts; repeated measurements require unit-level resampling.",
        ],
    }
    recipe = _base_recipe(
        "roc",
        input_path,
        outdir,
        palette,
        colors_text,
        font,
        outcome=outcome,
        score=score,
        unit=unit,
        cohort=cohort,
        positive=positive,
    )
    return _save_bundle(
        outdir,
        [("roc", fig), ("precision_recall", fig_pr)],
        _profile(input_path, frame, data.drop(columns="_truth"), font_info, columns),
        analysis,
        recipe,
    )


def feature_rank(
    input_path: Path,
    item: str,
    value: str,
    outdir: Path,
    low: str | None = None,
    high: str | None = None,
    group: str | None = None,
    top: int = 20,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    if (low is None) != (high is None):
        raise ValueError("Supply both --low and --high, or neither.")
    columns = [item, value] + ([low, high] if low else []) + ([group] if group else [])
    numeric = [value] + ([low, high] if low else [])
    frame, data = _prepare(input_path, columns, numeric)
    if not 3 <= top <= 30:
        raise ValueError("--top must be between 3 and 30 for final-size legibility.")
    if low and ((data[low] > data[value]) | (data[value] > data[high])).any():
        raise ValueError("Intervals must satisfy lower <= value <= upper.")
    selected = data.reindex(data[value].abs().sort_values().index).tail(
        min(top, len(data))
    )
    labels = selected[item].astype(str).tolist()
    levels = (
        ["all"]
        if group is None
        else selected[group].astype(str).drop_duplicates().tolist()
    )
    colors = resolve_palette(palette, colors_text, len(levels))
    color_map = {level: colors[index] for index, level in enumerate(levels)}
    point_colors = (
        [colors[0]] * len(selected)
        if group is None
        else [color_map[str(x)] for x in selected[group]]
    )
    _, font_info = _font_profile(font)
    y = np.arange(len(selected))
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.hlines(y, 0, selected[value], color="#CBD1D6", linewidth=1.0)
    ax.scatter(
        selected[value], y, color=point_colors, s=28, edgecolor="white", linewidth=0.35
    )
    ax.axvline(0, color="#7F8891", linewidth=0.75)
    ax.set_yticks(y, labels)
    ax.set_xlabel(_display_label(value))
    _axis(ax)
    fig.subplots_adjust(left=_label_margin(labels), right=0.96, bottom=0.17, top=0.96)

    fig_dot, ax_dot = plt.subplots(figsize=FIGSIZE)
    if low:
        ax_dot.errorbar(
            selected[value],
            y,
            xerr=np.vstack(
                [selected[value] - selected[low], selected[high] - selected[value]]
            ),
            fmt="none",
            ecolor="#A0A8B0",
            capsize=2,
            linewidth=1.0,
        )
    ax_dot.scatter(
        selected[value], y, color=point_colors, s=30, edgecolor="white", linewidth=0.35
    )
    ax_dot.axvline(0, color="#7F8891", linewidth=0.75)
    ax_dot.set_yticks(y, labels)
    ax_dot.set_xlabel(_display_label(value))
    _axis(ax_dot)
    fig_dot.subplots_adjust(
        left=_label_margin(labels), right=0.96, bottom=0.17, top=0.96
    )
    analysis = {
        "family": "feature-rank",
        "selection": f"largest absolute {value}; top {top}",
        "intervals_supplied": bool(low),
        "inference_scope": "display of supplied estimates",
        "limitations": [
            "Ranking is descriptive and is sensitive to the supplied metric and shrinkage method.",
            "Do not interpret importance scores, coefficients, and causal effects as interchangeable.",
        ],
    }
    recipe = _base_recipe(
        "feature-rank",
        input_path,
        outdir,
        palette,
        colors_text,
        font,
        item=item,
        value=value,
        low=low,
        high=high,
        group=group,
        top=top,
    )
    return _save_bundle(
        outdir,
        [("feature_lollipop", fig), ("feature_interval_rank", fig_dot)],
        _profile(input_path, frame, data, font_info, columns),
        analysis,
        recipe,
    )


def _confidence_ellipse(ax, x: np.ndarray, y: np.ndarray, color: str) -> bool:
    if len(x) < 4 or np.std(x) == 0 or np.std(y) == 0:
        return False
    covariance = np.cov(x, y)
    values, vectors = np.linalg.eigh(covariance)
    if np.any(values <= 0):
        return False
    order = values.argsort()[::-1]
    values, vectors = values[order], vectors[:, order]
    angle = math.degrees(math.atan2(vectors[1, 0], vectors[0, 0]))
    width, height = 2 * 2.0 * np.sqrt(values)
    ellipse = Ellipse(
        (np.mean(x), np.mean(y)),
        width,
        height,
        angle=angle,
        facecolor=color,
        edgecolor=color,
        linewidth=0.9,
        alpha=0.11,
    )
    ax.add_patch(ellipse)
    return True


def embedding(
    input_path: Path,
    x: str,
    y: str,
    group: str,
    outdir: Path,
    unit: str | None = None,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    columns = [x, y, group] + ([unit] if unit else [])
    frame, data = _prepare(input_path, columns, [x, y])
    levels = data[group].astype(str).drop_duplicates().tolist()
    if not 1 <= len(levels) <= 12:
        raise ValueError(
            "Embedding display supports 1-12 declared groups at final size."
        )
    colors = resolve_palette(palette, colors_text, len(levels))
    _, font_info = _font_profile(font)
    fig, ax = plt.subplots(figsize=FIGSIZE)
    centroids = []
    ellipse_groups = []
    for color, level in zip(colors, levels):
        subset = data[data[group].astype(str) == level]
        ax.scatter(
            subset[x],
            subset[y],
            s=13,
            color=color,
            alpha=0.7,
            edgecolor="white",
            linewidth=0.2,
            label=level,
        )
        cx, cy = float(subset[x].mean()), float(subset[y].mean())
        centroids.append((level, cx, cy, color, len(subset)))
        if _confidence_ellipse(
            ax, subset[x].to_numpy(float), subset[y].to_numpy(float), color
        ):
            ellipse_groups.append(level)
    ax.set(xlabel=_display_label(x), ylabel=_display_label(y))
    ax.legend(frameon=False, markerscale=1.25, ncol=2 if len(levels) > 6 else 1)
    _axis(ax)
    fig.subplots_adjust(left=0.17, right=0.96, bottom=0.17, top=0.96)

    fig_centroid, ax_centroid = plt.subplots(figsize=FIGSIZE)
    for level, cx, cy, color, size in centroids:
        ax_centroid.scatter(
            cx,
            cy,
            s=42 + 2.5 * math.sqrt(size),
            color=color,
            edgecolor="white",
            linewidth=0.45,
        )
        ax_centroid.annotate(level, (cx, cy), xytext=(4, 4), textcoords="offset points")
    ax_centroid.set(xlabel=_display_label(x), ylabel=_display_label(y))
    _axis(ax_centroid)
    fig_centroid.subplots_adjust(left=0.17, right=0.96, bottom=0.17, top=0.96)
    analysis = {
        "family": "embedding",
        "coordinate_columns": [x, y],
        "declared_group_column": group,
        "ellipse_groups": ellipse_groups,
        "inference_scope": "descriptive display of supplied two-dimensional coordinates",
        "limitations": [
            "Coordinates and group labels are never recomputed or invented.",
            "Distances depend on the upstream preprocessing, metric, seed, and embedding parameters; ellipses are descriptive, not cluster tests.",
        ],
    }
    recipe = _base_recipe(
        "embedding",
        input_path,
        outdir,
        palette,
        colors_text,
        font,
        x=x,
        y=y,
        group=group,
        unit=unit,
    )
    return _save_bundle(
        outdir,
        [("embedding_groups", fig), ("embedding_centroids", fig_centroid)],
        _profile(input_path, frame, data, font_info, columns),
        analysis,
        recipe,
    )


def aligned_series(
    input_path: Path,
    x: str,
    first: str,
    second: str,
    outdir: Path,
    group: str | None = None,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    columns = [x, first, second] + ([group] if group else [])
    frame, data = _prepare(input_path, columns, [x, first, second])
    if data[x].duplicated().any() and group is None:
        raise ValueError(
            "Repeated x values require --group so series are not connected across units."
        )
    levels = (
        ["all"] if group is None else data[group].astype(str).drop_duplicates().tolist()
    )
    colors = resolve_palette(palette, colors_text, max(2, len(levels)))
    _, font_info = _font_profile(font)
    fig, axes = plt.subplots(
        2, 1, figsize=FIGSIZE, sharex=True, gridspec_kw={"hspace": 0.09}
    )
    for index, (column, ax) in enumerate(zip([first, second], axes)):
        for color, level in zip(colors, levels):
            subset = data if group is None else data[data[group].astype(str) == level]
            subset = subset.sort_values(x)
            ax.plot(
                subset[x],
                subset[column],
                marker="o",
                markersize=3.0,
                linewidth=1.15,
                color=color,
                label=level,
            )
        ax.set_ylabel(_display_label(column))
        _axis(ax)
    axes[-1].set_xlabel(_display_label(x))
    if group:
        axes[0].legend(frameon=False, ncol=2 if len(levels) > 4 else 1)
    fig.subplots_adjust(left=0.2, right=0.96, bottom=0.17, top=0.96)

    fig_z, ax_z = plt.subplots(figsize=FIGSIZE)
    for color, column in zip(colors[:2], [first, second]):
        values = data[column].to_numpy(float)
        sd = float(np.std(values, ddof=1))
        if sd == 0:
            raise ValueError(
                f"Column '{column}' is constant and cannot be standardized."
            )
        summary = (
            data.assign(_z=(values - float(np.mean(values))) / sd)
            .groupby(x, sort=True)["_z"]
            .mean()
        )
        ax_z.plot(
            summary.index,
            summary.values,
            marker="o",
            markersize=3,
            linewidth=1.25,
            color=color,
            label=_display_label(column),
        )
    ax_z.axhline(0, color="#9DA5AD", linewidth=0.75)
    ax_z.set(xlabel=_display_label(x), ylabel="Standardized value")
    ax_z.legend(frameon=False)
    _axis(ax_z)
    fig_z.subplots_adjust(left=0.18, right=0.96, bottom=0.17, top=0.96)
    analysis = {
        "family": "aligned-series",
        "replacement_for": "dual y-axis chart",
        "inference_scope": "descriptive aligned display",
        "limitations": [
            "Aligned panels preserve original units; the overlay uses within-column z scores only.",
            "Standardization aids shape comparison and must not be read as an effect-size estimate.",
        ],
    }
    recipe = _base_recipe(
        "aligned-series",
        input_path,
        outdir,
        palette,
        colors_text,
        font,
        x=x,
        first=first,
        second=second,
        group=group,
    )
    return _save_bundle(
        outdir,
        [("aligned_series", fig), ("standardized_overlay", fig_z)],
        _profile(input_path, frame, data, font_info, columns),
        analysis,
        recipe,
    )


def diverging(
    input_path: Path,
    item: str,
    value: str,
    outdir: Path,
    group: str | None = None,
    top: int = 24,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    columns = [item, value] + ([group] if group else [])
    frame, data = _prepare(input_path, columns, [value])
    if not 3 <= top <= 30:
        raise ValueError("--top must be between 3 and 30 for final-size legibility.")
    selected = data.reindex(data[value].abs().sort_values().index).tail(
        min(top, len(data))
    )
    labels = selected[item].astype(str).tolist()
    levels = selected[group].astype(str).drop_duplicates().tolist() if group else []
    colors = resolve_palette(palette, colors_text, max(2, len(levels)))
    if group:
        color_map = {level: colors[index] for index, level in enumerate(levels)}
        bar_colors = [color_map[str(x)] for x in selected[group]]
    else:
        bar_colors = [
            colors[0] if value >= 0 else colors[1] for value in selected[value]
        ]
    _, font_info = _font_profile(font)
    y = np.arange(len(selected))
    fig, ax = plt.subplots(figsize=FIGSIZE)
    ax.barh(y, selected[value], color=bar_colors, height=0.64)
    ax.axvline(0, color="#6F7880", linewidth=0.8)
    ax.set_yticks(y, labels)
    ax.set_xlabel(_display_label(value))
    _axis(ax)
    fig.subplots_adjust(left=_label_margin(labels), right=0.96, bottom=0.17, top=0.96)
    fig_dot, ax_dot = plt.subplots(figsize=FIGSIZE)
    ax_dot.hlines(y, 0, selected[value], color=bar_colors, linewidth=1.2)
    ax_dot.scatter(
        selected[value], y, color=bar_colors, s=27, edgecolor="white", linewidth=0.35
    )
    ax_dot.axvline(0, color="#6F7880", linewidth=0.8)
    ax_dot.set_yticks(y, labels)
    ax_dot.set_xlabel(_display_label(value))
    _axis(ax_dot)
    fig_dot.subplots_adjust(
        left=_label_margin(labels), right=0.96, bottom=0.17, top=0.96
    )
    analysis = {
        "family": "diverging-comparison",
        "zero_reference": True,
        "selection": f"largest absolute {value}; top {top}",
        "limitations": [
            "Signed direction must have a scientifically defined reference.",
            "Display ordering is descriptive and does not replace uncertainty intervals or multiplicity control.",
        ],
    }
    recipe = _base_recipe(
        "diverging",
        input_path,
        outdir,
        palette,
        colors_text,
        font,
        item=item,
        value=value,
        group=group,
        top=top,
    )
    return _save_bundle(
        outdir,
        [("diverging_bars", fig), ("diverging_lollipop", fig_dot)],
        _profile(input_path, frame, data, font_info, columns),
        analysis,
        recipe,
    )


def cumulative(
    input_path: Path,
    value: str,
    group: str,
    unit: str,
    outdir: Path,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    columns = [value, group, unit]
    frame, data = _prepare(input_path, columns, [value])
    if data[unit].duplicated().any():
        raise ValueError("Cumulative displays require one value per experimental unit.")
    levels = data[group].astype(str).drop_duplicates().tolist()
    colors = resolve_palette(palette, colors_text, len(levels))
    _, font_info = _font_profile(font)
    fig, ax = plt.subplots(figsize=FIGSIZE)
    fig_ccdf, ax_ccdf = plt.subplots(figsize=FIGSIZE)
    summary = {}
    for color, level in zip(colors, levels):
        values = np.sort(
            data.loc[data[group].astype(str) == level, value].to_numpy(float)
        )
        probability = np.arange(1, len(values) + 1) / len(values)
        ax.step(
            values, probability, where="post", color=color, linewidth=1.45, label=level
        )
        ax_ccdf.step(
            values,
            1 - np.arange(len(values)) / len(values),
            where="post",
            color=color,
            linewidth=1.45,
            label=level,
        )
        summary[level] = {
            "n": int(len(values)),
            "median": float(np.median(values)),
            "quartiles": np.quantile(values, [0.25, 0.75]).tolist(),
        }
    ax.set(
        xlabel=_display_label(value), ylabel="Cumulative probability", ylim=(0, 1.02)
    )
    ax_ccdf.set(xlabel=_display_label(value), ylabel="Probability ≥ x", ylim=(0, 1.02))
    for axis in (ax, ax_ccdf):
        axis.legend(frameon=False)
        _axis(axis)
    for figure in (fig, fig_ccdf):
        figure.subplots_adjust(left=0.19, right=0.96, bottom=0.17, top=0.96)
    analysis = {
        "family": "cumulative-distribution",
        "experimental_unit_column": unit,
        "group_summaries": summary,
        "limitations": [
            "Curves display empirical distributions without distributional smoothing.",
            "Account for censoring, clustering, or repeated measurements with a corresponding model rather than treating rows as independent.",
        ],
    }
    recipe = _base_recipe(
        "cumulative",
        input_path,
        outdir,
        palette,
        colors_text,
        font,
        value=value,
        group=group,
        unit=unit,
    )
    return _save_bundle(
        outdir,
        [("ecdf", fig), ("complementary_ecdf", fig_ccdf)],
        _profile(input_path, frame, data, font_info, columns),
        analysis,
        recipe,
    )


def swimmer(
    input_path: Path,
    unit: str,
    start: str,
    end: str,
    status: str,
    outdir: Path,
    event_time: str | None = None,
    group: str | None = None,
    palette: str = "zhoy_muted",
    colors_text: str | None = None,
    font: str = DEFAULT_FONT,
) -> list[Path]:
    columns = (
        [unit, start, end, status]
        + ([event_time] if event_time else [])
        + ([group] if group else [])
    )
    numeric = [start, end] + ([event_time] if event_time else [])
    frame, data = _prepare(input_path, columns, numeric)
    if data[unit].duplicated().any():
        raise ValueError(
            "Swimmer input must contain one interval per experimental unit."
        )
    if (data[end] < data[start]).any():
        raise ValueError("Every interval must satisfy end >= start.")
    if (
        event_time
        and ((data[event_time] < data[start]) | (data[event_time] > data[end])).any()
    ):
        raise ValueError("Every event time must lie within its unit's interval.")
    ordered = data.sort_values(end).reset_index(drop=True)
    labels = ordered[unit].astype(str).tolist()
    levels = ordered[group].astype(str).drop_duplicates().tolist() if group else ["all"]
    colors = resolve_palette(palette, colors_text, max(2, len(levels)))
    color_map = {level: colors[index] for index, level in enumerate(levels)}
    line_colors = (
        [colors[0]] * len(ordered)
        if group is None
        else [color_map[str(x)] for x in ordered[group]]
    )
    _, font_info = _font_profile(font)
    y = np.arange(len(ordered))
    fig, ax = plt.subplots(figsize=FIGSIZE)
    for index, row in ordered.iterrows():
        ax.hlines(
            index,
            row[start],
            row[end],
            color=line_colors[index],
            linewidth=4.2,
            alpha=0.85,
        )
        marker = (
            "o"
            if str(row[status]).lower()
            in {"event", "complete", "progression", "dead", "1"}
            else ">"
        )
        ax.scatter(
            row[end],
            index,
            marker=marker,
            s=24,
            color=line_colors[index],
            edgecolor="white",
            linewidth=0.35,
        )
        if event_time:
            ax.scatter(
                row[event_time],
                index,
                marker="D",
                s=18,
                color="#30363B",
                edgecolor="white",
                linewidth=0.3,
                zorder=4,
            )
    ax.set_yticks(y, labels)
    ax.set_xlabel(_display_label(end))
    _axis(ax)
    fig.subplots_adjust(left=_label_margin(labels), right=0.96, bottom=0.17, top=0.96)

    durations = ordered[end] - ordered[start]
    fig_duration, ax_duration = plt.subplots(figsize=FIGSIZE)
    ax_duration.scatter(
        durations, y, color=line_colors, s=28, edgecolor="white", linewidth=0.35
    )
    if event_time:
        ax_duration.scatter(
            ordered[event_time] - ordered[start],
            y,
            marker="D",
            s=17,
            color="#30363B",
            edgecolor="white",
            linewidth=0.3,
        )
    ax_duration.set_yticks(y, labels)
    ax_duration.set_xlabel("Duration")
    _axis(ax_duration)
    fig_duration.subplots_adjust(
        left=_label_margin(labels), right=0.96, bottom=0.17, top=0.96
    )
    analysis = {
        "family": "swimmer",
        "experimental_unit_column": unit,
        "status_column": status,
        "event_time_column": event_time,
        "inference_scope": "individual interval display",
        "limitations": [
            "Status symbols are descriptive; define status coding and censoring in the figure legend.",
            "A swimmer plot does not replace time-to-event analysis when censoring is present.",
        ],
    }
    recipe = _base_recipe(
        "swimmer",
        input_path,
        outdir,
        palette,
        colors_text,
        font,
        unit=unit,
        start=start,
        end=end,
        status=status,
        event_time=event_time,
        group=group,
    )
    return _save_bundle(
        outdir,
        [("swimmer", fig), ("swimmer_duration", fig_duration)],
        _profile(input_path, frame, data, font_info, columns),
        analysis,
        recipe,
    )


FAMILY_FUNCTIONS = {
    "forest": forest,
    "volcano": volcano,
    "confusion-matrix": confusion,
    "enrichment": enrichment,
    "survival": survival,
    "dose-response": dose_response,
    "roc": roc,
    "feature-rank": feature_rank,
    "embedding": embedding,
    "aligned-series": aligned_series,
    "diverging": diverging,
    "cumulative": cumulative,
    "swimmer": swimmer,
}


def recolor(
    recipe_path: Path, outdir: Path, palette: str, colors: str | None
) -> list[Path]:
    recipe = json.loads(recipe_path.read_text(encoding="utf-8"))
    source = Path(recipe["input"])
    if not source.is_absolute():
        source = (recipe_path.parent / source).resolve()
    family = recipe["family"]
    if family not in FAMILY_FUNCTIONS:
        raise ValueError(f"Unsupported advanced recipe family: {family}")
    parameters = dict(recipe.get("parameters", {}))
    parameters.update(
        {
            "input_path": source,
            "outdir": outdir,
            "palette": palette,
            "colors_text": colors,
            "font": recipe.get("font", DEFAULT_FONT),
        }
    )
    return FAMILY_FUNCTIONS[family](**parameters)


def _shared(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("input")
    parser.add_argument("--palette", default="zhoy_muted")
    parser.add_argument(
        "--colors", help="Comma-separated hex colors; overrides --palette"
    )
    parser.add_argument("--font", default=DEFAULT_FONT)
    parser.add_argument("--outdir", required=True)


def _columns(parser: argparse.ArgumentParser, *names: str) -> None:
    for name in names:
        parser.add_argument(f"--{name.replace('_', '-')}", dest=name, required=True)


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    sub = root.add_subparsers(dest="command", required=True)

    item = sub.add_parser("forest", help="Supplied estimates with confidence intervals")
    _shared(item)
    _columns(item, "term", "estimate", "low", "high")
    item.add_argument("--group")
    item.add_argument("--scale", choices=["linear", "log"], default="linear")
    item.add_argument("--reference", type=float)
    item.set_defaults(func=forest)

    item = sub.add_parser("volcano", help="Effect-size and adjusted-P display")
    _shared(item)
    _columns(item, "feature", "effect", "adjusted_p")
    item.add_argument("--effect-threshold", type=float, default=1.0)
    item.add_argument("--p-threshold", type=float, default=0.05)
    item.set_defaults(func=volcano)

    item = sub.add_parser(
        "confusion", help="Count and row-normalized confusion matrices"
    )
    _shared(item)
    _columns(item, "observed", "predicted", "unit")
    item.set_defaults(func=confusion)

    item = sub.add_parser(
        "enrichment", help="Bubble and lollipop views of supplied enrichment results"
    )
    _shared(item)
    _columns(item, "term", "effect", "adjusted_p", "count")
    item.add_argument("--category")
    item.add_argument("--top", type=int, default=15)
    item.set_defaults(func=enrichment)

    item = sub.add_parser(
        "survival", help="Kaplan-Meier curves with risk-table candidate"
    )
    _shared(item)
    _columns(item, "time", "event", "group", "unit")
    item.set_defaults(func=survival)

    item = sub.add_parser(
        "dose-response", help="Four-parameter logistic fit and residual diagnostic"
    )
    _shared(item)
    _columns(item, "dose", "response", "group")
    item.add_argument("--unit")
    item.set_defaults(func=dose_response)

    item = sub.add_parser("roc", help="ROC and precision-recall with unit bootstrap")
    _shared(item)
    _columns(item, "outcome", "score", "unit")
    item.add_argument("--cohort")
    item.add_argument("--positive", default="1")
    item.set_defaults(func=roc)

    item = sub.add_parser(
        "feature-rank", help="Ranked lollipop and optional interval display"
    )
    _shared(item)
    _columns(item, "item", "value")
    item.add_argument("--low")
    item.add_argument("--high")
    item.add_argument("--group")
    item.add_argument("--top", type=int, default=20)
    item.set_defaults(func=feature_rank)

    item = sub.add_parser(
        "embedding", help="Faithful display of supplied 2D coordinates"
    )
    _shared(item)
    _columns(item, "x", "y", "group")
    item.add_argument("--unit")
    item.set_defaults(func=embedding)

    item = sub.add_parser(
        "aligned-series", help="Safer aligned replacement for a dual y-axis"
    )
    _shared(item)
    _columns(item, "x", "first", "second")
    item.add_argument("--group")
    item.set_defaults(func=aligned_series)

    item = sub.add_parser("diverging", help="Signed comparisons around a defined zero")
    _shared(item)
    _columns(item, "item", "value")
    item.add_argument("--group")
    item.add_argument("--top", type=int, default=24)
    item.set_defaults(func=diverging)

    item = sub.add_parser("cumulative", help="ECDF and complementary ECDF")
    _shared(item)
    _columns(item, "value", "group", "unit")
    item.set_defaults(func=cumulative)

    item = sub.add_parser(
        "swimmer", help="Individual intervals, status, and optional event times"
    )
    _shared(item)
    _columns(item, "unit", "start", "end", "status")
    item.add_argument("--event-time")
    item.add_argument("--group")
    item.set_defaults(func=swimmer)

    item = sub.add_parser(
        "recolor", help="Rerender a saved advanced recipe without changing analysis"
    )
    item.add_argument("recipe")
    item.add_argument("--palette", default="okabe_ito")
    item.add_argument("--colors")
    item.add_argument("--outdir", required=True)
    item.set_defaults(func=None)
    return root


def main() -> None:
    args = parser().parse_args()
    if args.command == "recolor":
        files = recolor(
            Path(args.recipe).resolve(), Path(args.outdir), args.palette, args.colors
        )
    else:
        values = vars(args).copy()
        function = values.pop("func")
        values.pop("command")
        values["input_path"] = Path(values.pop("input"))
        values["outdir"] = Path(values["outdir"])
        values["colors_text"] = values.pop("colors")
        files = function(**values)
    print(
        f"Generated {len(files)} validated candidates in {Path(args.outdir).resolve()}"
    )


if __name__ == "__main__":
    main()

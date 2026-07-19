---
name: make-sci-data-figures
description: Turn minimally structured CSV, TSV, or Excel data into scientifically defensible, publication-ready figure candidates with fixed canvases, editable SVG, effect estimates, uncertainty, statistical sensitivity checks, and one-command palette switching. Use for raw-data plotting, chart selection, group comparisons, paired data, figure alternatives, statistical figure planning, and reproducible SCI result graphics.
---

# Make SCI Data Figures

Start from the biological question and experimental unit, not from a preferred chart type. Produce several honest candidates from the same data, keep their canvas and typography identical, and explain why each candidate is or is not appropriate.

## Minimum intake

Accept tidy CSV, TSV, or XLSX. The minimum scientifically useful columns are one continuous outcome, one grouping variable, and one biological experimental-unit ID. Before inferential statistics, establish:

1. the outcome, unit, and intended claim;
2. the biological experimental unit;
3. whether observations are independent, paired, repeated, nested, or technical replicates;
4. the reference group and group order;
5. whether endpoints or contrasts were pre-specified or exploratory.

Run `scripts/figure_workbench.py profile INPUT` immediately. Ask only for high-impact facts that the file cannot reveal. Do not silently treat cells, fields, wells, repeated measurements, or technical replicates as independent biological units.

Read `references/data_contract.md` for accepted layouts. Read `references/statistics_and_chart_selection.md` before selecting a statistical design or making significance claims.

## Generate candidates

Use an explicit design for inference:

```bash
python scripts/figure_workbench.py generate data.csv \
  --group condition --value response --unit sample_id \
  --design independent --outcome-type continuous \
  --unit-label "%" --outdir results
```

For paired data, use the same biological-unit ID in both conditions and pass `--unit subject_id --design paired`. The command creates:

- fixed-canvas PNG, SVG, and PDF candidates;
- a same-size comparison gallery;
- `data_profile.json`, `analysis_plan.json`, and `figure_recipe.json`;
- a deterministic rendering recipe that can be recolored without changing data, statistics, geometry, or group order.

Candidate types are conditional, not decorative: two-group estimation graphics; rainclouds when group sizes support density estimation; raw points with estimate and 95% CI; box/violin plus raw observations; paired estimation graphics and trajectories for complete pairs; and horizontal group-estimate intervals for multi-group designs. Never default to a bar chart when the raw distribution can be shown.

## Change the palette without changing the science

```bash
python scripts/figure_workbench.py recolor results/figure_recipe.json \
  --palette okabe_ito --outdir results_okabe_ito
```

Use `assets/palettes.json` as the single palette registry. A palette change must not alter filtering, order, estimand, uncertainty, axes, annotations, or canvas. User/project colors override bundled defaults.

## Statistical behavior

- Lead with an estimand and 95% confidence interval. Treat a test result as supporting evidence, not the plot's sole message.
- Default to exploratory scope and keep *P* values in the analysis record rather than the artwork. Show an exact *P* value only after the user confirms a pre-specified confirmatory analysis family (`--scope confirmatory --show-p-value`).
- For two independent groups, use the mean difference with bootstrap CI and Welch's test, with Mann–Whitney as a labeled sensitivity analysis.
- For paired groups, use the paired mean difference with bootstrap CI and a paired test, with Wilcoxon as a labeled sensitivity analysis.
- For more than two independent groups, use a global Welch ANOVA and Kruskal–Wallis sensitivity result. Do not invent pairwise post-hoc claims.
- Do not switch tests solely because a small-sample normality test crossed 0.05.
- Do not pool technical replicates as biological replicates. Do not average or impute missing values without an explicit rule.
- Keep exact test names, biological-unit counts, exclusions, effect direction, uncertainty definition, diagnostics, analysis scope, and multiplicity status in `analysis_plan.json`.
- Synthetic example data must remain labeled synthetic. Never relabel it as experimental data.

Use the worked independent, paired, and multi-group examples in `references/statistics_and_chart_selection.md` to explain the statistical match. State what the skill selected, why it matches the experimental unit, what it refused to infer, and which output makes that decision visible.

## Artwork rules

- Use Arial by default, or replace the global font once when the verified target requires another family.
- Do not place panel letters, serial numbers, per-panel titles, subtitles, or conclusions inside reusable artwork.
- Use correct case, italics, symbols, units, subscripts, and superscripts.
- Reserve a non-data annotation margin for compact statistical evidence; never print text over points, lines, intervals, or markers.
- Keep all candidate canvases identical. Never use tight bounding-box export.
- Keep SVG text live and editable.
- Size typography for the declared final slot, then inspect it at that size. A contact sheet must not shrink panels into thumbnails; stack candidates vertically for README/showcase review when a horizontal row would make ticks, units, or evidence hard to read.

## Finish with the polish skill

After a candidate is selected, use `$polish-sci-figures` to run final-size typography, overlap, whitespace, fixed-canvas, SVG-editability, and real-container checks. Do not call a generated candidate publication-ready until that acceptance gate passes.

Read `references/professional_basis.md` for the reporting, experimental-unit, *P*-value, figure-selection, and implementation sources behind these safeguards. The code is original to this repository; the references define scientific constraints, not copied implementation.

## Acceptance gate

Do not deliver if the experimental unit/design is unresolved, a required group is missing, statistics are presented as confirmatory without declared scope, raw observations are hidden unnecessarily, candidate canvases differ, palette switching changes semantics, final-size text is small or ragged, or any title/number/overlap appears in the artwork.

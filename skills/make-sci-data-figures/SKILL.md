---
name: make-sci-data-figures
description: Turn minimally structured CSV, TSV, or Excel data into scientifically defensible, publication-ready figure candidates with fixed canvases, editable SVG, analysis records, and one-command palette switching. Use for continuous or paired comparisons, relationships, longitudinal data, compositions, matrices, survival, dose-response, ROC/PR, forest, volcano, enrichment, embeddings, cumulative distributions, swimmer plots, chart selection, statistical planning, and reproducible SCI result graphics.
---

# Make SCI Data Figures

Start from the biological question and experimental unit, not from a preferred chart type. Produce several honest candidates from the same data, keep their canvas and typography identical, and explain why each candidate is or is not appropriate.

## Minimum intake

Accept tidy CSV, TSV, or XLSX. Route the table by scientific structure rather than forcing every dataset into a group comparison:

| Structure | Required declarations | Script command |
| --- | --- | --- |
| Continuous group comparison | group, value, biological-unit ID, independent/paired design, authoritative order | `figure_workbench.py generate` |
| Numeric relationship | x, y, biological-unit ID; optional group | `data_family_workbench.py relationship` |
| Longitudinal response | time, value, group, biological-unit ID | `data_family_workbench.py timecourse` |
| Composition | sample, category, non-negative value; optional group | `data_family_workbench.py composition` |
| Tidy matrix | row, column, value; explicit or automatic display clustering | `data_family_workbench.py matrix` |
| Survival | follow-up time, 0/1 event, group, biological-unit ID | `advanced_template_workbench.py survival` |
| Dose-response | positive dose, response, group; optional unit ID | `advanced_template_workbench.py dose-response` |
| Classification | binary outcome, score, biological-unit ID; optional cohort | `advanced_template_workbench.py roc` |
| Supplied specialist results | family-specific estimate/result columns | `advanced_template_workbench.py FAMILY` |

Before inferential statistics, establish:

1. the outcome, unit, and intended claim;
2. the biological experimental unit;
3. whether observations are independent, paired, repeated, nested, or technical replicates;
4. the reference group and group order;
5. whether endpoints or contrasts were pre-specified or exploratory.

For a group comparison, run `scripts/figure_workbench.py profile INPUT` immediately. For another family, run its generator only after identifying the required columns; the command performs family-specific validation before drawing. Ask only for high-impact facts that the file cannot reveal. Do not silently treat cells, fields, wells, repeated measurements, or technical replicates as independent biological units.

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

## Generate other validated data families

Use the smallest command matching the declared structure:

```bash
python scripts/data_family_workbench.py relationship data.csv \
  --x exposure --y response --unit sample_id --group cohort --outdir relationship_results

python scripts/data_family_workbench.py timecourse data.csv \
  --time day --value signal --group condition --unit subject_id --outdir timecourse_results

python scripts/data_family_workbench.py composition data.csv \
  --sample sample_id --category cell_type --value count --group condition --outdir composition_results

python scripts/data_family_workbench.py matrix data.csv \
  --row pathway --column condition --value z_score --cluster auto --outdir matrix_results
```

These commands generate two complementary views instead of one default chart: fitted relationship plus joint distributions; individual time trajectories plus within-unit change; whole-sample composition plus normalized heatmap; or heatmap plus signed-magnitude dot matrix. Each command creates fixed-canvas PNG/SVG/PDF, a comparison gallery, `data_profile.json`, `analysis_plan.json`, and `figure_recipe.json`.

These families are not a license to invent specialist inference. Relationship statistics are association summaries; longitudinal ribbons are descriptive pointwise intervals; compositions are normalized but not tested component by component; matrix clustering is exploratory and records its method and order.

## Use the upgraded 1-124 template atlas

The audited atlas maps every source template number exactly once into 20 scientific families. Resolve a remembered template number before drawing:

```bash
python ../polish-sci-figures/scripts/template_router.py resolve --template 73
python ../polish-sci-figures/scripts/template_router.py self-check
```

The router converts decorative variants into input contracts and executable workflows; it does not copy source artwork. Families already handled above stay on their established workbenches. Use `scripts/advanced_template_workbench.py` for:

- Kaplan-Meier plus risk table; forest intervals; volcano; confusion matrices; enrichment;
- four-parameter dose-response plus residuals; ROC plus precision-recall;
- feature ranking; supplied embeddings; aligned replacements for dual axes;
- signed diverging comparisons; empirical cumulative distributions; swimmer plots.

Every advanced command validates its scientific contract and creates two fixed-canvas candidate views, editable PNG/SVG/PDF exports, `data_profile.json`, `analysis_plan.json`, `figure_recipe.json`, and a comparison gallery. Use `advanced_template_workbench.py recolor RECIPE --palette PALETTE --outdir OUTPUT` for palette-only rerendering.

Read `references/advanced_template_contracts.md` before running an advanced family or describing its statistical meaning.

Do not turn the atlas into a style menu. Select the family from the question, experimental unit, measurement structure, and intended claim. Decorative bars, donuts, flowers, watercolor fills, and dual y-axes are replaced when they hide distributions, uncertainty, denominators, or incompatible units.

## Change the palette without changing the science

```bash
python scripts/figure_workbench.py recolor results/figure_recipe.json \
  --palette okabe_ito --outdir results_okabe_ito
```

For relationship, time-course, composition, or matrix recipes, use `scripts/data_family_workbench.py recolor`; for the advanced families, use `scripts/advanced_template_workbench.py recolor` with the same arguments.

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
- For relationships, report Pearson, Spearman, and slope as association summaries and refuse repeated biological-unit IDs.
- For longitudinal data, preserve individual trajectories and refuse duplicate unit-time cells. Do not generate a repeated-measures *P* value without a declared longitudinal model.
- For compositions, enforce non-negative components and positive sample totals, normalize within sample, and state the sum-to-one dependence. Do not run naive component-wise tests.
- For matrices, reject duplicate cells, preserve or record clustering order, and refuse a density that would make the fixed publication canvas unreadable.
- For survival, preserve censoring and risk sets, use pointwise log-log Greenwood intervals, and limit automatic inference to an unadjusted two-group log-rank result. Require a declared specialist model for adjusted effects.
- For dose-response, fit a four-parameter logistic model on positive log-dose values, report a generic midpoint with covariance interval, and use IC₅₀/EC₅₀ terminology only when the endpoint and direction justify it.
- For ROC/PR, require one prediction per biological unit, record prevalence, and use deterministic unit-level bootstrap intervals. Never call internal performance external validation.
- For volcano, enrichment, forest, feature-rank, and embedding inputs, treat supplied results and coordinates as authoritative. Do not recreate differential models, ontologies, uncertainty, clusters, or causal claims from display columns.
- Replace dual y-axes with aligned original-unit panels and an explicitly standardized overlay; standardization is not an effect-size estimate.

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

Do not deliver if the experimental unit/design is unresolved, a required group is missing, a family-specific uniqueness/positivity check fails, specialist inference has been substituted with a descriptive shortcut, statistics are presented as confirmatory without declared scope, raw observations are hidden unnecessarily, candidate canvases differ, palette switching changes semantics, final-size text is small or ragged, or any title/number/overlap appears in the artwork.

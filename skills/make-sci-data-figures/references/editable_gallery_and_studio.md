# Editable gallery and Figure Studio contracts

Suite v1.4.6 uses the same renderers for the AI/CLI route and Figure Studio's local engine. This reference distinguishes source observations, supplied results and display edits so that a template choice cannot silently change the scientific question. Figure Studio 0.1.6 packages this engine in the official Windows application; source users install the normal Python requirements.

## Template selection and generation

`scripts/gallery_cli.py --list` lists 191 original table-driven templates with bilingual names, required columns, numeric columns and notes. The editor adds 15 empirical ROC/precision–recall starters and 12 supplied-result ROC starters, for 218 editable starting points. The CLI list covers the gallery registry, not those separate ROC routes.

```bash
python scripts/gallery_cli.py --list
python scripts/gallery_cli.py --view compare_raincloud --input observations.csv --out results/raincloud
```

For this example the table must contain `group`, `unit` and `value`; unit identifiers must describe the real experimental unit when used for inference. The generated directory contains source-driven SVG candidates, a recipe, a source hash and an analysis record. Pass it to the companion editor builder, using paths relative to the suite root:

```bash
python sci_figures.py studio results/raincloud --out figure-studio.html
python sci_figures.py studio-serve figure-studio.html --port 8767
```

Previews and applied views use the same renderer. Compatible alternatives come from explicit semantic groups plus validation, not merely matching column names. The current template or model result must answer the user's question before appearance is compared. The local engine prepares native portrait, wide and spanning canvases; only explicitly reviewed templates implement the shared exact plot-frame contract. Do not promise uniform axes for arbitrary imported artwork.

## Observations versus supplied results

Observation templates compute only their documented descriptions or summaries. Result templates such as SHAP, GSEA, nomograms, model intervals, diagnostic meta-analysis, decompositions and supplied regression fits require the corresponding results and method information. Replacing those tables changes the displayed result; it does not refit an upstream model.

Empirical ROC views use outcome/score records, declared positive class and units. Supplied-result ROC views need their own computed coordinates, intervals or cohort/time metadata. Ordinary binary ROC observations are not sufficient for survival ROC, cross-validation summaries or pooled diagnostic models. Fixed-score bootstrap uncertainty is distinct from refitting uncertainty.

## Local analysis and result binding

The loopback engine accepts `POST /api/analyze` with `{recipe, rows, config}`. A raw-data request declares group, outcome, unit, independent/paired design, method and either all-pairs or control comparisons. An optional facet column separates result sections; an explicit column/value filter may isolate score rows in a mixed PCA table. A comparison of one PCA coordinate is not a test of overall multivariate separation.

The four supported comparison methods are Welch's independent *t* test, Mann–Whitney *U*, paired *t* and Wilcoxon signed-rank. Choose according to design, estimation target and assumptions, not the resulting *P* value. Paired data join by unit ID. Duplicate records, cross-group reuse of an independent unit, incomplete pairs, missing/nonfinite outcomes and undefined constant-data tests are rejected rather than silently repaired. A unique row number does not establish biological independence.

One Holm adjustment covers every requested pair across all facets. The response preserves facet identity and does not create cross-facet comparisons. Letters require a complete all-pairs family; shared letters mean a difference was not detected at the chosen threshold, not equivalence. Mean-contrast intervals are unadjusted pairwise intervals and must not be borrowed for rank tests or called simultaneous intervals.

For result-table mode, map the two group columns and numeric *P* column and declare the method and correction status. Raw values can receive Holm correction; already-adjusted values retain their declared adjustment. Unadjusted imports are limited to one comparison. A missing, duplicate or incomplete declared comparison family must be resolved before annotation.

The response records `{analysis, config, data_sha256}`. `POST /api/render` can receive the statistics configuration alongside new rows; a valid current-data binding is recomputed atomically with the graph. Invalid drafts leave the prior valid asset intact. External results and split-facet snapshots become stale after the corresponding data change. Never copy old *P* values onto changed observations or redefine a global family as separate facet families merely to fit the page.

## Handoff and verification

The AI-only workbench remains available. Offer direct editing when requested, retain the authoritative source and analysis bundle, and inspect a returned Studio JSON or SVG before final delivery. Character-level display edits and custom annotations are editable presentation; they do not rewrite the result record or the Python/R source.

Check replaced data and actual narrow, wide and tall drawings when introducing or changing a template. Inspect final-size labels, legends, numerical color scales and statistical interpretation. Catalogue completeness and SVG bounds tests do not establish visual quality for every dataset. See the companion [Figure Studio reference](../../polish-sci-figures/references/figure_studio.md) for editor, export and provenance details.

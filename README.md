# SCI Figure Skills

An original, runnable Codex skill suite for turning raw research data and scientific images into publication-ready figures, then auditing the final artwork.

中文简介：从原始表格自动生成多种可靠的 SCI 图候选并一键换色；批量统一显微、荧光、电镜等科研图片的尺寸、显示参数和规范标尺；最后完成可编辑 SVG、固定画布、字体、留白、重叠与组图质控。

## Three-skill pipeline

| Skill | What it does | Main outputs |
| --- | --- | --- |
| `make-sci-data-figures` | Profiles CSV/TSV/XLSX data, records the experimental design, chooses defensible statistics, and creates several chart candidates from the same data | PNG/SVG/PDF candidates, gallery, analysis plan, reproducible recipe |
| `standardize-sci-images` | Non-destructively standardizes microscopy, fluorescence, histology, and electron-microscopy images | Equal-size panels, calibrated scale bars, montage, SHA-256 processing audit |
| `polish-sci-figures` | Redraws, assembles, and audits final manuscript, slide, poster, or showcase figures | Fixed-canvas editable files and final-size QA |

These are not renamed copies of third-party skills. The workflow and code were written for this repository around recurring real-world pain points: wrong statistical units, hidden distributions, inconsistent palettes, unequal canvases, changing apparent font sizes, internal mini-titles, panel numbers, overlaps, broken scientific notation, uneditable SVG text, guessed scale bars, and unfair per-image contrast tuning.

## What makes the data-figure workbench different

Give it a tidy table, name the group, outcome, biological experimental unit, and whether observations are independent or paired. It profiles the data, matches a defensible analysis, generates several genuinely different figure types, and preserves the decision in a machine-readable analysis plan. The result is not a decorative chart template: raw observations, effect size, uncertainty, design, exclusions, sensitivity analysis, canvas, typography, and palette semantics stay connected.

- **High-information alternatives:** estimation graphics, rainclouds, paired estimation graphics, group-estimate intervals, raw-data summaries, box plots, and violins are generated only when the design and sample size support them.
- **Statistics before decoration:** the biological unit and pairing determine the analysis; the preferred visual style cannot silently change the test.
- **One-command restyling:** palette changes leave data, statistics, axes, labels, ordering, and geometry untouched.
- **Manuscript-ready construction:** identical physical canvases, readable Arial text, no internal mini-titles or panel numbers, live SVG text, and editable PDF/SVG output.
- **Refuses false certainty:** unsupported repeated measures, mixed models, survival analysis, count models, compositional data, and high-dimensional omics are routed to specialist analysis instead of receiving an invented automatic test.

All values below are deterministic synthetic demonstration data. Descriptions remain outside the reusable artwork.

### Estimation-first two-group comparison

Raw observations and group estimates are shown beside the bootstrap distribution of the treatment-minus-control effect. In the bundled example the estimated mean difference is 2.48 a.u. (95% CI 1.95 to 3.00), so the figure communicates magnitude and uncertainty rather than relying on a significance star.

![Two-group estimation graphic](demo/workbench/estimation_graphic.png)

### Raincloud distribution view

Half-violin density, every observation, interquartile range, and median are combined without hiding the sample. The workbench does not generate this density view when a group has fewer than 10 observations.

![Raincloud figure](demo/workbench/raincloud.png)

### Paired estimation view

Subject-level trajectories preserve the matching, while the second axis shows the within-subject mean difference and 95% CI. In the example the paired change is 1.14 normalized units (95% CI 0.978 to 1.31).

![Paired estimation graphic](demo/paired_workbench/paired_estimation.png)

### Multi-group effect intervals

Every biological sample remains visible behind the group mean and 95% CI. The global analysis is kept global; the skill does not manufacture pairwise claims that were never specified.

![Multi-group estimates with confidence intervals](demo/multigroup_workbench/group_estimate_forest.png)

These choices follow estimation-first reporting described in [Ho et al., *Nature Methods* (2019)](https://www.nature.com/articles/s41592-019-0470-3), the transparent distribution logic of [raincloud plots](https://pmc.ncbi.nlm.nih.gov/articles/PMC6480976/), and the editable-text, accessible-color, compact-layout guidance in the [Nature Research figure guide](https://research-figure-guide.nature.com/figures/preparing-figures-our-specifications/). A good figure cannot rescue a weak experimental design or guarantee acceptance, but it can remove avoidable statistical and artwork failures.

## Statistical matching in seconds

| Research situation | Minimal user input | Automatic match and concrete example | Scientific guardrail |
| --- | --- | --- | --- |
| Control vs treatment using different biological samples | `condition`, `Response`, `sample_id`, `independent` | Treatment-minus-control mean difference and 95% CI; Welch two-sample test; Mann-Whitney sensitivity analysis. Example effect: 2.48 a.u. (1.95 to 3.00). | Repeated unit IDs are rejected instead of being counted as independent replication. |
| Before vs after on the same subjects | `condition`, `Response`, `subject_id`, `paired` | Within-subject mean difference and 95% CI; paired test; Wilcoxon sensitivity analysis. Example change: 1.14 normalized units (0.978 to 1.31). | Duplicate subject-condition rows are rejected; incomplete pairs are counted and reported. |
| Vehicle plus three independent dose groups | `condition`, `Response`, `sample_id`, `independent` | Group means and 95% CIs; global Welch ANOVA; Kruskal-Wallis sensitivity analysis. | A global result never becomes an undeclared pairwise claim; multiplicity remains explicit. |

Exact tests, effect direction, sample counts, exclusions, diagnostics, limitations, analysis scope, and multiplicity status are written to `analysis_plan.json`. Exploratory results show the effect and interval on the artwork while keeping *P* values in the analysis record; `--scope confirmatory --show-p-value` is available only after a pre-specified confirmatory family is declared.

### Run the reproducible examples

```bash
# Independent two-group comparison: creates five candidates
python skills/make-sci-data-figures/scripts/figure_workbench.py generate \
  skills/make-sci-data-figures/examples/synthetic_group_comparison.csv \
  --group condition --value Response --unit sample_id \
  --design independent --order Control,Treatment --unit-label "a.u." \
  --outdir demo/workbench

# Paired before/after comparison: creates paired effect and trajectory views
python skills/make-sci-data-figures/scripts/figure_workbench.py generate \
  skills/make-sci-data-figures/examples/synthetic_paired_response.csv \
  --group condition --value Response --unit subject_id \
  --design paired --order Before,After --unit-label "normalized units" \
  --outdir demo/paired_workbench

# Four independent groups: creates group-interval and distribution views
python skills/make-sci-data-figures/scripts/figure_workbench.py generate \
  skills/make-sci-data-figures/examples/synthetic_multigroup_response.csv \
  --group condition --value Response --unit sample_id --design independent \
  --order "Vehicle,Low dose,Mid dose,High dose" --unit-label "a.u." \
  --outdir demo/multigroup_workbench
```

Change only the palette while keeping the analysis and geometry fixed:

```bash
python skills/make-sci-data-figures/scripts/figure_workbench.py recolor \
  demo/workbench/figure_recipe.json --palette okabe_ito \
  --outdir demo/workbench_okabe_ito
```

![The same estimation graphic recolored without changing the analysis](demo/workbench_okabe_ito/estimation_graphic.png)

The current automatic inference scope is deliberately limited to common continuous-outcome independent and paired group comparisons. Unsupported specialist designs receive an explicit limitation instead of a plausible-looking but scientifically unsafe answer.

## Scientific image standardization

The preview below uses synthetic fluorescence-like software-test images, not biological observations.

![Standardized image montage](demo/image_standardization/montage.png)

```bash
python skills/standardize-sci-images/scripts/make_example_data.py \
  --outdir demo/image_inputs

python skills/standardize-sci-images/scripts/standardize_images.py \
  demo/image_inputs/manifest.csv --scale-bar-um 20 \
  --outdir demo/image_standardization
```

The image workflow never overwrites raw files, never invents calibration, never tunes display settings per comparison image, and never resamples by default. It records source hashes, crop boxes, display parameters, calibration, and scale-bar geometry. Each panel includes an unannotated display raster, a review preview, and an SVG with the scale bar/text kept as editable vector/live layers.

## Figure-polishing showcase

All values in these previews are deterministic synthetic demonstration data.

![Efficacy figure](demo/Fig1_Efficacy.png)

![Mechanism figure](demo/Fig2_Mechanism.png)

![Validation figure](demo/Fig3_Validation.png)

![Single-cell and spatial figure](demo/Fig4_CellAtlas.png)

![Systems biology figure](demo/Fig5_SystemsMap.png)

![Interpretable modeling figure](demo/Fig6_ModelInsight.png)

## Shared quality rules

- No panel letters, serial labels, internal titles, or subtitles unless the verified target explicitly requires them.
- Arial by default, with one-place switching to Times New Roman or another verified journal font.
- Correct scientific case, italics, symbols, units, subscripts, and superscripts.
- Zero unintended overlap at final placement.
- Equal physical canvases and axes geometry for panels that will be assembled together; no tight-crop export.
- Editable SVG/PDF plus high-resolution PNG, with live continuous text.
- Stable group order, color meaning, uncertainty definition, and statistical scope.
- Raw scientific data and images remain authoritative; examples stay clearly labeled synthetic.

## Install

Clone or download the repository, install dependencies, then copy all three skill folders.

### Windows PowerShell

```powershell
python -m pip install -r requirements.txt
New-Item -ItemType Directory -Force "$HOME\.codex\skills" | Out-Null
Copy-Item -Recurse -Force ".\skills\make-sci-data-figures" "$HOME\.codex\skills\"
Copy-Item -Recurse -Force ".\skills\standardize-sci-images" "$HOME\.codex\skills\"
Copy-Item -Recurse -Force ".\skills\polish-sci-figures" "$HOME\.codex\skills\"
```

### macOS / Linux

```bash
python -m pip install -r requirements.txt
mkdir -p ~/.codex/skills
cp -R skills/make-sci-data-figures ~/.codex/skills/
cp -R skills/standardize-sci-images ~/.codex/skills/
cp -R skills/polish-sci-figures ~/.codex/skills/
```

Start a new Codex session after installation.

## Call the skills

```text
Use $make-sci-data-figures to profile this table and make several publication-ready candidates.
Use $make-sci-data-figures to rerender the selected figure with the okabe_ito palette only.
Use $standardize-sci-images to standardize this microscopy batch and add calibrated 20 µm scale bars.
Use $polish-sci-figures to assemble the chosen panels and audit the final editable SVGs.
```

## Verify the repository

```bash
python skills/make-sci-data-figures/scripts/test_figure_workbench.py
python skills/standardize-sci-images/scripts/test_standardize_images.py
python -m compileall -q demo skills
```

For a set of independently editable SVG panels intended for the same slot:

```bash
python skills/polish-sci-figures/scripts/check_svg_canvas.py path/to/panels/*.svg
python skills/polish-sci-figures/scripts/check_svg_editability.py --require-fully-editable path/to/panels/*.svg
```

## Repository layout

```text
skills/make-sci-data-figures/   raw data, statistics, candidate charts, palette recipes
skills/standardize-sci-images/  calibrated image standardization and processing audit
skills/polish-sci-figures/      final drawing, assembly, export, and QA
demo/                           reproducible synthetic previews
requirements.txt                Python dependencies
```

## License

MIT License. See [LICENSE](LICENSE).

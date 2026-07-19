# SCI Figure Skills

Publication-grade scientific visualization for raw data, microscopy, multimodal analysis, and multi-panel figure assembly.

中文简介：从原始表格自动生成多种可靠的 SCI 图候选并一键换色；批量统一显微、荧光、电镜等科研图片的尺寸、显示参数和规范标尺；最后完成可编辑 SVG、固定画布、字体、留白、重叠与组图质控。

## Advanced reproducible figures

Deterministic synthetic datasets, fixed random seeds, source-controlled rendering, and matched 180.34 × 134.62 mm PNG/SVG/PDF exports.

### Longitudinal multimodal ecosystem

Conserved cell-state flows, directional ligand–receptor interactions, RNA–ATAC concordance, and treatment-response distributions in one coordinated figure.

![Longitudinal multimodal transition figure](demo/Fig7_MultimodalTransition.png)

### Single-cell and spatial atlas

Bent single-cell manifolds, pseudotime branching, spatial domains with a declared synthetic scale, and marker-expression dot plots.

![Single-cell and spatial atlas figure](demo/Fig4_CellAtlas.png)

### Systems biology integration

Directional cell communication, cross-platform pathway activity, causal mediation, and response-surface optimization.

![Systems biology integration figure](demo/Fig5_SystemsMap.png)

### Interpretable and externally validated modeling

Feature contributions, calibration, decision-curve analysis, and repeated external validation.

![Interpretable modeling figure](demo/Fig6_ModelInsight.png)

### Reproduce

```bash
python -m pip install -r requirements.txt
python demo/figure_sources/make_demo_suite.py
```

## Three-skill pipeline

| Skill | What it does | Main outputs |
| --- | --- | --- |
| `make-sci-data-figures` | Profiles CSV/TSV/XLSX data, records the experimental design, chooses defensible statistics, and creates several chart candidates from the same data | PNG/SVG/PDF candidates, gallery, analysis plan, reproducible recipe |
| `standardize-sci-images` | Non-destructively standardizes microscopy, fluorescence, histology, and electron-microscopy images | Equal-size panels, calibrated scale bars, montage, SHA-256 processing audit |
| `polish-sci-figures` | Redraws, assembles, and audits final manuscript, slide, poster, or showcase figures | Fixed-canvas editable files and final-size QA |

The suite enforces experimental-unit integrity, stable palette semantics, equal physical canvases, live SVG text, scientific notation, and final-size collision and whitespace QA.

## Raw data to figures and statistics

Input: tidy CSV, TSV, or XLSX matching one of the validated contracts below. Output: structure-matched figure candidates, editable masters, a machine-readable analysis plan, and a reproducible palette recipe.

- **Design-driven figure generation:** produces multiple scientifically appropriate candidates from the same dataset while preserving raw observations, effect estimates, uncertainty, pairing, and group structure.
- **Design-aware inference:** experimental unit and pairing determine the estimand, confidence interval, primary test, and sensitivity analysis.
- **Palette-only rendering:** color changes preserve data, statistics, axes, ordering, labels, and geometry.
- **Production geometry:** identical physical canvases, Arial typography, live SVG text, and editable PDF/SVG output.
- **Scope control:** longitudinal and compositional structures receive rigorous descriptive views, while mixed-model, survival, count, compositional-inference, and high-dimensional claims are routed to a pre-specified specialist analysis.

Demonstration datasets in this section are deterministic and synthetic.

### Validated raw-data families

| Data structure | Minimal columns | Generated candidates | Scientific safeguard |
| --- | --- | --- | --- |
| Independent, paired, or multi-group continuous outcome | group, value, biological-unit ID, design | Estimation, raw-data/interval, raincloud, box/violin, paired trajectories, or group intervals as supported by the design and sample size | Experimental-unit, pairing, group-order, and confirmatory-scope checks; effect estimates and sensitivity analyses recorded |
| Numeric relationship | x, y, biological-unit ID; optional group | Group-aware fitted relationship with 95% confidence band; joint scatter and marginal distributions | One row per biological unit; Pearson, Spearman, and slope recorded as association rather than causation |
| Longitudinal response | time, value, group, biological-unit ID | Individual trajectories plus group mean/95% CI; within-unit change from baseline | Duplicate unit-time cells and cross-group unit reuse rejected; model-based inference requires a specified longitudinal model |
| Composition | sample, category, non-negative count/abundance; optional group | Sample-level 100% stack; normalized sample-by-category heatmap | Unique sample-category cells, positive sample totals, and sum-to-one dependence enforced; no naive component-wise tests |
| Tidy matrix | row, column, numeric value | Cluster-aware heatmap; signed magnitude dot matrix | Duplicate cells rejected; clustering method and final order recorded; dimension limits protect final-size legibility |

<table>
  <tr>
    <td width="50%"><img src="demo/Fig8_Relationship.png" alt="Group-aware relationship with confidence bands"></td>
    <td width="50%"><img src="demo/Fig9_Timecourse.png" alt="Longitudinal individual trajectories and uncertainty"></td>
  </tr>
  <tr>
    <td width="50%"><img src="demo/Fig10_Composition.png" alt="Sample-level composition"></td>
    <td width="50%"><img src="demo/Fig11_Matrix.png" alt="Clustered signed matrix"></td>
  </tr>
</table>

### Estimation-first two-group comparison

Raw observations, group estimates, and the bootstrap distribution of the treatment-minus-control effect: mean difference 2.48 a.u. (95% CI 1.95 to 3.00).

![Two-group estimation graphic](demo/workbench/estimation_graphic.png)

### Raincloud distribution view

Half-violin density, individual observations, interquartile range, and median. Density views require at least 10 observations per group.

![Raincloud figure](demo/workbench/raincloud.png)

### Paired estimation view

Subject-level trajectories with paired mean difference 1.14 normalized units (95% CI 0.978 to 1.31).

![Paired estimation graphic](demo/paired_workbench/paired_estimation.png)

### Multi-group effect intervals

Biological-unit observations, group means, and 95% CIs. Global inference remains separate from pairwise contrasts.

![Multi-group estimates with confidence intervals](demo/multigroup_workbench/group_estimate_forest.png)

Scientific basis: estimation-first reporting in [Ho et al., *Nature Methods* (2019)](https://www.nature.com/articles/s41592-019-0470-3), [raincloud plots](https://pmc.ncbi.nlm.nih.gov/articles/PMC6480976/), and the [Nature Research figure guide](https://research-figure-guide.nature.com/figures/preparing-figures-our-specifications/).

## Statistical design matching

| Design | Minimum declaration | Analysis | Validation |
| --- | --- | --- | --- |
| Control vs treatment using different biological samples | `condition`, `Response`, `sample_id`, `independent` | Treatment-minus-control mean difference and 95% CI; Welch two-sample test; Mann-Whitney sensitivity analysis. Example effect: 2.48 a.u. (1.95 to 3.00). | Repeated unit IDs are rejected instead of being counted as independent replication. |
| Before vs after on the same subjects | `condition`, `Response`, `subject_id`, `paired` | Within-subject mean difference and 95% CI; paired test; Wilcoxon sensitivity analysis. Example change: 1.14 normalized units (0.978 to 1.31). | Duplicate subject-condition rows are rejected; incomplete pairs are counted and reported. |
| Vehicle plus three independent dose groups | `condition`, `Response`, `sample_id`, `independent` | Group means and 95% CIs; global Welch ANOVA; Kruskal-Wallis sensitivity analysis. | Global inference reported separately from pairwise contrasts; multiplicity status explicit. |

Exact tests, effect direction, sample counts, exclusions, diagnostics, limitations, analysis scope, and multiplicity status are written to `analysis_plan.json`. Exploratory results show the effect and interval on the artwork while keeping *P* values in the analysis record; `--scope confirmatory --show-p-value` is available only after a pre-specified confirmatory family is declared.

### Reproducible examples

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

# Relationship: fitted confidence bands plus joint distributions
python skills/make-sci-data-figures/scripts/data_family_workbench.py relationship \
  skills/make-sci-data-figures/examples/synthetic_relationship.csv \
  --x exposure --y response --unit unit --group cohort \
  --outdir demo/data_families/relationship

# Longitudinal: individual trajectories plus change from baseline
python skills/make-sci-data-figures/scripts/data_family_workbench.py timecourse \
  skills/make-sci-data-figures/examples/synthetic_timecourse.csv \
  --time day --value signal --group group --unit unit \
  --outdir demo/data_families/timecourse

# Composition and matrix families
python skills/make-sci-data-figures/scripts/data_family_workbench.py composition \
  skills/make-sci-data-figures/examples/synthetic_composition.csv \
  --sample sample --category cell_type --value count --group group \
  --outdir demo/data_families/composition

python skills/make-sci-data-figures/scripts/data_family_workbench.py matrix \
  skills/make-sci-data-figures/examples/synthetic_matrix.csv \
  --row pathway --column condition --value z_score --cluster auto \
  --outdir demo/data_families/matrix
```

Palette-only render:

```bash
python skills/make-sci-data-figures/scripts/figure_workbench.py recolor \
  demo/workbench/figure_recipe.json --palette okabe_ito \
  --outdir demo/workbench_okabe_ito
```

![The same estimation graphic recolored without changing the analysis](demo/workbench_okabe_ito/estimation_graphic.png)

Validated visualization scope: continuous group comparisons, numeric relationships, longitudinal trajectories, compositions, and tidy matrices. Automated confirmatory inference remains deliberately narrower: common continuous-outcome independent and paired group comparisons. Survival, event-history, generalized mixed, causal, spatial, and high-dimensional differential models require a declared specialist workflow.

## Scientific image standardization

Demonstration asset: deterministic synthetic fluorescence imagery.

![Standardized image montage](demo/image_standardization/montage.png)

```bash
python skills/standardize-sci-images/scripts/make_example_data.py \
  --outdir demo/image_inputs

python skills/standardize-sci-images/scripts/standardize_images.py \
  demo/image_inputs/manifest.csv --scale-bar-um 20 \
  --outdir demo/image_standardization
```

Processing is non-destructive and batch-consistent. The audit records source hashes, crop boxes, display parameters, calibration, and scale-bar geometry. Scale bars require explicit calibration. Outputs include an unannotated raster, review preview, and SVG with editable scale-bar and text layers.

## Additional reproducible manuscript examples

Deterministic synthetic manuscript examples:

![Efficacy figure](demo/Fig1_Efficacy.png)

![Mechanism figure](demo/Fig2_Mechanism.png)

![Validation figure](demo/Fig3_Validation.png)

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
python skills/make-sci-data-figures/scripts/test_data_family_workbench.py
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

# Statistics and chart selection

## Decision order

1. State the scientific claim and outcome scale.
2. Identify the biological experimental unit.
3. Identify pairing, repeated measures, nesting, batches, censoring, and missingness.
4. Choose the estimand and uncertainty.
5. Choose a model/test that matches the design.
6. Choose a graphic that exposes the data and the estimand.

## Default candidate logic

- Two independent groups: estimation graphic, raw points + mean/95% CI, and box + raw points; add raincloud/violin only when each group has at least 10 observations.
- Two paired conditions: paired estimation graphic, trajectories, and a paired-difference summary. Exclude incomplete pairs only with a reported count.
- Three or more independent groups: horizontal group-estimate intervals, raw points, and box + raw points; use a global test before any pairwise claims.
- Numeric relationship: fitted line with 95% confidence band plus a joint-distribution view; retain Pearson, Spearman, slope, and sample count as association summaries.
- Longitudinal response: individual trajectories plus group mean/pointwise 95% CI, and a within-unit change-from-baseline candidate; reserve hypothesis tests for a declared longitudinal model.
- Composition: sample-level 100% stack plus normalized heatmap; respect sum-to-one dependence and do not run naive component-wise tests.
- Tidy matrix: heatmap plus signed-magnitude dot matrix; record any exploratory clustering method and final order.
- Small samples: show every observation. Do not imply a smooth density from a handful of values.
- Technical replicates: show or model the biological-unit summary as the primary inferential level.

## Interpretation limits

- Welch tests address mean differences under independent sampling; Mann–Whitney is a rank/distribution sensitivity analysis and is not automatically a median test.
- Paired tests require genuine matched units and complete matching for the compared contrast.
- Global tests do not identify which groups differ. Pairwise contrasts require a declared family and multiplicity control.
- A non-significant test is not evidence of equivalence. Equivalence requires margins and an appropriate design.
- A significant association is not causal evidence without a causal design and assumptions.
- Missingness, exclusions, outliers, transformations, and batch handling must be disclosed.

The bundled inferential workbench intentionally covers common continuous group comparisons. The companion family workbench adds validated descriptive relationship, longitudinal, composition, and matrix workflows. For survival, repeated-measures mixed models, generalized count/binary models, compositional inference, spatial dependence, high-dimensional differential omics, causal analysis, or complex survey designs, route the claim to a domain-appropriate workflow.

## Worked matching examples

| User situation | Minimal declaration | Primary output and statistics | Guardrail |
| --- | --- | --- | --- |
| Control versus treatment, different biological samples | `--unit sample_id --design independent` | Estimation graphic; treatment-minus-control mean difference and 95% CI; Welch two-sample test; Mann–Whitney sensitivity result | Reject repeated unit IDs instead of counting technical replicates as independent samples |
| Before versus after on the same subject | `--unit subject_id --design paired` | Paired estimation graphic; within-subject mean difference and 95% CI; paired test; Wilcoxon sensitivity result | Reject duplicate subject/condition rows; report incomplete pairs rather than silently filling them |
| Vehicle plus three dose groups, different samples | `--unit sample_id --design independent --order Vehicle,Low dose,Mid dose,High dose` | Horizontal group estimates with 95% CIs; global Welch ANOVA; Kruskal–Wallis sensitivity result | Make no pairwise claim and apply no hidden multiple-comparison procedure |

| Exposure and response measured once per sample | `relationship --x exposure --y response --unit sample_id` | Fitted relationship with confidence band; joint distributions; Pearson, Spearman, and linear slope in the analysis record | Reject repeated unit IDs; state association rather than causation |
| Repeated response over time | `timecourse --time day --value signal --group condition --unit subject_id` | Individual trajectories; group mean/pointwise CI; change from each unit's earliest value | Reject duplicate unit-time cells; make no mixed-model interaction claim |
| Cell-type abundance by sample | `composition --sample sample_id --category cell_type --value count` | Within-sample normalized stack and heatmap | Enforce non-negative values and positive totals; no independent component-wise tests |
| Pathway-by-condition score table | `matrix --row pathway --column condition --value z_score --cluster auto` | Signed heatmap and magnitude dot map; optional exploratory clustering | Reject duplicate cells; record order and refuse unreadable dimensions |

For inferential group-comparison examples, default to exploratory scope: retain exact test results in `analysis_plan.json`, show effect size and uncertainty on the artwork, and omit a decorative significance bracket. Use `--scope confirmatory --show-p-value` only when the user confirms a pre-specified confirmatory family. The other four families remain descriptive unless a specialist inferential model is declared.

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
- Small samples: show every observation. Do not imply a smooth density from a handful of values.
- Technical replicates: show or model the biological-unit summary as the primary inferential level.

## Interpretation limits

- Welch tests address mean differences under independent sampling; Mann–Whitney is a rank/distribution sensitivity analysis and is not automatically a median test.
- Paired tests require genuine matched units and complete matching for the compared contrast.
- Global tests do not identify which groups differ. Pairwise contrasts require a declared family and multiplicity control.
- A non-significant test is not evidence of equivalence. Equivalence requires margins and an appropriate design.
- A significant association is not causal evidence without a causal design and assumptions.
- Missingness, exclusions, outliers, transformations, and batch handling must be disclosed.

The bundled workbench intentionally covers common group comparisons. For survival, repeated-measures mixed models, count models, compositional data, high-dimensional omics, or complex survey designs, generate only a descriptive profile and route the analysis to a domain-appropriate workflow.

## Worked matching examples

| User situation | Minimal declaration | Primary output and statistics | Guardrail |
| --- | --- | --- | --- |
| Control versus treatment, different biological samples | `--unit sample_id --design independent` | Estimation graphic; treatment-minus-control mean difference and 95% CI; Welch two-sample test; Mann–Whitney sensitivity result | Reject repeated unit IDs instead of counting technical replicates as independent samples |
| Before versus after on the same subject | `--unit subject_id --design paired` | Paired estimation graphic; within-subject mean difference and 95% CI; paired test; Wilcoxon sensitivity result | Reject duplicate subject/condition rows; report incomplete pairs rather than silently filling them |
| Vehicle plus three dose groups, different samples | `--unit sample_id --design independent --order Vehicle,Low dose,Mid dose,High dose` | Horizontal group estimates with 95% CIs; global Welch ANOVA; Kruskal–Wallis sensitivity result | Make no pairwise claim and apply no hidden multiple-comparison procedure |

In all three examples, default to exploratory scope: retain exact test results in `analysis_plan.json`, show effect size and uncertainty on the artwork, and omit a decorative significance bracket. Use `--scope confirmatory --show-p-value` only when the user confirms a pre-specified confirmatory family.

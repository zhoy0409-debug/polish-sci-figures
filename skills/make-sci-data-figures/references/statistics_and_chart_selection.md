# Statistics and chart selection

## Decision order

1. State the scientific claim and outcome scale.
2. Identify the biological experimental unit.
3. Identify pairing, repeated measures, nesting, batches, censoring, and missingness.
4. Choose the estimand and uncertainty.
5. Choose a model/test that matches the design.
6. Choose a graphic that exposes the data and the estimand.

## Default candidate logic

- Two independent groups: raw points + mean/95% CI; box + raw points; violin only when each group has at least 10 observations.
- Two paired conditions: paired trajectories plus a paired-difference summary. Exclude incomplete pairs only with a reported count.
- Three or more independent groups: raw points + group estimates and box + raw points; use a global test before any pairwise claims.
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

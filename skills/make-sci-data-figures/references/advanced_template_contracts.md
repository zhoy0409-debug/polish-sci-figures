# Advanced template contracts

Use this reference after `template_router.py` selects an advanced family. A command is a validated display workflow, not permission to infer a model that the table does not contain.

| Family | Minimum tidy input | Automatic result | Required refusal or disclosure |
| --- | --- | --- | --- |
| Survival | one row/unit; non-negative time; event 0/1; group | Kaplan-Meier, censor marks, pointwise log-log Greenwood CI; unadjusted log-rank only for two groups | no invented hazard ratio; adjusted effects require a declared model and covariates; state censoring assumptions |
| Forest | term, estimate, lower, upper; optional domain | ordered estimate/interval candidates with explicit zero or one reference | interval order and positivity checked; estimates are supplied, not recomputed |
| Volcano | feature, effect, adjusted probability | thresholded effect-versus-adjusted-probability view and ranked hit view | adjusted probabilities must be in (0,1]; upstream differential model and multiplicity method remain declared responsibilities |
| Confusion | one prediction/unit; observed and predicted class | count and row-normalized matrices; accuracy and macro recall | do not call internal cases external validation; calibration and threshold selection are separate |
| Enrichment | term, effect/richness, adjusted probability, count; optional ontology | bubble and lollipop candidates for the most supported terms | universe, ontology version, redundancy, direction, and multiplicity are upstream inputs |
| Dose-response | positive dose, response, group; optional unit | four-parameter logistic fit on log10 dose; midpoint covariance interval; residual view | require at least four dose levels and six observations/group; call the midpoint IC₅₀/EC₅₀ only when endpoint and direction justify it; disclose replicate hierarchy |
| ROC/PR | one score/unit; binary outcome; positive label; optional cohort | ROC, PR, AUC, prevalence, deterministic unit-bootstrap interval | no threshold optimization, calibration, or external-validation claim is inferred; cohort must contain both classes |
| Feature rank | item, signed or unsigned metric; optional supplied interval/domain | lollipop and interval rank for top absolute values | importance, coefficient, association, and causal effect are not interchangeable |
| Embedding | supplied x/y coordinates and declared group | point cloud, descriptive covariance ellipse when supported, centroid view | never recompute or invent clusters; upstream transform, metric, seed, and preprocessing govern distances |
| Aligned series | common x and two numeric series; optional group | two original-unit panels plus a separately labelled z-score overlay | replace dual y-axes; standardized shapes are not effects and do not preserve units |
| Diverging | item and scientifically signed value; optional domain | horizontal bar and lollipop around zero | zero must have a defined reference; uncertainty and multiplicity cannot be inferred from a signed value alone |
| Cumulative | one numeric value/unit and group | ECDF and complementary ECDF | censoring, nesting, and repeated measurements require other methods |
| Swimmer | one interval/unit; start, end, status; optional event time/group | individual intervals and duration/event summary | status coding and censoring belong in the legend; swimmer graphics do not replace survival analysis |

## Common release contract

Every command must:

1. reject missing required columns and non-numeric numeric fields;
2. protect the biological experimental unit and family-specific uniqueness rules;
3. generate two complementary candidates at the same 4.8 × 3.6 inch canvas;
4. export PNG, live-text SVG, and PDF without tight cropping;
5. write input hashing/profile, analysis scope and limitations, and a deterministic recipe;
6. permit palette-only rerendering without changing filtering, statistics, order, labels, geometry, or canvas;
7. use Arial by default, no internal titles, no panel letters or serial numbers, and no text-data overlap;
8. pass final-size QA in `$polish-sci-figures` before publication.

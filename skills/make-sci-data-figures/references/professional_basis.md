# Professional basis and scope

These sources define the safeguards used by the skill. They are not sources of copied code.

- ARRIVE 2.0 defines the experimental unit and warns that conflating subsamples or repeated measurements with experimental units creates pseudoreplication and false positives: https://arriveguidelines.org/arrive-guidelines/study-design/1b/explanation
- ARRIVE 2.0 requires exact experimental-unit counts and explains that sample size is the number of experimental units, not the number of raw measurements: https://arriveguidelines.org/arrive-guidelines/sample-size/2a/explanation
- The ASA statement explains that *P* values do not measure effect size, importance, or the probability that a hypothesis is true, and that inference requires full reporting: https://www.amstat.org/asa/files/pdfs/p-valuestatement.pdf
- SAMPL is the EQUATOR-listed biomedical statistical reporting guideline: https://www.equator-network.org/reporting-guidelines/sampl/
- The EQIPD framework recommends pre-specified statistical plans, effect sizes with uncertainty, multiplicity control, and often omitting *P* values in exploratory analyses: https://www.nature.com/articles/s41592-022-01615-y
- Weissgerber et al. show why small continuous datasets should expose individual observations and why paired data should visibly show pairing: https://doi.org/10.1371/journal.pbio.1002128
- Nature's figure guide requires labelled axes/units, accessible colors, standard fonts, legible editable text, and no overlaps: https://research-figure-guide.nature.com/figures/preparing-figures-our-specifications/
- SciPy's official API documents the numerical definitions used for Welch's independent-sample test and related routines: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ttest_ind.html
- Kaplan and Meier define the product-limit estimator for incompletely observed survival data: https://doi.org/10.1080/01621459.1958.10501452
- The NCBI Assay Guidance Manual describes the four-parameter logistic model and warns that fixed asymptotes impose strong assumptions; the observed dose range must support the midpoint: https://www.ncbi.nlm.nih.gov/books/NBK92013/
- TRIPOD defines external validation as applying the original model to new individuals and comparing predictions with observed outcomes; a renamed cohort is not automatically external validation: https://pmc.ncbi.nlm.nih.gov/articles/PMC4297220/
- Saito and Rehmsmeier show why precision-recall adds important information for imbalanced binary outcomes: https://pmc.ncbi.nlm.nih.gov/articles/PMC4349800/
- Benjamini and Hochberg define false-discovery-rate control for multiple testing; a volcano or enrichment display must consume the declared adjusted result rather than silently substitute raw probabilities: https://doi.org/10.1111/j.2517-6161.1995.tb02031.x

## Deliberate boundary

Automated confirmatory inference is limited to a declared continuous outcome in simple independent groups or exactly two paired conditions. The advanced workbench may compute transparent descriptive quantities from fully declared inputs: Kaplan-Meier estimates with pointwise intervals and an unadjusted two-group log-rank result, a four-parameter logistic dose-response midpoint, empirical ROC/PR curves with unit bootstrap, confusion summaries, and empirical cumulative distributions. It does not auto-fit adjusted survival, generalized mixed, causal, spatial, high-dimensional differential, enrichment, or predictive-development models. For those designs it validates and displays supplied results while recording the upstream method as an unresolved responsibility.

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

## Deliberate boundary

The bundled inference engine is limited to a declared continuous outcome in simple independent groups or exactly two paired conditions. It does not auto-analyze binary, count, proportion, censored, repeated, nested, clustered, compositional, high-dimensional, predictive-model, or causal-inference problems. Those designs require a domain model and cannot be made safe by adding more automatic test names.

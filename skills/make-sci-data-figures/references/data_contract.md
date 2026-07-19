# Minimal data contract

Preferred input is tidy/long data: one observation per row and one variable per column.

Required for a basic group comparison:

| Field | Meaning | Example |
| --- | --- | --- |
| outcome | Continuous numeric response | `viability_pct` |
| group | Experimental condition | `Control`, `Treatment` |
| biological unit ID | Independently assignable unit | `animal_01`, `donor_04` |

Add these when applicable:

| Field | When required |
| --- | --- |
| subject ID | Same biological-unit ID used across paired conditions |
| time | Longitudinal data |
| batch | Acquisition or processing batches |
| biological unit | Several rows can come from one animal, donor, culture, or specimen |
| technical replicate | Repeated measurement of the same biological material |

Rules:

- Keep raw values. Do not pre-round, convert missing values to zero, or paste means in place of observations.
- Use unique, stable subject IDs. A paired design must contain the same subject in the compared groups.
- Put units in metadata or a column name, not inside numeric cells.
- Keep group labels and order authoritative; do not alphabetically reorder a known control/treatment sequence.
- Technical replicate rows require a declared aggregation/modeling rule before inferential statistics.
- Binary, count, proportion, survival, compositional, repeated, nested, clustered, and high-dimensional outcomes require a domain-specific analysis; this compact workbench profiles but does not infer from them.
- Wide data can be reshaped, but the resulting long table and transformation record must be saved.

The profiler reports column types, missingness, group counts, duplicate rows, and paired completeness. It cannot infer whether a row is a biological or technical replicate; ask the user when that distinction is not explicit.

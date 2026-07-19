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

Additional validated tidy contracts:

| Family | One row represents | Required uniqueness |
| --- | --- | --- |
| Relationship | One biological unit with numeric x and y | biological-unit ID is unique |
| Longitudinal | One biological unit at one time value | biological-unit ID + time is unique; each unit belongs to one group |
| Composition | One category within one sample | sample + category is unique; values are non-negative and each sample total is positive |
| Matrix | One row-feature by column-feature cell | row + column is unique |

Rules:

- Keep raw values. Do not pre-round, convert missing values to zero, or paste means in place of observations.
- Use unique, stable subject IDs. A paired design must contain the same subject in the compared groups.
- Put units in metadata or a column name, not inside numeric cells.
- Keep group labels and order authoritative; do not alphabetically reorder a known control/treatment sequence.
- Technical replicate rows require a declared aggregation/modeling rule before inferential statistics.
- Longitudinal and compositional structures can be validated and visualized descriptively by `data_family_workbench.py`; their inferential claims still require a declared domain-specific model.
- Binary, count, survival, nested, clustered, spatial, and high-dimensional differential outcomes require a domain-specific analysis; do not infer from a generic display.
- Wide data can be reshaped, but the resulting long table and transformation record must be saved.

The group-comparison profiler reports column types, missingness, group counts, duplicate rows, and paired completeness. Family generators add unit/cell uniqueness, positivity, normalization, clustering, and display-density checks as relevant. No script can infer whether a row is a biological or technical replicate; ask the user when that distinction is not explicit.

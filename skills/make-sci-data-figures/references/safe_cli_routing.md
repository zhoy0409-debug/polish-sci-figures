# Safe CLI routing

Use the root `sci_figures.py` entry point to inspect a table before selecting a workbench.

- `inspect` profiles names, dtypes, missingness, cardinality, and repetition. Candidate roles are suggestions with evidence and confidence, never experimental-design declarations.
- `route` may emit `SUGGESTION` or `NEEDS_CONFIRMATION`. It emits a runnable command only after one structure and every required column/design declaration are unambiguous.
- Group comparison never defaults to independent design. Require the user to declare independent, paired, repeated, nested, or technical-replicate structure.
- `CONFIRMED` means the command contract is complete, every declared column exists, roles are distinct, low-cost type/value checks pass, and independent/paired structure is not contradicted by unit/group repetition. It does not mean the downstream analysis or final figure has passed its full validation.
- Use `--json` for stable machine-readable output. A blocking failure exits 2; warnings and manual-review findings exit 0.

Supported route contracts are group comparison, relationship, timecourse, composition, matrix, survival, dose-response, ROC/PR, and supplied specialist estimates. Routing checks and suggests; it does not execute inferred statistics.

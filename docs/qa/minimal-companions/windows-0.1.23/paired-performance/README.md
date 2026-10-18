# Matched actual installed 0.1.22 / 0.1.23 targeted capture

Both finalized owned-headless Chrome captures passed their functional and source checks. These are fresh `performance22-r2` and `performance23-r1`, using the actual installed default child-profile service at the same loopback origin before and after real manual Setup. They are separate from the earlier explicit-data-dir candidate capture; those samples are not pooled.

The earlier `performance22-r1` produced a valid 46-operation benchmark capture but failed overall at its final protected-control guard when the original native window ended. The human confirmed closing that window. Root then explicitly reconciled the same owned22 service, full program/settings/health/registration and the new zero-foreign-native/one-browser baseline before this fresh pair. That failed attempt remains private with all original hashes in the public inventory and is excluded from matched numbers. This does not claim the original old window remained alive after the human closed it.

## Observed numbers

| Operation | Metric | 0.1.22 P50 / P95 (ms) | 0.1.23 P50 / P95 (ms) |
| --- | --- | ---: | ---: |
| select-text | Input → second rAF | 105.4 / 172.9 | 96.0 / 115.2 |
| select-text | Commit → second rAF | 45.1 / 81.0 | 40.0 / 45.9 |
| text-colour | Input → second rAF | 103.2 / 154.6 | 93.4 / 135.1 |
| text-colour | Commit → second rAF | 102.7 / 153.8 | 92.9 / 134.4 |

The [comparison](comparison.json) contains all observed P50/P95 values and arithmetic differences. Capture success does not itself establish improvement or no regression. Sequential runs on one device can reflect uncontrolled background user activity, scheduling and run order; no statistical significance or cross-machine inference is claimed.

## Matched procedure and integrity

Each version uses the same synthetic 5000-element SVG, 1440×900 CSS viewport, DPR 1, fit zoom, Chrome version, two operations, 250 ms minimum settle, three warmups and twenty measured repetitions per operation. Both original raw reports retain **all 46 operations per version**, including six warmups and every recorded input/frame/long-task/event array. Warmups remain in raw data and are excluded from measured quantiles; no outlier is removed. The nearest-rank quantiles are independently recalculated during curation. Original geometry arrays are retained and their equality is reported explicitly.

Text recolour uses the real quick-colour control followed by **Tab**. The reported selection commit is pointer-up and the colour commit is change/blur. Callback timing is input/commit to rAF opportunity, **not Enter latency, optical display latency or continuous FPS**. Native colour-picker latency is outside this procedure.

Each enclosing wrapper verified actual installed native identity, all four AppId views, owned port/default-profile capability, the explicitly bound current foreign native set and protected browser identity, complete installed program file hashes, unchanged complete settings bytes and the production served-HTML injection before and after. No arbitrary missing process was waived: the fresh baseline explicitly declares zero foreign native processes, and a changed set fails. The served HTML was not fulfilled and no native bridge was injected. This performance wrapper did not download/install; manual Setup acceptance is separate. Both native capability checks require `inAppInstall=true`.

## Evidence and scope

The per-version `performance-v2.json` and `summary-v2.json` preserve original bytes, source hashes and all quantile/sample arrays. `run.safe-summary.json` is explicitly derived: full private process tuples, absolute paths, private HTML/token and logs stay local, with original raw hashes retained. Both original canvas PNGs were visually reviewed by root after their actual runs. [The inventory](inventory.json) records exact-copy status and SHA256 values.

This covers selected synthetic-pressure selection and recolour actions, not every editor/scientific workflow, native IME, real patient data, GPU/OS utilization or novice usability. An observed number alone does not establish scientific validity. Earlier controlled updater demos and isolated-profile measurements are not substitutes for this pair.

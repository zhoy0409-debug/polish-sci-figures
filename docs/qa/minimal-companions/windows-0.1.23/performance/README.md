# Installed 0.1.23 targeted 5000-element capture

This independent run used actual Chrome and the installed loopback service after the functional suites ended. The [exact original report](performance-v2.json) retains **all 46 operations**: 20 measured samples and 3 warmups for each of two operations. [The original summary](summary-v2.json) retains source asset hashes, every measured statistic and the raw report hash. The [verified canvas](verified-5000.png) is an explicitly synthetic 5000-element pressure fixture.

## Observed results

| Operation | Input → second rAF P95 | Measured samples |
| --- | ---: | ---: |
| Text selection | 104.1 ms | 20 |
| Text recolour | 94.2 ms | 20 |

All 46 operations passed their actual selection/paint assertions. The original source SVG/table/analysis fingerprint and served HTML stayed unchanged, and no remote requests or browser errors occurred. The [before](identity-before.json) and [after](identity-after.json) read-only guards verified the exact installed process/package, registration and protected original process.

Colour uses the real quick-colour input followed by **Tab**. Its commit/change/blur timing is retained; this is not an Enter-key latency test. Timings are capture-phase input events to rAF callback opportunities, **not optical paint latency or continuous FPS**. Native colour-picker latency is excluded. Warmups and outliers were retained; the six warmups are excluded only from the measured quantiles.

This is the isolated installed candidate launched with an explicit data directory. It is not the later default-profile 0.1.22/0.1.23 matched comparison. No improvement or old-baseline regression claim is inferred from this single run. It does not establish all-workflow responsiveness, biological/scientific validity, OS/GPU utilization or performance on other machines.

## Original file SHA256

The five copied files below preserve their original bytes; no sample arrays were trimmed or sanitized. The JSON was reviewed for credentials, private paths and embedded project/data payloads.

```text
af31b2d9e684004213e5c62ae99acb0983f670f004a708b15339d06e56707051  performance-v2.json
5c51bb05ca4c45263125722ecba4afe2aca1f233fe2a8fc6c3a62ea2e196f49a  summary-v2.json
e5f0033a0b0a58540445f7615dccf45e600afca34d8d68ef47040fb40ba5ea06  verified-5000.png
6387c7acf3cd025d2e1497ad861f5b010beab0091c123a4f8a07b6e06eacc23d  identity-before.json
ddf788c86318cbf81006aa58a1f1138e54ea3c2e26346aa36f22ae339632e121  identity-after.json
```

# 5000-element performance evidence

Root reviewed this evidence set and its privacy scope. It records the measured 5000-element cases; it does not establish release or whole-product acceptance. All six original benchmark batches are retained: the first25-static/26-installed pair and four same-origin static25–26–26–25 batches. Each original raw file retains all46 actions,including6warmup and40measured actions. Original summary files preserve all P50/P95,callback,commit,wall,frame and long-task metrics without rounding or filtering.

| Batch | Version/mode | Selection P50/P95 ms | Colour P50/P95 ms | Selection long tasks count/total/max ms | Colour long tasks count/total/max ms |
|---|---|---|---|---|---|
| first pair25 |25 static|63.8/67.8|60.2/72.7|0/0/0|2/123/73|
| first pair26 |26 installed|66.7/84.6|55.7/73.9|5/278/62|4/209/55|
| A1 |25 static|68.9/85.8|65.7/78.7|4/245/83|5/287/75|
| B1 |26 static|73.5/132.2|55.0/81.9|9/633/106|4/279/102|
| B2 |26 static|59.0/75.8|50.3/69.3|2/101/51|2/102/52|
| A2 |25 static|59.3/79.1|53.8/69.6|2/105/54|2/106/56|

Values in this readable table are rounded only for display; JSONs retain original precision. Nearest-rank P95 at20 samples is the second-largest. The first-pair selection-tail increase remains an observed result. B1 was slow,but the identical26 source inB2 did not repeat it. These mixed batches neither establish stable product-code regression nor prove no regression or general acceleration.

The CPU files include both versions’ complete46 action windows and all sampled self/inclusive frame weights inside those windows. Raw source URLs were replaced with reviewed source-document identifiers; exact original profile SHA values and source line/column spans are retained. Inclusive frames overlap and must not be added. The new26 refresh’s20-selection inclusive total was4.975ms (sampled arithmetic mean0.24875ms/action; maximum observed sampled window0.561ms). Its translation3.325ms and selection/image scan1.650ms overlap with that total. This does not identify a material new hotspot explaining the earlier16.8ms P95 difference. Both versions retain existing selection-property/heatmap/source-clone work. No application code was changed after these diagnoses.

These are rAF callback opportunities,not rendered FPS,physical photon/pixel latency or scientific/statistical significance. CPU profiling adds overhead; its action timestamps must not be pooled with normal-latency results. Browser155/Node24 and exact per-batch architecture/core count,viewport,geometry,source hashes and protocol identity are recorded. OS build was not recorded by the original benchmark and is not inferred.

Only a public generated5000-vector fixture appears here. No private image suite,photograph,experimental table,project payload,HTML,service credential,local path or original CPU profile is bundled. Raw profile files remain local with cryptographic provenance. Native update,scientific-computation and IME acceptance are outside this evidence set. `manifest.json` hashes every other proposed public file; it excludes itself to avoid a circular hash.

---
title: Windows constrained-resource benchmark
---

# Windows constrained-resource benchmark

[中文版](windows-resource-benchmark.md)

Test date: 2026-10-12. These measurements compare the released Windows executable with the modified source on the same host. They do not certify performance on a physical low-end computer or measure browser frame rates and interaction latency.

## Environment and limits

- Host: Intel Core Ultra 7 155H, 22 logical CPUs, 31.47 GiB of physical memory.
- Baseline: an independently extracted copy of the released `polish-sci-figures-Studio-0.1.0-Portable-x64.zip`; archive SHA-256: `f8381d0abd6562f06f7572a801bd0003e8e610369fc743f3770efef6c5d6de06`.
- Executable SHA-256: `fe24eeaaaa7ceebfc7deb5a46e1a563fe89d3aacc7fa0d067d3e504ccb15f6a8`.
- Constrained profile: a Windows Job Object restricts the test process and its children to logical CPUs 0 and 1 and limits aggregate committed memory to 2 GiB. Machine-wide settings and existing editor processes remain unchanged.
- Each profile starts a new process with new application-data and font-cache directories. The operating-system disk cache is retained, so these are first-run application measurements, not strictly cold disk-cache starts.
- Working sets are sampled every 50 ms. Peak committed memory comes from the Windows Job Object high-water counter. The browser and measurement client are outside the job and are excluded from these memory figures.

## Work performed

Each profile processes the same 20 representative templates: raincloud and faceted comparisons, heatmaps, ROC, PCA, volcano and forest plots, dose response, time courses, UpSet, flow diagrams, survival plots, GSEA, SHAP, STL, supplied path results, Manhattan plots, distributions and interaction surfaces. All inputs are explicitly identified synthetic template data.

Every template undergoes real HTTP rendering, regeneration after a synthetic-data edit, and checks of its input hash and SVG contents. The 10 templates supporting exact-size reflow also redraw at 480 × 320 pt. The remaining templates explicitly reject exact-size reflow and retain their existing size variants and aspect-preserving display behavior; they are not counted as successful reflow tests. Each profile also computes Welch comparisons with Holm adjustment from the same observations.

| Measurement | Released EXE, unrestricted | Released EXE, 2 CPUs / 2 GiB | Modified source, 2 CPUs / 2 GiB |
| --- | ---: | ---: | ---: |
| Service and catalogue ready / s | 0.864 | 0.600 | 0.573 |
| Median template-render time / s | 1.487 | 1.244 | 1.563 |
| Maximum template-render time / s | 6.291 | 4.633 | 4.614 |
| Median data-replacement time / s | 1.365 | 1.227 | 1.501 |
| Median supported exact-size reflow time / s | 0.229 | 0.179 | 0.235 |
| Peak job committed memory / MiB | 1652.02 | 1649.58 | 299.44 |
| Peak sampled working set / MiB | 297.62 | 284.11 | 284.14 |

This was one sequential measurement pass with fluctuating system load. It does not establish a speed improvement. The demonstrated benefit is an approximately **81.85% reduction in peak committed memory** in the constrained profile, while the physical working set remains essentially unchanged.

The numerical libraries initialized threads and buffers for many CPUs. Before importing these libraries, the modified launcher now defaults `OPENBLAS_NUM_THREADS`, `MKL_NUM_THREADS`, `OMP_NUM_THREADS` and `NUMEXPR_NUM_THREADS` to `1` within the application process. Explicit user environment settings are preserved. A separate environment-variable comparison using the same released executable reproduced the memory reduction.

All three profiles passed 20 initial renders, 20 data replacements and 10 supported exact-size reflows. All 40 original and edited SVG artwork digests matched across profiles, as did the input tables and complete Welch/Holm analysis records. The digest normalizes randomly generated SVG identifiers while retaining graphical paths, attributes and displayed text; this checks more than successful HTTP responses.

## Verification of the frozen 0.1.1 application

The fully rebuilt `polish-sci-figures-Studio-0.1.1-Portable-x64.zip` passed a separate constrained-resource check. Its ZIP SHA-256 is `5a8f60b04dea5318de5637e0c275dad7f2f942efa745e4924a758ee51f1eb410`; the executable SHA-256 is `33c62e5f2bef8bc26cb344b309a1be8b89c9c489bb28b2a6f22092fdd7185815`.

The check used a fresh application directory, dedicated port 19831 and the same two-CPU, 2-GiB Job Object. No `--math-threads` override was supplied, and all four numerical-thread variables were absent from the inherited environment. The check therefore exercised the frozen application's own defaults.

| Template | Generate / s | Replace data / s | Reflow at 480 × 320 pt / s |
| --- | ---: | ---: | ---: |
| Raincloud | 4.849 | 2.433 | 0.107 |
| Clustered heatmap | 3.198 | 3.016 | 0.419 |
| PCA with loadings and marginal distributions | 1.823 | 1.733 | 0.244 |

The service and catalogue were ready in 0.773 s. Peak job commit was **232.95 MiB**, and peak sampled working set was 212.21 MiB. All three generations, three data replacements and three precise reflows passed. The six original/edited artwork digests and input-data hashes matched version 0.1.0. The complete Welch/Holm analysis record, analysis configuration and data hash also matched; only the response's elapsed-time metadata were excluded from that comparison.

This three-template check confirms that the memory fix is present in the frozen application. Its scope differs from the 20-template benchmark above, so the two peaks are not used to calculate another improvement percentage, and the single-run timings do not establish a speed increase. Records are in `.cache/resource-benchmark-frozen-0.1.1/summary.json` and `comparison.json` in the same directory.

## Reproduce the checks

Run on Windows with the project test dependencies installed in the selected Python environment. Each output directory must be new to avoid reusing application caches:

```powershell
python desktop/benchmark_resources_windows.py --archive dist/desktop/polish-sci-figures-Studio-0.1.0-Portable-x64.zip --outdir .cache/resource-release-new --mode both
python desktop/benchmark_resources_windows.py --source --outdir .cache/resource-source-new --mode limited
python desktop/benchmark_resources_windows.py --archive dist/desktop/polish-sci-figures-Studio-0.1.1-Portable-x64.zip --outdir .cache/resource-frozen-new --mode limited --cases compare_raincloud clustered_matrix pca_loadings --port 19831
python desktop/test_resource_job_windows.py -v
python desktop/test_figure_studio_app.py -v
```

The optional `--math-threads 1` changes numerical-thread settings only for the test subprocess. Use `--cases` to select representative templates and `--port` to give the test application a dedicated localhost port. The script passes `--no-open` to prevent automatic browser opening, launches the application window hidden, and closes its dedicated Job Object at completion. The resource-control regression checks actual two-CPU affinity, parent/child job membership and cleanup. All eight launcher regressions passed.

The original 20-template records are `.cache/resource-benchmark-final-release/summary.json`, `.cache/resource-benchmark-final-source/summary.json` and `.cache/resource-benchmark-comparison.json`. Reports contain synthetic-input identities and measurements; test directories also retain the isolated application copies and caches. No real user data were used. The launcher change has been incorporated into the complete 0.1.1 executable rebuild and verified as described above.

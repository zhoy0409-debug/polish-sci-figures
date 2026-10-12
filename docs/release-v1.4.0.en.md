# polish-sci-figures v1.4.0

[中文](release-v1.4.0.md) | [English](release-v1.4.0.en.md)

This release brings the expanded three-skill suite and **Figure Studio 0.1.0**, its first Windows desktop editor, into one official product. The skills keep their AI/CLI workflow; the desktop application packages the same local rendering and comparison engine for users who prefer direct editing.

## Choose a download

All assets belong to the [official v1.4.0 release](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.0).

| Asset | Use |
| --- | --- |
| `polish-sci-figures-Studio-0.1.0-Setup-x64.exe` | Windows 10/11 x64 installer; no separate Python, Codex or account |
| `polish-sci-figures-Studio-0.1.0-Portable-x64.zip` | The same editor in an extract-and-run folder |
| `polish-sci-figures-v1.4.0-skill.zip` | Self-contained skill upload for compatible AI hosts |
| `sci-figure-suite-v1.4.0.zip` | Complete source CLI and the three focused skill folders |

See the [Chinese](../desktop/QUICKSTART.zh-CN.md) or [English](../desktop/QUICKSTART.en.md) desktop guide, or [AI platform installation](platform-installation.en.md).

## Graphical and analytical additions

- **218 editable starters:** 191 table-driven gallery layouts, 15 empirical ROC/PR views and 12 supplied-result ROC layouts. Bilingual input contracts distinguish observations from fitted, resampled or model-explanation results.
- **Actual source redraw:** current-data candidates, data replacement and multiple physical canvases use the same renderers. Supported templates expose true axis limits, signed first-group spacing and data-coordinate reference lines.
- **Local comparison analysis:** explicit independent/paired design and experimental-unit roles; Welch, Mann–Whitney, paired *t* or Wilcoxon comparisons; one Holm family across requested pairs and facets. Existing results can be connected with declared correction status.
- **Editable presentation:** multi-selection, alignment, groups/locks, keyboard positioning, text and shapes, inline character formatting, panel labels and calibrated scale bars. Supported heatmaps offer numeric cell labels and normalized continuous palettes.
- **Flexible assembly:** spanning slots, added rows/columns, spacing controls, multiple projects and transferable appearance presets. A supported facet comparison can split into consecutive independent panels while retaining the original comparison family.
- **Reversible updates:** undo/redo, named versions, browser autosaves and portable project JSON. Current-data statistics recompute after valid changes; linked external or split-facet results become stale when their chart data changes.
- **Local desktop delivery:** bundled runtime, stable loopback origin, single-instance launcher, bilingual guides and a user-clicked official project link. SVG and PNG export remain available, with PNG defaulting to 600 dpi.

The original microscopy standardization, raw-data workbenches, fixed-canvas checks, scientific text checks and source-portability checks remain part of the suite. Result templates do not fit an unspecified upstream model, and the editor does not rewrite returned changes into Python/R source automatically.

## Verification and upgrade notes

[Validation records](figure-studio-validation.md) distinguish script checks, rendered contact sheets and actual browser cases. The catalogue's contracts and redraw tests are broader than the manual browser review; not every combination of data, label length and output size has been visually approved. The [desktop build guide](../desktop/BUILD.md) describes checks on the actual frozen application, beyond source tests.

Back up existing projects as JSON before upgrading. Application settings are under `%LOCALAPPDATA%\Figure Studio`; editable autosaves and the project collection are in browser storage for the saved local origin. Clearing browser site data can remove them. Installation identity and the user-data directory remain stable despite the official shortcut's `polish-sci-figures Studio` branding.

The project remains [MIT-licensed](../LICENSE); packaged dependencies retain their own notices. Official branding is a maintained-source identifier, not DRM. SHA-256 checksums compare file contents and are not a publisher signature. The current Windows packaging process does not code-sign its output.

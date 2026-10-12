# polish-sci-figures v1.4.1

[中文](release-v1.4.1.md) | [English](release-v1.4.1.en.md)

Suite v1.4.1 and **Figure Studio 0.1.1** fix Claude skill-upload compatibility and improve chart discovery, preview loading, and recovery of the local service. The existing 218 editable templates and three-skill source workflow remain available. See the [v1.4.0 notes](release-v1.4.0.en.md) for the previous release's capabilities and verification record.

## Choose a download

All assets are distributed through the [official v1.4.1 release](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.1).

| Download | Use |
| --- | --- |
| [polish-sci-figures-Studio-0.1.1-Setup-x64.exe](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/polish-sci-figures-Studio-0.1.1-Setup-x64.exe) | Windows 10/11 x64 installer; no separate Python, Codex, or account |
| [polish-sci-figures-Studio-0.1.1-Portable-x64.zip](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/polish-sci-figures-Studio-0.1.1-Portable-x64.zip) | Portable edition; extract everything, run `Figure Studio.exe`, and retain `_internal` |
| [polish-sci-figures-v1.4.1-skill.zip](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/polish-sci-figures-v1.4.1-skill.zip) | Corrected self-contained skill upload |
| [sci-figure-suite-v1.4.1.zip](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/sci-figure-suite-v1.4.1.zip) | Complete source CLI and three skill directories |
| [SHA256SUMS.txt](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.1/SHA256SUMS.txt) | SHA-256 checksums for the four release files above |

See the desktop [English quick start](../desktop/QUICKSTART.en.md) or the [AI platform installation guide](platform-installation.en.md).

## Fixes and improvements

- **Claude upload compatibility.** The v1.4.0 upload package contained four `SKILL.md` files and was rejected by Claude during an actual upload. The v1.4.1 ZIP contains exactly one entry `SKILL.md`; its three companion workflows are included as `WORKFLOW.md` files, with complete plotting code, data contracts, and updated internal links. Use the new upload package. The three-skill source archive retains each skill's own entry point.
- **The editor opens the selected chart.** A single-panel editor defaults to one column. The CLI accepts `studio --view` to open the reviewed candidate while retaining the other candidates and source data; an unknown view produces a clear error instead of silently selecting another chart.
- **Live group spacing.** Open Properties → Group spacing to drag the slider or enter a percentage. For supported categorical plots, observations, estimates, intervals, tick labels, and generated comparison annotations move together; data values and glyph sizes stay unchanged. A gesture can be undone in one step. The spacing preference is retained when replacing data, with positions recalculated from the new chart. Existing bar charts retain their bar-layout control; numeric axes and ambiguous group geometry do not use this control.
- **Library-wide search.** Search across categories to find charts without browsing every category individually. Input requirements and example-data labels remain visible.
- **On-demand settings previews.** Size, candidate-chart, and palette previews are generated only when you view the corresponding settings page, reducing repeated rendering during ordinary editing. Chart content, input requirements, and calculations remain unchanged.
- **Axis protection during palette changes.** Fixed series colors overriding axis text and axis lines when a palette changes. Axis colors and styling are retained; this fix has been checked in the actual interface.
- **Connection recovery.** When the local service becomes unavailable, the editor displays connection status and retains the project and data drafts. Reconnect and continue without clearing the project or discarding uncommitted data.
- **Numerical-library thread defaults.** Unless explicitly configured, the desktop launcher sets OpenBLAS, MKL, OpenMP, and NumExpr to one thread to limit additional resource overhead from multithreading. Existing explicit environment settings are preserved. This default alone is not a performance guarantee for low-end hardware.
- **Complete bilingual entry points.** The README, platform installation guide, release notes, and desktop quick start offer Chinese and English versions. In Claude, first click `+` beside the message box → Skills → polish-sci-figures, then ask in ordinary language, such as “Help me turn this table into a figure for a paper.” An ordinary request does not guarantee automatic invocation of an installed skill; study-design questions still follow the actual data.

The patch does not change statistical methods or evidence requirements. Observation data still require genuine experimental units and an explicit design, comparisons use the declared correction family, and result templates require the corresponding analysis outputs. Changed data must not retain outdated external statistical results.

## Verification status for this patch

The corrected skill ZIP has been successfully uploaded and recognized in the actual Claude interface. After explicit skill selection, Sonnet 5.5 Medium received 16 synthetic rows and an ordinary Chinese request, confirmed independent experimental units and mg/L units, and actually ran `doctor`, `workflow`, and `candidate`. It generated PNG/PDF/SVG, a candidate ZIP, and HTML; the PNG passed visual review. An ordinary-language correction produced an HTML editor showing the selected estimation chart in one column, which passed visual review in English. The underlying candidate-selection and single-panel layout fixes also passed 10 generator/CLI checks. The Claude download path remains unverified, so this is not described as a first-pass success of the entire delivery workflow. WorkBuddy is not installed on the current test machine and has not been tested within the host.

Resource tests have completed. On the same Windows host, with a Job Object limiting execution to 2 CPUs / 2 GiB, peak job committed memory was **1649.58 MiB for the released 0.1.0 EXE and 299.44 MiB for the modified source, a reduction of 81.85%**. Sampled physical working sets were approximately 284.11 MiB and 284.14 MiB, essentially unchanged. This does not mean an 82% reduction in total RAM or faster execution. Generation and data replacement passed for 20 representative templates, along with precise reflow for the 10 supported templates; graphical digests and statistical records matched. See the [test environment, methods, and full results](windows-resource-benchmark.en.md).

The new 0.1.1 installer has passed actual installation, byte-for-byte comparison of installed and packaged files, and standalone EXE checks with PATH/PYTHONHOME isolated. Checks cover Tk resources, the editor page, request authorization, statistical analysis, rendering, and physical-size reflow. Reinstallation retained projects and settings; uninstallation retained user projects. The newly frozen EXE also passed generation, data replacement, and precise reflow for raincloud, clustered heatmap, and PCA templates under 2 CPUs / 2 GiB. Peak commit was 232.95 MiB and peak sampled working set was 212.21 MiB; all six original/edited artwork digests and the complete Welch/Holm record matched the previous version. This three-template check has a different scope from the 20-template test above and is not used to calculate another reduction percentage. See the [validation record](figure-studio-validation.md) for details.

## Upgrade and licensing

Save a project JSON backup and quit the launcher before installing desktop version 0.1.1. Extract the entire portable edition rather than replacing only its EXE. The application settings directory, `%LOCALAPPDATA%\Figure Studio`, and installation identity remain unchanged. Browser autosaves are stored separately in site data for the original local address and can be removed by clearing browser data.

AI users should replace the old skill with the v1.4.1 upload package. The fix does not require changes to research data or alter the source skills' roles. This repository remains the official maintenance and download channel. The project remains [MIT-licensed](../LICENSE), and dependencies retain their own licenses. Windows artifacts remain unsigned; SHA-256 checksums are neither publisher signatures nor copy protection.

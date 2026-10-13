---
name: polish-sci-figures
description: Create, refine and assemble scientific figures from data, images or editable artwork; check image reuse, deliver publication-ready outputs and an optional Figure Studio editing page.
---

# polish-sci-figures

Use the bundled suite for scientific data charts, calibrated images, figure refinement and multi-panel composition. It needs host file access and Python execution, without a Codex account or a particular computer.

## Start from the user's data

Accept ordinary requests such as “把这个表画成合适的图” or “Make a suitable figure from this table.” Inspect/profile the table once, then produce 2–3 suitable candidates with previews rendered from the actual data when the data support them. Explain briefly what each reveals and identify the recommended starting point. Do not require the user to supply commands, template IDs or statistical terminology.

When scientific design is genuinely missing, ask only 1–2 concrete questions, such as whether rows are different experimental objects or repeated observations of the same object. Do not invent experimental-unit IDs, units of measurement, pairing or results. Preserve valid existing analyses. Batch local rendering where practical; use the editor for ordinary font, colour and position changes instead of repeatedly recomputing analyses or calling an AI model.

## Check the runtime

Paths below are relative to this SKILL.md. Keep the complete `suite/` directory together. Select an existing Python runtime yourself: prefer the current project's `.venv/Scripts/python.exe` (Windows) or `.venv/bin/python`, then the host's dependency-tool runtime, then registered Python launchers or `python3`. Check `sys.executable` and `sys.version` before running suite code; bare `python` can resolve to Python 2, and a host-bundled Python can lack SciPy. Use Python 3.10–3.12 and actually import `numpy`, `pandas`, `scipy`, `matplotlib`, `openpyxl` and `PIL`. Try the next existing interpreter if a check fails instead of asking a novice to discover paths. Reuse the successful executable, with `-X utf8` on Windows; `python` below means that executable. Run the doctor before executing a workflow:

```bash
python suite/sci_figures.py doctor --font "DejaVu Sans" --json
```

If no existing interpreter has the required packages, explain the missing component and use a host-approved installation process or a task-local environment with the same interpreter. Do not run this command against a global interpreter or change PATH:

```bash
python -m pip install -r suite/requirements.txt
```

Install optional dependencies only for a workflow that requires them, from `suite/requirements-optional.txt`. Respect host permissions. If execution or installation is unavailable, identify the specific missing capability; do not claim to have rendered or analysed data. Do not automatically install this skill elsewhere or change global configuration.

## Read the relevant bundled workflow

| Input or task | Local instructions |
| --- | --- |
| Raw CSV/TSV/XLSX, chart choice or statistical analysis | [Data figure workbench](suite/skills/make-sci-data-figures/WORKFLOW.md) |
| Calibrated microscopy or pathology images | [Scientific image preparation](suite/skills/standardize-sci-images/WORKFLOW.md) |
| Existing SVG, visual refinement, composition or Studio editing | [Figure polishing and editing](suite/skills/polish-sci-figures/WORKFLOW.md) |
| Duplicate images or suspected image reuse | [Local image duplicate check](suite/docs/image-duplicate-check.md) |

These are local instructions, not separately installed skills. A companion-skill reference in a nested document means reading the corresponding bundled document above. Resolve its `scripts/`, `references/` and `assets/` paths relative to that document. Run commands beginning with `skills/` from `suite/`; resolve user input and output paths before changing working directory. Save task outputs in the user's workspace, not in the installed skill directory.

```bash
python suite/sci_figures.py inspect INPUT.csv --json
python suite/skills/make-sci-data-figures/scripts/gallery_cli.py --list
```

Confirm experimental design and units before inference. Choose methods for the research question, not the smallest P value. Preserve source data and calibration. Read each template's input contract, distinguish raw observations from supplied model results, and check actual rendered output for overlap, clipping and readable physical sizes before delivery.

## Check images for accidental reuse

Accept “Check whether I used any image twice” or “帮我检查图片有没有放重” without requiring a technical prompt. Compare 2–60 available source raster images or the rasters embedded in supplied SVGs:

```bash
python suite/sci_figures.py duplicates image-a.png image-b.tif figure.svg --out image-check
```

The check runs in the host's Python environment and does not upload images to a separate screening service. In a cloud AI host, this is the host's file environment, not the user's computer. Return the report and matching evidence through the host's normal download mechanism. Review suspected transformed/cropped overlap against original files and acquisition records; preserve the images and never treat a match as a misconduct verdict or no findings as proof of uniqueness. A flattened montage is not automatically split into panels. For the editor's current-figure and selection workflows, follow the [guide](suite/docs/image-duplicate-check.md); screening from a standalone HTML requires the local service.

## Deliver editable outputs

Generate an optional self-contained editing page from the final reviewed SVG:

```bash
python suite/sci_figures.py studio FIGURE_OR_BUNDLE --out figure-studio.html
```

When retaining a candidate bundle, pass `--view SELECTED_VARIANT` using the exact filename stem of the approved SVG (for example, `--view estimation_graphic`). Never assume the bundle's default is the final choice. A single panel defaults to one column; use `--columns` only for an intentional layout. Open the delivered HTML and verify that its initial chart, labels, units and styling match the final SVG/PNG, and that there are no unintended empty grid cells. If the final SVG was edited after generating the bundle, regenerate the matching candidate or package that reviewed SVG directly; do not hand off an older version.

The HTML supports offline appearance and layout editing. Data recomputation needs the local service, with the browser and service on the same accessible host:

```bash
python suite/sci_figures.py studio-serve figure-studio.html
```

A cloud execution environment's localhost is not the user's computer. In cloud hosts, provide downloadable SVG and applicable PDF/PNG outputs, the editing HTML, and the accompanying data/recipe/analysis JSON through the host's download mechanism. Do not promise that a cloud localhost page opens on the user's computer, or upload research data to another service merely to provide a preview.

The complete suite retains its [MIT license](suite/LICENSE), Copyright (c) 2026 Wenting Zhou. Preserve original and applicable third-party notices. [Citation metadata](suite/CITATION.cff) accompanies the source.

---
name: polish-sci-figures
description: Scientific figure polishing, multipanel assembly and Figure Studio visual editing for existing figures, editable SVGs, manuscripts, slides and posters. Use for SCI figures, 论文配图, 组图, 图片查重, duplicate-image screening, editable templates, direct object/text editing, final-size typography, collision checks, publication export and source portability. Keep the AI-only workflow available; route raw-data analysis to make-sci-data-figures and calibrated image preparation to standardize-sci-images.
---

# Polish Scientific Figures

Deliver the near-final figure in one internal pass: establish the claim and final placement, trace the authoritative data, compare the existing and proposed forms, draw, export, inspect at real size, correct, and package. Do not make the user rediscover alignment, canvas, font, overlap, scientific-label, or editability defects.

Accept everyday requests such as “帮我把这张表画成适合论文的图”. Inspect the input first, present a few suitable candidates with plain-language explanations, and ask only for consequential facts the data cannot establish. Let users make routine appearance changes directly in Studio without another model call; do not require specialist vocabulary or a structured prompt.

## Read what the task needs

Keep this file's rules active throughout. Load a reference when its row applies; do not load them all.

| Task | Read |
| --- | --- |
| Draw, restyle, lay out or re-typeset any figure | [drawing rules](references/drawing_rules.md) — required before drawing |
| Several standalone panels, a composite, PPT slots | [canvas profiles](references/canvas_profiles.md) |
| Visual editing, Studio project, templates, editor image or axis tools, install links | [Studio handoff](references/studio_handoff.md), then [Figure Studio](references/figure_studio.md) for the exact contract |
| Resume or patch a saved project, match panel labels | [project operations](references/project_operations.md) and [human/AI handoff](references/human_ai_figure_workflow.md) |
| Two or more scientific raster images in one figure, or a reuse question | [image reuse](references/image_reuse.md) |
| Journal submission | [journal specs](references/journal_specs.md); verify the current official instructions |
| Expand or curate the candidate library | [chart curation](references/chart_discovery_curation.md) |
| Missing package, font or renderer | [dependencies](references/dependencies.md) |

Route raw CSV/TSV/XLSX data and statistics to `$make-sci-data-figures`, and microscopy, histology, fluorescence, EM or blot preparation to `$standardize-sci-images`. Bring their outputs back here for composition and final QA.

## Verify the agent's Python runtime first

Before running a bundled Python script, choose and verify an existing interpreter yourself. Prefer the current project's `.venv/Scripts/python.exe` (Windows) or `.venv/bin/python`, then a runtime exposed by the host's dependency tools; only then inspect registered Python launchers or `python3`. Do not assume that bare `python` is Python 3, or that a host-bundled interpreter includes scientific packages. Read-only checks should try the next available candidate before asking the user to install anything.

First run the candidate with `-c "import sys; print(sys.executable); print(sys.version); sys.exit(0 if (3,10) <= sys.version_info[:2] <= (3,14) else 2)"`. For a supported interpreter, actually import `numpy`, `pandas`, `scipy`, `matplotlib`, `openpyxl` and `PIL`; a package-directory listing is not a successful import. If the full suite is present, run that interpreter's `sci_figures.py doctor --font SELECTED_FONT --json` for the remaining font and environment checks. Reuse the verified executable for every command and subprocess, with `-X utf8` on Windows; `python` in examples means this verified executable.

If no candidate passes, identify the specific missing runtime/package and propose a task-local environment or the installed Figure Studio option. Do not modify PATH, install into the global interpreter, or ask a novice to guess executable paths. Runtime checks are the agent's work; the user's ordinary-language request is sufficient.

## Use the bundled tools

- When the user cites a template number from the audited 1-124 collection or asks for template-based alternatives, run `scripts/template_router.py resolve --template NUMBER`. Use its upgraded scientific family and input contract; never copy ornamental styling or redistribute the source PDF/Prism files.
- Do not add panel letters or serial labels by default. Use `scripts/panel_labels.py` only when the user or verified target explicitly requires them, preferably at final composite assembly.
- Use `scripts/figure_text_qa.py` as an authoring-time release gate before accepting Matplotlib exports; block delivery on grid-geometry drift, unrequested panel titles, collisions, or common baseline scientific notation. Run the skill copy from the agent/test harness, not by making the delivered plotting source search for or import the installed skill.
- Run `scripts/check_source_portability.py` on every delivered plotting source. Treat skill/plugin runtime paths, home-directory support lookups, and machine-specific absolute private paths as release failures. Dynamic imports, `sys.path` mutation, and external processes are advisory unless the user or delivery contract explicitly requires a fully self-contained source; only then add `--strict`.
- Use `scripts/make_montage.py` to compare a figure series.
- Run `scripts/check_svg_canvas.py` on every independently editable SVG series intended for one grid or repeated slot.
- Run `scripts/check_svg_editability.py --require-fully-editable` when fully editable SVG is requested.
- Use `scripts/render_doc_pages.py` after insertion into an existing DOCX, PPTX, or PDF.
- Load `assets/sci_style.mplstyle` as a baseline; override it for a verified journal, deck, or user requirement.
- Run `scripts/svg_final_size_qa.py FIG.svg --width-mm WIDTH --min-text-pt MINIMUM` on every SVG. It measures resolved text size and line width at the placed width and reports clipped or overlapping text, baseline notation, mixed fonts, and colours that merge under colour-vision deficiency or grayscale. Give `--min-text-pt` only for a verified requirement; it then blocks delivery. Estimated overlap and colour findings need a look at the render.
- Run `scripts/figure_accessibility_qa.py` for external resources, embedded-raster DPI and declared fonts. `python sci_figures.py qa FILES --width-mm WIDTH --font FAMILY --json` from the suite root runs all of these together.

## Choose the delivery mode

| Mode | Use when | Required behavior |
| --- | --- | --- |
| `manuscript` | Paper, supplement, or journal submission | Follow the current journal and manuscript conventions. Keep long titles, interpretation, and the figure legend outside the artwork. |
| `presentation` | Talk, poster, or slide deck | Follow the deck grid and inspect every figure at its actual slide position and audience size. |
| `showcase` | GitHub gallery or standalone public image | Optimize for immediate reading at 1200 px wide; keep captions and provenance outside the image. |

Do not mix these modes. A clean manuscript panel and a presentation result slide require different surrounding text, background, and font sizing.

## Establish the figure contract before drawing

Record or infer:

1. The authoritative latest data, plotting source, and scientific claim.
2. The final container: journal width, document position, poster region, or slide grid.
3. Each panel's **slot class and exact final width × height**.
4. Final-size font family and hierarchy, palette semantics, group order, label convention, background, and export formats.
5. Whether a user-approved reference image or existing project visual system is the style target.

Trace the file that is actually delivered or embedded; never polish an obsolete intermediate. Reuse plotting code plus data first, then native vector, then high-resolution raster. Preserve an approved visual system unless the user asks for a redesign.

## Protect scientific meaning

- Verify groups, denominators, units, sample sizes, biological versus technical replicates, statistical tests, uncertainty, and label-to-data mapping before styling.
- Use the latest authoritative result. Correct a scientifically wrong legacy figure from source data and disclose the changed statistical scope; do not preserve an error cosmetically.
- Never invent observations, effects, significance, labels, error bars, or missing data.
- Keep group order and effect direction stable across the series. Follow the user's order; otherwise put reference/control before disease/treatment and state contrasts explicitly.
- Distinguish primary, sensitivity, exploratory, apparent, cross-validated, and externally validated results. Do not overstate a nominal or in-sample result.
- Keep raw microscopy, blots, and structural images immutable. Require authoritative calibration before drawing a scale bar; lock display settings within comparison batches; disclose crop, tone, LUT, and resampling operations.
- Use exact italic *P* values when available. Every color, line, arrow, annotation, and highlighted point must have scientific meaning.
- Use correct scientific typography for standard notation such as IC₅₀, EC₅₀, log₂, and CO₂. Use live Unicode when the selected font supports it; otherwise use semantic italic/subscript/superscript text runs, not baseline digits or character-by-character fragmentation.

## Make the candidate compete with the original

For an existing figure series, compare original and candidate at the same final size.

- First confirm whether data, statistics, and conclusions are identical.
- If identical, replace only when the candidate is materially better in readability, spacing, hierarchy, editability, or target compliance.
- If results changed, explain the authoritative source and treat the change as a scientific update, not a cosmetic win.
- Use a supplied reference image as an explicit visual benchmark: extract palette, line weight, information density, whitespace, typography, and annotation style without copying irrelevant decoration.
- Keep the best parts of competing versions; do not replace a whole set merely because one source produced it.

## Non-negotiable drawing rules

- **Canvas:** draw at the final physical size; same-slot SVGs share width, height and `viewBox`. Never use `bbox_inches="tight"` for panels assembled later.
- **Font:** one family throughout, Arial unless the target requires another; no silent fallback. Keep SVG text live and phrases continuous.
- **Notation:** true IC₅₀, log₂, 10⁻⁴, µ, ×, −, ±; italicize only the statistic symbol; verify gene, protein and species case.
- **Overlap:** zero unintended contact at final size. Reserve zones first; move labels or enlarge the slot before shrinking text.
- **Grid:** equal main axes, aligned edges, equal gutters in regular multipanel grids.
- **Artwork only:** no titles, panel letters, conclusions or file IDs inside the panel unless required; keep the statistics needed to read it.
- **Colour:** stable group semantics, restrained palette, and a second cue (shape, line style or direct label) when colours merge in grayscale or colour-vision checks.
- **Editability:** never call a flattened raster editable; delivered sources must not depend on this skill or private paths.

Details, exceptions and code are in [drawing rules](references/drawing_rules.md).

## Refine confirmed results

For mixed-source figures, use the data workflow's evidence map and image provenance as inputs. Compare reading order and panel grouping in rendered alternatives when these affect interpretation. Confirm inferred roles with the researcher before committing scientific changes. Read [scoped project operations](references/project_operations.md) for supported operations and revision checks.

## Produce and inspect

1. Generate from the authoritative source at the declared canvas and final-size typography.
2. Export SVG/PDF plus PNG; preserve the source code and data.
3. Compare old and new at the same physical size and keep only the winning candidate.
4. Open every final image and inspect a montage for cross-figure typography, canvas rhythm, palette, and margins.
5. Run the final-size, SVG editability and canvas audits; run the panel-label audit only when labels were explicitly required.
6. Insert into the actual manuscript page or slide at 100% declared size and render that container. LibreOffice output is a compatibility preview, not native PowerPoint/Word rendering.
7. For each material finding, record the panel/element, location and measured or visible conflict. Apply the smallest supported correction and re-render at the same physical width. Compare the affected area and the full figure against the original, and confirm neighboring elements and scientific content. Keep a reversible source or patch and report any blocked fixes with their exact locations. Only pass the checks that were actually performed.

## Acceptance gate

Do not deliver while any of these is true:

- The data, denominator, statistical scope, group order, units, or direction is wrong or unverified.
- A manuscript or showcase panel contains an unrequested title, subtitle, panel letter, sequence number, or serial label.
- Same-slot SVGs differ in physical canvas or `viewBox`, or require post-hoc scaling to align.
- Main axes in a regular grid have unequal widths, heights, outer edges, gutters, or avoidable asymmetric whitespace.
- Necessary text is unreadable at final size, clipped, overlapping, fragmented into characters, or using an unintended fallback font.
- Any text, marker, interval, data line, axis, legend, colorbar, panel letter, connector, scale bar, title, or caption overlaps or ambiguously touches another element.
- Scientific notation has incorrect italics, case, capitalization, subscript, superscript, sign, spacing, acronym, gene/protein/species convention, or unit formatting.
- Any visible text uses a family other than the declared Arial or target-specific font, including an unintended math or fallback font.
- Panels on one page use inconsistent spacing, line weights, palette semantics, statistical syntax, or visual density.
- The artwork contains presentation prose or internal IDs, or essential statistical evidence was removed in the name of cleanliness.
- A raster-only/partially editable file is called fully editable.
- A delivered source reads a skill/plugin cache, home-directory support file, or machine-specific absolute private path, or changes behavior merely because this skill is installed.
- A verified minimum text size fails at the placed width, or a reported overlap, clipping or colour merge has not been inspected in the render.
- The real manuscript page, poster, or slide has not been rendered and inspected at the intended placement.

## Package the deliverables

Follow the project convention; otherwise use:

```text
final_figures/   FigX.png  FigX.pdf  FigX.svg
figure_sources/  FigX.py (or FigX.R)  source_data.*
qa/              original_vs_new.png  final_montage.png  rendered_pages/
```

For a slide series, name editable files in reading order, for example `01_S12_A_marker_distribution.svg`; keep that identifier out of the artwork. Keep failed variants and debug renders outside the delivery folder. Return final files first and state only material scientific, source, or editability limitations.

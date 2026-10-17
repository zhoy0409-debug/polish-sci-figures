---
name: polish-sci-figures
description: Scientific figure polishing, multipanel assembly and Figure Studio visual editing for existing figures, editable SVGs, manuscripts, slides and posters. Use for SCI figures, 论文配图, 组图, 图片查重, duplicate-image screening, editable templates, direct object/text editing, final-size typography, collision checks, publication export and source portability. Keep the AI-only workflow available; route raw-data analysis to make-sci-data-figures and calibrated image preparation to standardize-sci-images.
---

# Polish Scientific Figures

Deliver the near-final figure in one internal pass: establish the claim and final placement, trace the authoritative data, compare the existing and proposed forms, draw, export, inspect at real size, correct, and package. Do not make the user rediscover alignment, canvas, font, overlap, scientific-label, or editability defects.

Accept everyday requests such as “帮我把这张表画成适合论文的图”. Inspect the input first, present a few suitable candidates with plain-language explanations, and ask only for consequential facts the data cannot establish. Let users make routine appearance changes directly in Studio without another model call; do not require specialist vocabulary or a structured prompt.

## Verify the agent's Python runtime first

Before running a bundled Python script, choose and verify an existing interpreter yourself. Prefer the current project's `.venv/Scripts/python.exe` (Windows) or `.venv/bin/python`, then a runtime exposed by the host's dependency tools; only then inspect registered Python launchers or `python3`. Do not assume that bare `python` is Python 3, or that a host-bundled interpreter includes scientific packages. Read-only checks should try the next available candidate before asking the user to install anything.

First run the candidate with `-c "import sys; print(sys.executable); print(sys.version); sys.exit(0 if (3,10) <= sys.version_info[:2] <= (3,12) else 2)"`. For a supported interpreter, actually import `numpy`, `pandas`, `scipy`, `matplotlib`, `openpyxl` and `PIL`; a package-directory listing is not a successful import. If the full suite is present, run that interpreter's `sci_figures.py doctor --font SELECTED_FONT --json` for the remaining font and environment checks. Reuse the verified executable for every command and subprocess, with `-X utf8` on Windows; `python` in examples means this verified executable.

If no candidate passes, identify the specific missing runtime/package and propose a task-local environment or the installed Figure Studio option. Do not modify PATH, install into the global interpreter, or ask a novice to guess executable paths. Runtime checks are the agent's work; the user's ordinary-language request is sufficient.

## Product entry points (suite v1.4.20)

This skill and Figure Studio are two entry points to the same product. The original AI/CLI workflow remains available; manual editing is optional. Figure Studio 0.1.20 is the official Windows companion editor, not a fourth independently installed skill. Direct users who want an installed editor to the [official releases](https://github.com/zhoy0409-debug/polish-sci-figures/releases): its Windows x64 installer bundles the renderer and local analysis engine, needs no separate Python/Codex installation, account or activation, and works offline. Do not ask those users to set up an agent runtime.

For an AI handoff, generate a self-contained page from reviewed candidate bundles or SVGs using this skill's builder. Offline HTML supports direct layout and appearance editing; current-data regeneration and analysis require the local service. The installed desktop application starts this service automatically. Read [Figure Studio](references/figure_studio.md) for the actual contracts and [human/AI handoff principles](references/human_ai_figure_workflow.md) before returning to a saved project.

The editor must open on the final approved chart. For a candidate directory, pass `--view` with the chosen SVG filename stem, preserve its data and analysis records, and inspect the initial HTML alongside the final image. For an individually edited final SVG, package that exact SVG or update its bundle candidate first. One panel defaults to one column; extra blank cells require an intentional layout. Never substitute the default candidate for the user's final choice.

The suite retains MIT licensing and third-party notices. Official branding identifies the maintained distribution; it is not copy protection. Never add account gates, activation or an online authenticity check as part of ordinary figure delivery.

## Local image tools and professional axes

Figure Studio exposes the existing editing pipeline through five workflow entries and local command search (Ctrl/Command + K). Use **Image tools** for independent decorative borders, explicit local duplicate screening, original/adjusted display histograms and overview/detail source-coordinate refinement. Native axes re-render from real data; imported numerical axes retain only scientifically supported presentation changes. Do not invent a numerical mapping for flattened images or infer common image provenance from appearance alone.

Duplicate detection and localization are engineering aids, not misconduct judgments. Heavy crops and low-information Western blot strips remain documented misses/refusals. Independent human-labelled blind accuracy is still unverified; keep private images and source paths local. A synthetic pass or transformed real-source regression cannot establish real-case sensitivity. Original pixels remain available, manual ROI confirmation is labelled explicitly, and reference display matching is not stain normalization or quantitative fluorescence correction. Use the bundled image-tool, axis and evaluation guides for limits and reproducible checks.

## Use the bundled resources

- Treat gallery previews as scientific deliverables: inspect the rendered card, enlarged view and composite placement. A good chart type must not be discredited by a poor implementation. Reject clipped labels, overlapping annotations, distorted geometry and illegible detail before presenting a template as ready. Prefer faithful observations, distributions and effect estimates when they answer the user's question; chart novelty alone is not a recommendation criterion.
- For each new editable template, validate its original and replaced data, inspect normal, narrow, wide and tall renders, and exercise the studio data-engine round trip. Preview and applied output must share the renderer. Use native geometry for shape-dependent charts and real axis/layout reflow for size changes; never call affine stretching a responsive template.
- Absorb supplied galleries as design references and data contracts, then implement original renderers in the suite's visual language. Never substitute copied reference cards for editable templates. Label synthetic examples, distinguish implemented renderers from indexed backlog, and validate data replacement and undo as well as appearance. See `references/figure_studio.md` for the current original-template coverage.
- Rank statistical alternatives by the declared estimand, design, experimental unit and method assumptions, never by P value. Compare existing primary/sensitivity results with their own effect measures; retain every method considered and the user’s selection rationale. Missing paired, repeated, covariate or censoring information gates unsupported models. A global test cannot supply pairwise letters. Read the method-comparison section of `references/figure_studio.md`.
- Preserve bilingual UI selection, local autosaved undo/redo, named checkpoints, and intentional-save preference memory in interactive workflows. Never treat hovering or autosaving as aesthetic approval. For candidate-library expansion, read `references/chart_discovery_curation.md`; only offer scientifically suitable, actually rendered candidates.
- The current catalogue has 218 editable starters (191 gallery layouts and 27 ROC/PR presentations), not 218 statistical models. Use the matching input contract; supplied-model displays require actual results. Contract and geometry tests do not certify every possible dataset, label length or final composition as visually approved.
- Use direct character formatting for selected portions of existing or inserted text; preserve native italics and superscripts elsewhere. Numeric results edited as display text must remain marked manual and must not replace the analysis record. For true axis range, category gap or data-coordinate reference-line changes, use supported source redraw controls; changing a tick's text does not rescale an axis.
- Use the explicit local statistical-analysis workflow when comparison results are needed: require confirmed design and experimental-unit roles, choose the supported method by estimand, and retain the requested comparison family. Current-data bindings recompute after valid edits; external and split-facet snapshots become stale when their bound data change. Do not replace missing pairwise results with an omnibus P value.
- For interactive multipanel layout, offer master thumbnails, explicit rows × columns, spanning slots, and drag/keyboard position changes in Figure Studio. Use `--with-layouts` with supported workbench recipes and verified source data to prepare true portrait/wide redraws. Preview both the individual panel and its composite context. Never substitute SVG stretching or bitmap rotation for a layout-aware redraw; preserve manual choices and undo history.

- When the user wants direct visual editing after the AI first draft, read `references/human_ai_figure_workflow.md` and `references/figure_studio.md`, then build the offline editor with `scripts/figure_studio.py`. It accepts reviewed candidate directories or standalone SVG panels and supports selection-scoped colour/opacity/text edits, real candidate previews, undo/redo, named versions, and editable export. Keep the original AI-only workflow available. Never claim a flattened PNG is element-editable or that browser styling reruns statistics. Preserve the user's manual choices when resuming AI finalization.

- Use `$make-sci-data-figures` first when the input is raw CSV/TSV/XLSX data or the user needs statistical design checks, several chart forms from the same data, or palette-only rerendering.
- When the user cites a template number from the audited 1-124 collection or asks for template-based alternatives, run `scripts/template_router.py resolve --template NUMBER`. Use its upgraded scientific family and input contract; never copy ornamental styling or redistribute the source PDF/Prism files.
- Use `$standardize-sci-images` first when the input is microscopy, fluorescence, histology, or electron-microscopy imagery that needs locked batch display settings, equal dimensions, calibrated scale bars, or a processing audit.
- Return the selected outputs from either companion skill to this skill for final canvas, typography, overlap, editability, and real-container QA.
- Load `assets/sci_style.mplstyle` as a baseline; override it for a verified journal, deck, or user requirement.
- Do not add panel letters or serial labels by default. Use `scripts/panel_labels.py` only when the user or verified target explicitly requires them, preferably at final composite assembly.
- Use `scripts/figure_text_qa.py` as an authoring-time release gate before accepting Matplotlib exports; block delivery on grid-geometry drift, unrequested panel titles, collisions, or common baseline scientific notation. Run the skill copy from the agent/test harness, not by making the delivered plotting source search for or import the installed skill.
- Run `scripts/check_source_portability.py` on every delivered plotting source. Treat skill/plugin runtime paths, home-directory support lookups, and machine-specific absolute private paths as release failures. Dynamic imports, `sys.path` mutation, and external processes are advisory unless the user or delivery contract explicitly requires a fully self-contained source; only then add `--strict`.
- Use `scripts/make_montage.py` to compare a figure series.
- Run `scripts/check_svg_canvas.py` on every independently editable SVG series intended for one grid or repeated slot.
- Run `scripts/check_svg_editability.py --require-fully-editable` when fully editable SVG is requested.
- Run `scripts/figure_accessibility_qa.py` for SVG external-resource, embedded-raster DPI, grayscale separation, basic contrast, and manual review flags.
- Use `scripts/render_doc_pages.py` after insertion into an existing DOCX, PPTX, or PDF.
- Read `references/canvas_profiles.md` whenever delivering multiple standalone panels, a manuscript composite assembled later, or figures that will be placed into PPT slots.
- Read `references/journal_specs.md` for a submission and verify the current official instructions.

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

## Keep delivered sources portable

Separate skill-side preflight from project-side source:

- Treat bundled scripts, references, styles, and templates as authoring-time resources. Do not make a delivered source locate `~/.codex`, `$CODEX_HOME`, plugin caches, skill folders, or another private workspace at runtime.
- Resolve project inputs relative to the delivered source or a declared project root. Do not hard-code user-specific absolute paths or mutate `sys.path` to reach a skill.
- Translate required style settings into the plotting source or copy a redistributable asset into the project. If live-object QA must remain rerunnable, include the required helper in a project-local QA folder; never depend on the installed plugin copy.
- Run skill QA from the agent/test harness, then run `check_source_portability.py` on the final source. Moving the complete project directory to another machine must not require this skill or plugin to be installed. Use `--strict` only when the user or delivery contract prohibits `sys.path` mutation, dynamic imports, or external executables.
- Treat declared Python/R runtimes, packages, fonts, and system executables as normal environment prerequisites, not private dependencies. Keep them explicit in a project dependency file or handoff note, and do not silently skip a release gate when an optional dependency is absent.

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

## Lock canvas and typography at final size

This is a release blocker, not a finishing preference.

- Define the final slot before plotting. Every SVG in the same slot class must have identical physical `width`, `height`, and `viewBox` dimensions.
- Create figures at that physical size and reserve margins inside the fixed canvas. Never use `bbox_inches="tight"` or automatic tight cropping for panels that will be assembled later; it silently creates different canvases.
- Insert each asset at its declared physical size (100% scale). If the target slot changes, regenerate for the new slot instead of resizing the SVG in Word, PowerPoint, Illustrator, or layout software.
- Use separate slot classes for equal, wide, or tall panels; keep each class internally identical and keep typography defined at its final physical size.
- Run `check_svg_canvas.py` separately for every slot class and block delivery on any mismatch.

See `references/canvas_profiles.md` for exact matplotlib and audit commands.

## Choose and enforce one font family

- Default the complete figure series to Arial when the user, journal, or existing project does not specify another family.
- Replace Arial globally with Times New Roman or another required family when an explicit user, journal, institutional, or deck specification requires it. Change the shared style/source configuration once; do not edit individual labels.
- Apply the selected family to every visible text object, including axes, ticks, legends, colorbars, annotations, statistical symbols, and mathtext. Do not mix families or accept an unintended fallback.
- Verify that the selected font is installed and contains or can correctly compose every required scientific glyph. After any font change, regenerate and rerun final-size clipping, collision, glyph, SVG-editability, and container checks because text metrics change.
- Do not accept a fallback font as final output. If a draft uses explicit fallback, record requested font, actual font, font file, fallback status, and `final_delivery_allowed: false`.

Set the family once in Matplotlib and switch only `FONT` when the verified target changes:

```python
FONT = "Arial"  # e.g. "Times New Roman" for a journal that requires it
plt.rcParams.update({
    "font.family": FONT,
    "mathtext.rm": FONT,
    "mathtext.it": f"{FONT}:italic",
    "mathtext.bf": f"{FONT}:bold",
})
```

## Enforce scientific typography and nomenclature

Treat notation as scientific content, not decoration. Build a terminology and case map from the authoritative source before plotting, then apply it consistently across the series.

- Italicize only symbols that conventionally require it, such as *P*, *n*, *r*, *t*, *F*, and *z*. Keep their numbers, operators, punctuation, units, descriptive words, and surrounding sentences upright. Never italicize a whole annotation merely because it contains *P*.
- Use true subscript and superscript characters where they remain live and editable: IC₅₀, EC₅₀, ED₅₀, LD₅₀, log₂, log₁₀, CO₂, cm², and 10⁻⁴. Do not deliver baseline forms such as `IC50`, `log2`, `CO2`, `cm^2`, or `10^-4` in figure text.
- Confirm that the chosen font can render or semantically compose every required scientific glyph and treat any missing-glyph warning as a release failure. Never accept tofu boxes, blanks, or silent fallback.
- Use proper mathematical signs and spacing: `×`, `−`, `±`, `≤`, and `≥`; put spaces around `=`, `<`, and `>` and between values and units, for example `AUC = 0.84`, `P < 0.001`, and `0.72 µM`. Do not use the letter `x` as a multiplication sign.
- Use exact statistical values and the target journal's capitalization; default to italic capital *P*, not lowercase `p`. State the statistic or interval unambiguously, for example `HR (95% CI)` or `AUC (95% CI)`.
- Italicize genus/species binomials, but keep strain designations and surrounding prose upright unless the field convention says otherwise.
- Verify organism- and discipline-specific gene/protein conventions before changing case or italics. Preserve authoritative labels when uncertain: gene symbols and protein names are not interchangeable, and human, mouse, plant, and microbial capitalization rules differ.
- Preserve intended acronym, treatment, cohort, gene, protein, and cell-state case exactly across panels. Do not auto-title-case biological labels or silently normalize an unfamiliar term.
- Keep multiplicity language exact: distinguish raw *P*, adjusted *P*, q value, and FDR, and show the measure that actually drives the axis, color, threshold, or claim. Do not stamp `FDR` onto every panel when adjustment is reported elsewhere, but verify that every figure abbreviation is defined on first use in the figure-caption-text system; use a full label in the artwork when an unexplained abbreviation would be ambiguous.
- Block delivery when the required case, italics, subscript, superscript, symbol, or unit convention is uncertain or inconsistent.

## Prevent every overlap at final placement

Zero unintended overlap is mandatory. Check text against text, markers, error bars, confidence intervals, data lines, axes, legends, colorbars, panel letters, arrows, connectors, scale bars, and neighboring panels.

- Reserve dedicated layout zones for axes, legends, colorbars, labels, and annotations before drawing data. Put forest-plot values in a separate annotation column rather than on the marker or confidence interval.
- Omit panel letters and serial labels by default. When explicitly required, add them at final composite assembly in a fixed outer margin and rerun collision checks.
- Move a colliding annotation to a reserved label column, axis label, legend, figure legend, or editable slide text. If no valid space exists, redesign the layout or regenerate for a larger slot; do not solve collisions by blindly shrinking text.
- Place multiple comparison brackets and exact *P* values on distinct levels derived from the compared groups' observed maxima, uncertainty bars, and existing annotations. Keep a visible offset above each bracket; never align unrelated comparisons into one crowded row or let the value touch the rule.
- Inspect the rendered image at the actual manuscript, README, poster, or slide size. A source canvas that looks clean while zoomed in does not pass.
- Do not use a horizontal contact sheet when it reduces each panel below a readable final preview size. Prefer a vertical stack or separate full-width previews, with descriptions outside the artwork.
- Treat touching or ambiguous proximity as a failure when it can make a label appear attached to the wrong line, point, group, or panel.
- Block export and delivery until every unintended collision is removed.

## Use a restrained editorial visual language

- Prefer low-saturation, high-contrast colors with stable semantics, dark text/axes, subtle grids, and few accent colors. Match the approved palette first.
- Set sequential and diverging heatmap limits from the declared scientific scale or the displayed data distribution. A correlation matrix keeps its meaningful domain when appropriate, but a narrow observed range must not collapse into an unreadable single-color block; record any clipping, centering, or robust quantile rule.
- Avoid default card grids, excessive white boxes, gradients, and decorative frames. For slides, prefer transparent figure backgrounds over a very light slide background unless the template requires otherwise.
- Build the panel grid before plotting: aligned outer edges, equal gutters, balanced weight, and intentional whitespace only.
- Distinguish the figure canvas, allocated subplot slot, and actual axes box. Equal canvas or GridSpec cells do not pass when one plotted axes is visibly narrower, shorter, shifted, or surrounded by avoidable blank space.
- In a regular multipanel grid, require all main axes in each column to share left/right edges and width, and all axes in each row to share top/bottom edges and height. Keep gutters uniform and content optically balanced.
- Do not let `set_aspect("equal", adjustable="box")` silently shrink one panel. Use the normal automatic aspect when equal data units are not scientifically required; when geometry must stay undistorted, use `adjustable="datalim"` or allocate a deliberately matching slot.
- Treat whitespace as a budget. Keep only space reserved for labels, legends, colorbars, annotations, or scientifically necessary geometry; remove accidental or one-sided empty regions before delivery.
- Keep legends in reserved space and all text, annotations, colorbars, and connectors inside a visible safety margin. Lines must never cross cards, labels, or unrelated objects.
- Treat PCA scores, group ellipses, loading arrows, loading labels, marginal distributions, and the legend as one coordinated layout. Loading labels stay attached to their arrow endpoints, ellipses remain subordinate to points, and marginal axes must not shrink or displace the main score axes unexpectedly.
- Reserve a separate annotation column for numeric labels beside forest plots, intervals, and lollipops; never print values on top of markers or confidence intervals.
- Use the form that best answers the claim: points plus distributions, rainclouds, paired slopes or estimation plots, lollipops/forest plots, 100% composition plots, vector heatmaps, and lines with uncertainty. Do not add novelty that weakens comparison.
- For longitudinal state changes, use alluvial flows only when adjacent matrices conserve every state total; for multimodal integration, preserve direction and scale explicitly in communication networks, cross-modal concordance maps, and ridgeline distributions. Keep the generating values and conservation checks in the reproducible source.
- Make panels on the same page visibly related: same font hierarchy, line weights, palette, statistical syntax, axes treatment, canvas class, and information density.
- Treat domain-standard geometry as part of scientific credibility. Benchmark published examples before making a public domain-specific showcase; synthetic single-cell or spatial demos must be clearly disclosed and must not substitute regular Gaussian islands or generic geometric tissue outlines for a plausible atlas or spatial map.

## Separate artwork from narrative without deleting evidence

For manuscript-ready or reusable SVG panels:

- Default to no per-panel subtitles, headings, panel letters, or serial labels inside manuscript and showcase artwork. Put panel descriptions in the figure legend, README, or editable slide text. Treat any internal title or sequence label as a release failure unless the user or verified target format explicitly requires it.
- Do not embed long titles, conclusions, explanatory sentences, captions, slide takeaways, or internal file IDs such as `P01` in the artwork.
- Keep the minimum evidence needed to interpret the data: group labels, units, sample size when material, effect estimate, uncertainty, exact *P* value, AUC/CI, or other result-specific statistics.
- Add panel labels only when the verified target convention or user explicitly requires them; add them during final assembly rather than baking them into reusable source panels when possible.

For presentations, put the conclusion-style slide title, per-panel explanation, key finding, and takeaway in editable PPT text layers outside the SVG. Removing long titles does **not** authorize removing statistical evidence.

## Preserve practical editability

- Keep SVG text as live text (`svg.fonttype: none`), not path outlines.
- Keep complete phrases as continuous text objects. Do not export sentences as one character per `<tspan>`; Illustrator users must be able to edit a phrase in one operation.
- Do not call an SVG fully editable when it wraps a PNG or contains raster heatmaps/colorbars. Convert analytical heatmaps and color scales to vector geometry when full editability is required.
- If only a raster source exists, report the result as partially editable and preserve the raster faithfully.

## Mode-specific composition

**Manuscript.** Use the verified single- or double-column dimensions, keep the figure legend outside the artwork, synchronize all panel references, and inspect at final print width.

**Presentation.** Derive panel canvases from the slide grid before drawing. Use a conclusion-style slide title, figure, then concise per-panel meaning and key finding. Group related results for the available speaking time; keep secondary evidence in backup rather than making the main slide unreadable. Do not show internal file-order numbers on the slide. Name editable files in PPT reading order so the user can locate them.

**Showcase.** Keep the image self-explanatory at 1200 px, disclose synthetic data, and package provenance for published-figure reproductions. Render the actual README or website container at that width. Do not place dense multi-panel figures in two-column gallery cells; use full-width previews or purpose-built thumbnails.

## Produce and inspect

1. Generate from the authoritative source at the declared canvas and final-size typography.
2. Export SVG/PDF plus PNG; preserve the source code and data.
3. Compare old and new at the same physical size and keep only the winning candidate.
4. Open every final image and inspect a montage for cross-figure typography, canvas rhythm, palette, and margins.
5. Run SVG editability and canvas audits; run the panel-label audit only when labels were explicitly required.
6. Insert into the actual manuscript page or slide at 100% declared size and render that container. LibreOffice output is a compatibility preview, not native PowerPoint/Word rendering.
7. Correct every failure and rerun the relevant checks before delivery.

## Screen image reuse when reviewing image panels

For a figure containing two or more scientific raster images, include local duplicate screening in final image QA when the source images are available. Also accept ordinary requests such as “看看这些图有没有放重” or “Check these images for reuse.” Use the complete suite's CLI from the suite root; paths to user inputs and outputs must remain in the user's workspace:

```bash
python sci_figures.py duplicates image-a.png image-b.tif figure.svg --out image-check
```

The check compares 2–60 raster images, including raster images embedded in SVG, without modifying the artwork. The editor offers the same check for the current figure, selected images, or local files. Read [the image duplicate guide](../../docs/image-duplicate-check.md) for the supported scope and report workflow. A local service is required for screening from a standalone Studio HTML page; the installed desktop application starts it automatically.

Review exact-image findings and suspected transformed/cropped overlaps with the original files and acquisition records. Preserve the pair identities, matching evidence and report in the QA delivery. Never delete images automatically or call a similarity result proof of misconduct. Intended reuse, shared controls and related acquisition channels need contextual review. Do not describe an empty report as proof of uniqueness or exhaustive image-integrity certification. This is cross-image screening, not detection of copy-move edits within one image or automatic segmentation of a flattened multipanel screenshot; vector chart glyphs are not image candidates.

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
- The real manuscript page, poster, or slide has not been rendered and inspected at the intended placement.

## Package the deliverables

Follow the project convention; otherwise use:

```text
final_figures/   FigX.png  FigX.pdf  FigX.svg
figure_sources/  FigX.py (or FigX.R)  source_data.*
qa/              original_vs_new.png  final_montage.png  rendered_pages/
```

For a slide series, name editable files in reading order, for example `01_S12_A_marker_distribution.svg`; keep that identifier out of the artwork. Keep failed variants and debug renders outside the delivery folder. Return final files first and state only material scientific, source, or editability limitations.

## Local Figure Studio interaction update (2026-10-15)

For new editable handoffs, use this installed skill's `scripts/figure_studio.py` and bundled `assets/figure-studio`; do not copy an old generated HTML as the editor template. The template includes marquee selection of locked objects, unlock selected/all, top/left and divider-end resize handles, aspect restoration that preserves chosen font and effective size, a searchable current-panel layer list, object alignment/distribution and paragraph alignment/spacing/indent controls. Keep user-saved project state when updating existing handoffs. These local changes do not imply that previously released desktop installers have been rebuilt.

---
name: polish-sci-figures
description: Create, redraw, compare, arrange, audit, and package publication-grade scientific figures for manuscripts, posters, Word documents, PowerPoint slides, and public showcases. Use for SCI figures, 论文配图, 科研作图, 结果可视化, 组图, 重绘, figure polishing, aligned multipanel grids, whitespace control, title-free and serial-label-free panels, collision-free annotations, Arial or journal-specific font control, scientific typography and nomenclature, consistent canvas sizing, final-size typography, editable SVG/PDF/PNG, manuscript or presentation figure QA, and original-versus-redesign selection.
---

# Polish Scientific Figures

Deliver the near-final figure in one internal pass: establish the claim and final placement, trace the authoritative data, compare the existing and proposed forms, draw, export, inspect at real size, correct, and package. Do not make the user rediscover alignment, canvas, font, overlap, scientific-label, or editability defects.

## Use the bundled resources

- Load `assets/sci_style.mplstyle` as a baseline; override it for a verified journal, deck, or user requirement.
- Do not add panel letters or serial labels by default. Use `scripts/panel_labels.py` only when the user or verified target explicitly requires them, preferably at final composite assembly.
- Run `scripts/figure_text_qa.py` before saving Matplotlib figures; block export on grid-geometry drift, unrequested panel titles, collisions, or common baseline scientific notation.
- Use `scripts/make_montage.py` to compare a figure series.
- Run `scripts/check_svg_canvas.py` on every independently editable SVG series intended for one grid or repeated slot.
- Run `scripts/check_svg_editability.py --require-fully-editable` when fully editable SVG is requested.
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

## Protect scientific meaning

- Verify groups, denominators, units, sample sizes, biological versus technical replicates, statistical tests, uncertainty, and label-to-data mapping before styling.
- Use the latest authoritative result. Correct a scientifically wrong legacy figure from source data and disclose the changed statistical scope; do not preserve an error cosmetically.
- Never invent observations, effects, significance, labels, error bars, or missing data.
- Keep group order and effect direction stable across the series. Follow the user's order; otherwise put reference/control before disease/treatment and state contrasts explicitly.
- Distinguish primary, sensitivity, exploratory, apparent, cross-validated, and externally validated results. Do not overstate a nominal or in-sample result.
- Keep raw microscopy, blots, and structural images faithful, preserve scale bars, and disclose meaningful processing.
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
- Block delivery when the required case, italics, subscript, superscript, symbol, or unit convention is uncertain or inconsistent.

## Prevent every overlap at final placement

Zero unintended overlap is mandatory. Check text against text, markers, error bars, confidence intervals, data lines, axes, legends, colorbars, panel letters, arrows, connectors, scale bars, and neighboring panels.

- Reserve dedicated layout zones for axes, legends, colorbars, labels, and annotations before drawing data. Put forest-plot values in a separate annotation column rather than on the marker or confidence interval.
- Omit panel letters and serial labels by default. When explicitly required, add them at final composite assembly in a fixed outer margin and rerun collision checks.
- Move a colliding annotation to a reserved label column, axis label, legend, figure legend, or editable slide text. If no valid space exists, redesign the layout or regenerate for a larger slot; do not solve collisions by blindly shrinking text.
- Inspect the rendered image at the actual manuscript, README, poster, or slide size. A source canvas that looks clean while zoomed in does not pass.
- Treat touching or ambiguous proximity as a failure when it can make a label appear attached to the wrong line, point, group, or panel.
- Block export and delivery until every unintended collision is removed.

## Use a restrained editorial visual language

- Prefer low-saturation, high-contrast colors with stable semantics, dark text/axes, subtle grids, and few accent colors. Match the approved palette first.
- Avoid default card grids, excessive white boxes, gradients, and decorative frames. For slides, prefer transparent figure backgrounds over a very light slide background unless the template requires otherwise.
- Build the panel grid before plotting: aligned outer edges, equal gutters, balanced weight, and intentional whitespace only.
- Distinguish the figure canvas, allocated subplot slot, and actual axes box. Equal canvas or GridSpec cells do not pass when one plotted axes is visibly narrower, shorter, shifted, or surrounded by avoidable blank space.
- In a regular multipanel grid, require all main axes in each column to share left/right edges and width, and all axes in each row to share top/bottom edges and height. Keep gutters uniform and content optically balanced.
- Do not let `set_aspect("equal", adjustable="box")` silently shrink one panel. Use the normal automatic aspect when equal data units are not scientifically required; when geometry must stay undistorted, use `adjustable="datalim"` or allocate a deliberately matching slot.
- Treat whitespace as a budget. Keep only space reserved for labels, legends, colorbars, annotations, or scientifically necessary geometry; remove accidental or one-sided empty regions before delivery.
- Keep legends in reserved space and all text, annotations, colorbars, and connectors inside a visible safety margin. Lines must never cross cards, labels, or unrelated objects.
- Reserve a separate annotation column for numeric labels beside forest plots, intervals, and lollipops; never print values on top of markers or confidence intervals.
- Use the form that best answers the claim: points plus distributions, rainclouds, paired slopes or estimation plots, lollipops/forest plots, 100% composition plots, vector heatmaps, and lines with uncertainty. Do not add novelty that weakens comparison.
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
- The real manuscript page, poster, or slide has not been rendered and inspected at the intended placement.

## Package the deliverables

Follow the project convention; otherwise use:

```text
final_figures/   FigX.png  FigX.pdf  FigX.svg
figure_sources/  FigX.py (or FigX.R)  source_data.*
qa/              original_vs_new.png  final_montage.png  rendered_pages/
```

For a slide series, name editable files in reading order, for example `01_S12_A_marker_distribution.svg`; keep that identifier out of the artwork. Keep failed variants and debug renders outside the delivery folder. Return final files first and state only material scientific, source, or editability limitations.

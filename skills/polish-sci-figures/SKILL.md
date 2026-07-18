---
name: polish-sci-figures
description: Create, redraw, compare, arrange, audit, and package publication-grade scientific figures for manuscripts, posters, Word documents, PowerPoint slides, and public showcases. Use for SCI figures, 论文配图, 科研作图, 结果可视化, 组图, 重绘, figure polishing, consistent canvas sizing, final-size typography, editable SVG/PDF/PNG, manuscript or presentation figure QA, and original-versus-redesign selection.
---

# Polish Scientific Figures

Deliver the near-final figure in one internal pass: establish the claim and final placement, trace the authoritative data, compare the existing and proposed forms, draw, export, inspect at real size, correct, and package. Do not make the user rediscover alignment, canvas, font, overlap, scientific-label, or editability defects.

## Use the bundled resources

- Load `assets/sci_style.mplstyle` as a baseline; override it for a verified journal, deck, or user requirement.
- Use `scripts/panel_labels.py` when panel labels are required.
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
4. Final-size font hierarchy, palette semantics, group order, label convention, background, and export formats.
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

## Use a restrained editorial visual language

- Prefer low-saturation, high-contrast colors with stable semantics, dark text/axes, subtle grids, and few accent colors. Match the approved palette first.
- Avoid default card grids, excessive white boxes, gradients, and decorative frames. For slides, prefer transparent figure backgrounds over a very light slide background unless the template requires otherwise.
- Build the panel grid before plotting: aligned outer edges, equal gutters, balanced weight, and intentional whitespace only.
- Keep legends in reserved space and all text, annotations, colorbars, and connectors inside a visible safety margin. Lines must never cross cards, labels, or unrelated objects.
- Reserve a separate annotation column for numeric labels beside forest plots, intervals, and lollipops; never print values on top of markers or confidence intervals.
- Use the form that best answers the claim: points plus distributions, rainclouds, paired slopes or estimation plots, lollipops/forest plots, 100% composition plots, vector heatmaps, and lines with uncertainty. Do not add novelty that weakens comparison.
- Make panels on the same page visibly related: same font hierarchy, line weights, palette, statistical syntax, axes treatment, canvas class, and information density.
- Treat domain-standard geometry as part of scientific credibility. Benchmark published examples before making a public domain-specific showcase; synthetic single-cell or spatial demos must be clearly disclosed and must not substitute regular Gaussian islands or generic geometric tissue outlines for a plausible atlas or spatial map.

## Separate artwork from narrative without deleting evidence

For manuscript-ready or reusable SVG panels:

- Do not embed long titles, conclusions, explanatory sentences, captions, slide takeaways, or internal file IDs such as `P01` in the artwork.
- Keep the minimum evidence needed to interpret the data: group labels, units, sample size when material, effect estimate, uncertainty, exact *P* value, AUC/CI, or other result-specific statistics.
- Add only the panel label required by the target convention.

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
5. Run panel-label, SVG editability, and canvas audits.
6. Insert into the actual manuscript page or slide at 100% declared size and render that container. LibreOffice output is a compatibility preview, not native PowerPoint/Word rendering.
7. Correct every failure and rerun the relevant checks before delivery.

## Acceptance gate

Do not deliver while any of these is true:

- The data, denominator, statistical scope, group order, units, or direction is wrong or unverified.
- Same-slot SVGs differ in physical canvas or `viewBox`, or require post-hoc scaling to align.
- Necessary text is unreadable at final size, clipped, overlapping, fragmented into characters, or using an unintended fallback font.
- A legend, annotation, connector, title, or caption covers data or another element.
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

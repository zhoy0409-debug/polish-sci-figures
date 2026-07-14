---
name: polish-sci-figures
description: Create, redraw, arrange, audit, and deliver publication-grade scientific figures and multi-panel composites for manuscripts, Word documents, and academic PowerPoint slides. Use for SCI/论文配图/科研作图/结果可视化/组图/图件优化/重绘/拼版/统一配色/figure polishing, especially when the user wants a clean square layout, strict panel-label alignment, legible text at final size, varied but scientifically appropriate chart types, consistent styling, exact P values, and editable SVG/PDF/PNG deliverables. Also use when integrating new and old figures into a manuscript or PPT, repairing cropped or flattened legacy figures, or performing final visual QA before submission or presentation.
---

# Polish SCI Figures

Produce the near-final figure in one internal pass: understand the scientific claim, reuse the best available source, draw, assemble, render, inspect, correct, and package. Do not make the user discover basic alignment, clipping, font, whitespace, or editability problems.

**Bundled resources — use them, do not reinvent them:**

- `assets/sci_style.mplstyle` — matplotlib rcParams: sans-serif default, editable SVG/PDF text, sensible line widths. Load first: `plt.style.use(...)`. Override font family and size per the target journal (see `references/journal_specs.md`).
- `scripts/panel_labels.py` — place panel labels on a mathematically shared grid, plus `audit_label_alignment()` which groups labels by row/column and flags any deviation.
- `scripts/make_montage.py` — contact sheet for cross-figure consistency QA.
- `scripts/render_doc_pages.py` — render DOCX/PPTX/PDF pages to PNG so the figure is inspected *after insertion*; it prefers PyMuPDF and falls back to Poppler `pdftoppm`.
- `scripts/check_svg_editability.py` — objective FULLY / PARTIALLY / RASTER-ONLY verdict so editability is never overstated.
- `references/journal_specs.md` — per-journal column widths, font sizes, dpi, TIFF requirements.
- `references/dependencies.md` — packages and font-availability check.
- `examples/example_figure.py` — runnable end-to-end reference (box+points, paired slopes, ranked lollipop, heatmap) using the style + `panel_labels.py`; run it to regenerate the example figure.

## Resolve the figure contract

Inspect the project before drawing:

1. Locate the authoritative latest manuscript/PPT, source data, plotting scripts, native AI/SVG/PDF/PPT assets, and user-approved reference figures.
2. Trace which output file is actually embedded or delivered. Do not polish an obsolete intermediate file.
3. Reuse the existing plotting backend and style helpers. With no backend signal, default to Python/matplotlib; use R when the source is R-native.
4. Record before writing code: the figure's core conclusion, each panel's role, the target container and size, palette semantics, the panel-label convention, and required exports.

Apply the user's explicit current-project instruction over every default here. Preserve an approved visual system instead of redesigning it gratuitously. Ask only when a missing choice materially changes the result.

## Protect scientific meaning

- Verify the comparison, sample size, biological vs technical replicates, group direction, statistical test, units, and label-to-data mapping before styling.
- Never invent values, significance, labels, trends, error bars, or missing observations.
- Correct a scientifically wrong legacy figure from source data; do not preserve an error merely because it appeared in the original.
- Keep microscopy, blot, and structure image content unchanged except for disclosed, non-misleading layout/annotation work. Retain scale bars and required context.
- Use exact italic *P* values when available; use threshold symbols only when exact values are unavailable or the target convention requires them.
- Every color, line, arrow, annotation, and highlighted point must carry a defined meaning. Distinguish analysis from decoration.

## Choose the visual form by the message

Avoid a deck or paper made entirely of interchangeable bar charts. Vary form only when the data and claim support it:

- Distributions: points plus box/violin/raincloud, not bars alone.
- Paired samples: paired points or slope lines.
- Up/down direction: arrows, diverging bars, or lollipops — make it unambiguous.
- Ranked effects: lollipops or horizontal bars.
- Many features across conditions: heatmaps or dot plots.
- Enrichment: dot/lollipop plots; networks only when topology is the claim.
- Time courses: lines with uncertainty; keep labels off the lines.
- Effect estimates with central uncertainty: forest plots.
- Keep comparable panels comparable; do not add novelty that weakens cross-panel reading.

## House visual standard

**Typography.** Match the target journal/template or an approved existing figure first. Do not hard-code one family across all projects — neither Arial nor Times New Roman is universally correct. When nothing is specified, a sans-serif family (Arial/Helvetica) is a safe default for figure text because many journals set figure labels in sans-serif even when body text is serif; switch to serif only when the target calls for it. Size text for the final container, not a maximized preview; every necessary label must be readable at 100% on the page or from the audience. Prefer shrinking the plot area or tick density over shrinking essential text. Keep weight consistent. Confirm the intended font is actually installed — matplotlib falls back silently (`references/dependencies.md`). Italicize statistical *P* and other notation that needs it, and verify the *rendered* font: with the bundled style (`mathtext.default: regular`) a bare `$P$` renders upright, so write `$\mathit{P}$` to get an italic *P* while digits and units stay upright.

**Color.** Match the approved project/reference palette across old and new figures. With no palette and where biology fits, use a restrained red/blue/gray system: red = positive/tumor/high/up, blue = negative/normal/low/down, gray = neutral/nonsignificant. Keep semantic roles stable across every panel. Use colorblind-safe contrasts and retain meaning in grayscale where feasible.

**Panel labels & captions.** Give every real analytical or image subpanel its own label — do not hide three independent plots under one "A". Follow the target convention; for manuscripts with no rule, bold lowercase in parentheses `(a)` `(b)` `(c)`; for PPT, the deck's A/B/C/D. Put labels on a shared grid (same row = identical y, same column = identical x) using `scripts/panel_labels.py`, and verify with `audit_label_alignment()`. One label size across main and supplementary. Keep labels near their panels without overlapping plots/axes/legends. Put interpretation in the legend/caption/slide title, not beside the label.

**Lines, legends, annotations.** Keep axes, brackets, connectors, and leader lines continuous, clean, and correctly anchored; remove meaningless dashed guides. Place legends in deliberate free space, never covering data, axes, uncertainty bands, or another legend; lowering legend opacity is not a fix for a collision. Every annotated gene/protein name must clearly map to its point. Use standard hyphens and supported glyphs — reject mojibake, missing symbols, and fallback boxes. Keep labels off plotted lines and outside confidence bands.

## Compose a strict grid

Plan panel rectangles before drawing.

- Make composites compact, balanced, and as square as content and target allow; avoid a needlessly long banner.
- Use equal gutters, aligned outer edges, consistent panel heights/widths.
- A lower full-width panel equals the total visual width of the panels above it — not wider, not detached by a large gap.
- Remove internal blank canvas from cropped source images before laying out; crop microscopy/images from measured bounds, preserving aspect ratio.
- Treat unexplained whitespace as a defect: every large empty area must be intentional breathing room, a reserved legend lane, or an aspect-ratio requirement.
- Maintain a visible safety margin around all text, legends, arrows, labels, and image features after the final export crop.
- Keep all content inside the target page or slide.

## Integrate into manuscripts and PPTs

**Manuscript.** Compose for the journal's single-/double-column width and the actual A4/Letter insertion size (`references/journal_specs.md`). Keep main and supplementary figures related and nonredundant; remove duplicated panels unless repetition is required. Keep panel explanations in the legend and cross-refs synchronized with the final panel structure.

**PPT.** Group panels supporting one narrative block on one slide when legibility permits. Integrate new results into the existing story rather than appending slides. Match the deck's title, footer, palette, margins, and rhythm. Use abbreviations when space is tight and define them in the caption/footer. Plots may shrink if still clear, but keep all text large and crisp. Fit the composite into the reserved slide area without overlap, clipping, or empty gaps.

## Prefer editable sources

Use the highest-quality source, in order:

1. Existing plotting script plus source data.
2. Native vector (AI, SVG, editable PDF, PPT shapes, R/Python figure object).
3. High-resolution raster only when no native source exists.

Do not patch a flattened PNG when a native source exists. If only a flattened raster exists: state that its pixels are not fully editable; ask for the AI/SVG/PDF/PPT or source data when full editability is required; if work must proceed, keep the raster background intact, make new text/annotation layers editable, and report the result as **partially editable**. Never claim that wrapping a PNG inside SVG makes the underlying image editable — verify the true status with `scripts/check_svg_editability.py`. For Python SVG output, keep text as text (`svg.fonttype: none`, set in the style), embed/resolve fonts, and confirm the SVG parses and renders independently.

## Internal QA loop

Successful code execution is not a finished figure. Build assets before the document in dependency order (never generate assets and assemble the document that reads them in parallel), then:

1. Generate from the authoritative source; export high-res PNG plus SVG/PDF.
2. Open every final PNG and inspect it visually. Build a montage (`scripts/make_montage.py`) for multi-figure consistency.
3. Inspect at the actual insertion/slide size, not only enlarged.
4. Embed into the real DOCX/PPT/PDF and render the pages (`scripts/render_doc_pages.py`) — a standalone figure can fail after insertion. Note: DOCX/PPTX are rendered through LibreOffice, so those page images are a **LibreOffice compatibility preview, not native Word/PowerPoint rendering**; confirm final layout in the actual application when fidelity matters.
5. For raster+vector repairs, measure coordinates against the original crop or a debug grid; never restore axes or lines by visual guess alone.
6. Use OCR only when a real OCR backend is available; otherwise state the review was structural + visual, not OCR-based.
7. Correct every failure and repeat the relevant checks before delivery.

## Release checklist (blockers)

Do not deliver while any of these is true. This is the single acceptance gate.

- [ ] A true subpanel is missing its label, or has more than one.
- [ ] Same-row / same-column labels are not mathematically aligned (`audit_label_alignment` returns warnings).
- [ ] Necessary text is clipped, overlapping, or unreadable at final size.
- [ ] Font family or size is wrong for the target journal, or a font fell back silently.
- [ ] *P* is not rendered italic, or units/subscripts are wrongly italicized.
- [ ] Sample sizes, groups, directions, units, or statistics are wrong or unverified.
- [ ] A legend/annotation covers data, a confidence band, an axis, or another label.
- [ ] An unexplained large blank area, a detached panel, or content crowding the export edge.
- [ ] A missing or floating axis, or a broken/garbled connector/glyph.
- [ ] A raster-only deliverable is described as fully editable (`check_svg_editability.py` disagrees).
- [ ] The real manuscript page or slide has not been rendered and inspected.

## Package the deliverables

Follow an existing project convention; otherwise:

```text
final_figures/   FigX.png  FigX.pdf  FigX.svg
figure_sources/  FigX.py (or FigX.R)  source_data.*
qa/              final_montage.png   pages/ (rendered document pages)
```

- PNG >=300 dpi for presentation/routine publication, 600 dpi for line art or when the journal requires it; SVG/PDF as editable/vector masters.
- Add TIFF only when the target journal requires it (`references/journal_specs.md`).
- Keep debug crops, failed variants, and temporary renders out of the delivery folder.
- Report which files are fully editable, partially editable, or raster-only.

Return the final files first, then only the key scientific or editability limitations that remain.

# Drawing rules

Read this before drawing or restyling a figure. These rules are part of the acceptance gate in `SKILL.md`.

## Lock canvas and typography at final size

This is a release blocker, not a finishing preference.

- Define the final slot before plotting. Every SVG in the same slot class must have identical physical `width`, `height`, and `viewBox` dimensions.
- Create figures at that physical size and reserve margins inside the fixed canvas. Never use `bbox_inches="tight"` or automatic tight cropping for panels that will be assembled later; it silently creates different canvases.
- Insert each asset at its declared physical size (100% scale). If the target slot changes, regenerate for the new slot instead of resizing the SVG in Word, PowerPoint, Illustrator, or layout software.
- Use separate slot classes for equal, wide, or tall panels; keep each class internally identical and keep typography defined at its final physical size.
- Run `check_svg_canvas.py` separately for every slot class and block delivery on any mismatch.

See `canvas_profiles.md` for exact matplotlib and audit commands.

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

## Keep delivered sources portable

Separate skill-side preflight from project-side source:

- Treat bundled scripts, references, styles, and templates as authoring-time resources. Do not make a delivered source locate `~/.codex`, `$CODEX_HOME`, plugin caches, skill folders, or another private workspace at runtime.
- Resolve project inputs relative to the delivered source or a declared project root. Do not hard-code user-specific absolute paths or mutate `sys.path` to reach a skill.
- Translate required style settings into the plotting source or copy a redistributable asset into the project. If live-object QA must remain rerunnable, include the required helper in a project-local QA folder; never depend on the installed plugin copy.
- Run skill QA from the agent/test harness, then run `check_source_portability.py` on the final source. Moving the complete project directory to another machine must not require this skill or plugin to be installed. Use `--strict` only when the user or delivery contract prohibits `sys.path` mutation, dynamic imports, or external executables.
- Treat declared Python/R runtimes, packages, fonts, and system executables as normal environment prerequisites, not private dependencies. Keep them explicit in a project dependency file or handoff note, and do not silently skip a release gate when an optional dependency is absent.

## Mode-specific composition

**Manuscript.** Use the verified single- or double-column dimensions, keep the figure legend outside the artwork, synchronize all panel references, and inspect at final print width.

**Presentation.** Derive panel canvases from the slide grid before drawing. Use a conclusion-style slide title, figure, then concise per-panel meaning and key finding. Group related results for the available speaking time; keep secondary evidence in backup rather than making the main slide unreadable. Do not show internal file-order numbers on the slide. Name editable files in PPT reading order so the user can locate them.

**Showcase.** Keep the image self-explanatory at 1200 px, disclose synthetic data, and package provenance for published-figure reproductions. Render the actual README or website container at that width. Do not place dense multi-panel figures in two-column gallery cells; use full-width previews or purpose-built thumbnails.

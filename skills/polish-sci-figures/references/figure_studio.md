# Figure Studio — AI first draft, direct visual refinement

## When to use

Use after `make-sci-data-figures` has produced a reviewed set of candidates, or when the user has editable SVG panels. The agent can still complete the original generation/assembly/QA workflow without a manual step. Offer this editor when the user wants to make their own fine adjustments. Never replace statistical validation with browser styling.

## Create the editable page

From the suite root:

```sh
python sci_figures.py studio results/panel1 results/panel2 --out figure-studio.html --title "Figure 2"
# Include real portrait and wide redraws for supported workbench bundles:
python sci_figures.py studio results/panel1 results/panel2 --with-layouts --out figure-studio-layouts.html
```

From an individually installed skill:

```sh
python scripts/figure_studio.py results/panel1 results/panel2.svg --out figure-studio.html
```

Each directory is ONE panel with its own alternatives; it must contain `figure_recipe.json`, `analysis_plan.json`, and its SVG candidates. Only supply candidates that the upstream scientific workflow has validated for that dataset and purpose. Directory membership is an upstream declaration, not proof that all SVGs share the same data. Unrelated SVGs must be passed as separate panels. Candidate physical canvas sizes and viewBoxes must match within a panel. Different panel slot classes can coexist in the grid without resizing.

The builder packages HTML, CSS, JavaScript, original SVGs, analysis records, and a read-only source CSV/TSV when it is available (up to 2 MB). It checks a recorded source SHA-256 when present. If source bytes changed, regenerate candidates rather than silently accepting a stale figure. The generated page is self-contained: open locally in a current browser, without a server, API key, CDN, or Python session. Treat an HTML/project containing private data as a private research file.

The builder refuses to overwrite an existing file. After the initial page is generated, use the editor's project save/open controls for further work instead of rebuilding every time.

## Interaction contract

1. Select a panel in the left navigation. Click a plot object; Shift-click to select several.
2. Choose the operation scope: selected elements, same-colour elements in this panel, current panel, or whole composite. Same colour is a visual match, not inferred biological identity.
3. Change fill/stroke, opacity, font, point size, or weight. Font and size changes preserve existing italic runs; explicit sub/superscript font-size ratios are retained. Whole-panel colour changes target chromatic elements, preserving neutral axes/backgrounds. Explicit element selection can edit neutral colours too.
4. Select a text object or leaf `tspan` to edit its wording. Mixed-content text must be edited by run; no flattening of formatted scientific annotations. Do not change numeric tick labels to imply an axis rescaling. Axis scale/data edits belong in the source plotting pipeline.
5. Start in “表达探索 / 这组数据，还能怎么看？”. Real SVG alternatives include plain-language explanations of the question each supported family answers and the information it exposes. Hover over a candidate to preview it in the composite, move away to restore, and click to apply. These are upstream-rendered candidates, not stock thumbnails. An estimation plot, distribution plot, ROC, and PR curve can answer different questions: inspect the analysis record before replacing. The editor neither adds new statistical tests nor generates unsupported chart families. “细节编辑” and “配色比较” separate refinements from this discovery step; clicking a plot element opens its detail controls.
6. Preview and apply palettes. The preview reflects the current panel and chosen scope. Categorical colours map by source colour order; verify group semantics across heterogeneous panels. Palettes do not cycle over more categories than available colours. Gradients and large continuous colour maps are excluded. A complementary pair is a design suggestion, not a colour-vision accessibility certificate.
7. Preview master thumbnails (explicit rows × columns, including 3 × 3, 4 × 3, 5 × 3), then click to apply. Set custom rows/columns, spacing, and spanning slots. Empty slots remain available. Enable layout mode and drag an artwork onto another slot to swap, or onto an empty cell to move; dragging navigation entries and explicit target-row/column controls also work. Swapping exchanges complete slots, including their span. “前移 / 后移” changes reading order; visual order numbers are guides, not exported panel labels. Insufficient capacity, collisions, and out-of-bounds moves are rejected. Spans are repacked in reading order when applied.
8. Undo/redo retains up to 80 changes in the current session. Save up to 20 named versions in a single project. A restored version creates a new history step, so restoration itself can be undone. Original SVGs are stored once; state history stores style differences only. Browser auto-save is a convenience, not a substitute for the downloadable project. Browser refresh restores the current state and named versions; it does not retain the complete session undo history.

## Exports and QA

### Physical canvas alternatives

With `--with-layouts`, supported workbench group-comparison recipes prepare original, portrait (3.6 × 4.8 in), and wide (7.2 × 3.6 in) canvases once. The workbench redraws from verified source data and the existing analysis record; two-axis estimation charts stack in portrait. The browser then switches those embedded SVGs without AI or a Python server. Size and chart-family choices are separate. Optional master matching selects an available same-family portrait/wide canvas for a tall/wide slot. Standalone SVGs and other recipe families retain their supplied dimensions. The companion `make-sci-data-figures` skill and its Python dependencies are required only to prepare these variants. Canvas orientation does not swap the data variables or rotate the artwork. Arbitrary millimetre dimensions are still generated in the source pipeline.

Slots expand to accommodate native artwork sizes and centre smaller artworks without deformation; a cross-column slot does not stretch a figure to fill it. Fit-to-window zoom considers both width and height. Layout choices and selected canvas variants are saved with the project and named versions. Element-specific edits stay with their variant; panel/all-scope edits apply to all prepared variants.

Three additional redraws target two-column, two-row, and 2 × 2 slots, calculated from the original panel canvas plus the default 12 pt gutter. Master matching uses these for spanning slots, and swaps adapt only the moved panels. Changing the gutter or making larger spans may leave intentional whitespace; the editor never distorts a prepared drawing to fill a slot. Each redraw is stored once, and history keeps only its index and edits.

- SVG preserves vector geometry and live text where the input has them. Embedded raster layers stay raster. IDs and clip references are namespaced separately for every panel and preview.
- PNG is rendered at pixel dimensions corresponding to 300 dpi at the composite's declared size. Browser PNG metadata can still say 96 dpi; use pixel dimensions plus physical width to verify effective resolution. PNG has a white background and is not editable vector artwork.
- The JSON project contains original assets, current modifications, and named versions. Reload it in Figure Studio. The original Python/R plotting source is not silently rewritten by browser edits.
- PDF/TIFF export, arbitrary SVG stylesheet support, raster OCR editing, live data reanalysis, AI chat inside the page, and semantic regeneration from browser edits are not implemented in this version. Use the original pipeline or a declared external renderer for those tasks. Original AI generation remains available through the existing skill.
- Sanitization permits a restricted static SVG subset. Convert stylesheet-based SVGs to inline styles before importing; external resources, scripts, active content, and remote fonts are not supported. No network requests are allowed by the page's content security policy.
- Treat outputs as edited drafts until existing `check_svg_canvas.py`, `check_svg_editability.py`, accessibility checks, and final-size visual/container QA have been performed. The editor is not a statistical or journal-compliance approval tool.

## Agent handoff

Keep the authoritative data, analysis plan, and recipe beside the source bundle. Deliver the editor page first when manual refinement is requested. When the user returns a saved project or exported SVG, inspect the diff against the original, retain intentional changes, and rerun the existing final delivery checks. Do not regenerate over the user's selected style without checking the saved project.

## Source attribution

The requested Xiaohongshu note is “如何高效拼一张论文组图”, author Sleeping Candidate, observed on 2026-10-11 with relative date “3天前”; exact publication date and full video transcript remain unverified. The readable note identifies Image Layout Manager. Its official documentation describes editable layouts, text matching, and AI/MCP cooperation:

- <https://www.xiaohongshu.com/explore/6ac76c3c000000001303c4ec>
- <https://luojiajiang.uk/image-layout-manager/>
- <https://github.com/zw87652015/ImageLayoutManager>

This implementation is original code built from the user's explicit requirements and the existing suite. The user subsequently clarified that ILM is a conceptual reference, not a repository to distill. No ILM source is copied, no ILM compatibility is claimed, and a full video transcript is not a development prerequisite. See `human_ai_figure_workflow.md` for the user's governing product principles.

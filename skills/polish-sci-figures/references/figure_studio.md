# Figure Studio — official visual editor for polish-sci-figures

Suite v1.4.3 includes the original three skills and the Figure Studio integration. Figure Studio 0.1.3 is the official Windows desktop distribution: it bundles the same local renderers and analysis engine, opens the editor in the default browser, and needs no separately installed Python, Codex, account or activation. Download the installer or complete portable ZIP from the [official project releases](https://github.com/zhoy0409-debug/polish-sci-figures/releases). The project remains MIT-licensed; official branding is not copy protection.

This reference documents implemented behavior. Test and visual-review scope is recorded separately; a listed template is not a guarantee that arbitrary data or labels will fit every output size.

- [Create an editable page](#create-the-editable-page)
- [Interaction and local engine](#interaction-contract)
- [Exports and QA](#exports-and-qa)
- [Statistics](#statistical-method-comparison)
- [Optional examples in papers](#optional-examples-in-papers)
- [Original editable gallery](#original-editable-gallery-2026-10-12)
- [Direct editing, axes and facets](#direct-editing-axes-and-independent-facets-2026-10-12)

## When to use

Use the desktop editor directly to start from a template or imported image, or hand off after `make-sci-data-figures` has produced reviewed candidates. The agent can still complete the original generation/assembly/QA workflow without a manual step. Offer direct editing when the user wants to make their own fine adjustments. Never replace statistical validation with browser styling.

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

### Local data editing and object properties

For table editing and automatic recomputation, run:

```sh
python sci_figures.py studio-serve figure-studio.html --port 8767
```

Open the printed localhost URL. The engine binds only to `127.0.0.1`, checks Host, Origin and a per-process token, and invokes known workbench functions. It never executes submitted analysis code. Standalone HTML supports layout, styling and image import; data recomputation requires this local Python service. The desktop edition starts the bundled service automatically and keeps a stable local browser origin. Closing its browser tab leaves the service running; closing the launcher stops it after accepted work completes. Download project JSON backups because browser storage is separate from application files.

- Data table edits, CSV/TSV replacement and row/column changes are drafts until validation and analysis succeed. Statistics and candidates update together. Invalid drafts preserve the last valid figure and disable figure export. Drafts are included in project downloads and browser autosaves.
- Right-click an occupied panel to replace it, or an empty grid cell to import PNG, JPEG, WebP or sanitized SVG. With the local engine connected, PDF import lets the user inspect and choose a page; PDFium preserves actual text and vector paths while keeping unsupported effects as identified image layers. Replacement appends an immutable asset revision, so undo can restore the previous figure. Raster images remain raster images; their embedded labels cannot be edited separately. Outlined lettering remains vector geometry, and PDF font substitution should be reviewed before export.
- The chart browser shows the highest-ranked 3 or 5 **available, data-backed** alternatives. The full categorized library also describes alternatives requiring additional inputs. Rankings consider the expression goal and available data, never the smallest P value.
- Every library card has a vector preview. The current original gallery contains 218 editable starter templates; available variants use current data and starter cards use explicitly labelled synthetic data. Inserting a starter creates an editable example panel, not an analysis of the user’s data. Input contracts identify required observations or supplied results.
- Drag a selection rectangle, or Shift-click to extend a selection across panels. The marquee previews matching elements while dragging; a separate fine rectangular outline marks each selected element without recoloring the artwork. The selection count reports the affected objects. Canvas gestures suppress native browser text selection, while inspector text fields remain selectable. Selected SVG objects and added text/shapes can move together. Object alignment uses the selected set's bounding box; text alignment controls the text anchor. Locked objects remain fixed.
- Delete selected source SVG elements, added annotations or a selected panel label with Delete / Backspace, the inspector button or the contextual menu. Source-element deletion stores a reversible hidden override; it does not remove the original asset or experimental data. Locked elements remain protected. Inputs, text areas, selectors, editable text regions and IME composition retain their normal keyboard behavior. This command does not delete a panel.
- Properties include final-size stroke width, solid/no fill and text alignment. Hollow bars retain a clickable interior. Bar-workbench error bars support positive, negative and both directions, anchored to the estimate, with matching end caps. This direction control is currently restricted to these semantically identified bars; arbitrary imported error-bar paths are not inferred or rotated.
- Annotation text, lines, rectangles and ellipses are vector objects included in exports. They have independent colour, opacity, stroke width, typography, fill and lock controls.
- Browser persistence uses IndexedDB for asset-bearing history. Saving a project downloads a portable JSON backup, including data drafts and undo history.

The starter catalogue includes 15 empirical ROC/PR views in total and 12 supplied-result ROC layouts. Not every view is interchangeable for one input table. Pointwise 95% bootstrap bands and bootstrap curves condition on fixed prediction scores; they do not represent model-refitting uncertainty or simultaneous confidence coverage. AUC intervals retain the upstream calculation.

1. Select a panel in the left navigation. Click a plot object; Shift-click to select several.
2. Choose the operation scope: selected elements, same-colour elements in this panel, current panel, or whole composite. Same colour is a visual match, not inferred biological identity.
3. Change fill/stroke, opacity, font, point size, or weight. Font and size changes preserve existing italic runs; explicit sub/superscript font-size ratios are retained. Whole-panel colour changes target chromatic elements, preserving neutral axes/backgrounds. Explicit element selection can edit neutral colours too.
4. Select or double-click existing text to edit its wording, or select a character range for bold, italic, subscript or superscript. Existing runs and mathematical positioning remain unless explicitly changed. Manual display changes to statistical text do not overwrite the true analysis record. Do not change numeric tick labels to imply axis rescaling: supported axis controls request an actual source redraw.
5. Start in “表达探索 / 这组数据，还能怎么看？”. Real SVG alternatives include plain-language explanations of the question each supported family answers and the information it exposes. Hover over a candidate to preview it in the composite, move away to restore, and click to apply. These are upstream-rendered candidates, not stock thumbnails. An estimation plot, distribution plot, ROC, and PR curve can answer different questions: inspect the analysis record before replacing. Switching a visual style does not run an undeclared statistical test. Use the explicit local-analysis workflow below when comparisons are needed. “细节编辑” and “配色比较” separate refinements from this discovery step; clicking a plot element opens its detail controls.
6. Preview and apply palettes. The preview reflects the current panel and chosen scope. Categorical colours map by source colour order; verify group semantics across heterogeneous panels. Palettes do not cycle over more categories than available colours. Metadata-backed heatmaps remap cells and colorbars through the same recorded numeric normalization, with sequential or diverging palettes as appropriate. Other continuous maps without this metadata remain excluded. A complementary pair is a design suggestion, not a colour-vision accessibility certificate.
7. Preview master thumbnails (explicit rows × columns, including 3 × 3, 4 × 3, 5 × 3), then click to apply. Set custom rows/columns, spacing, and spanning slots. Empty slots remain available. Grid guides are visible by default and can be toggled; they are editing aids and never enter the exported figure. Use Arrange panels in the canvas toolbar (or the matching sidebar control), then drag anywhere inside an artwork onto another slot to swap or an empty cell to move. In ordinary editing mode, the six-dot grip at the top center of a selected or hovered panel provides the same whole-panel move without changing modes. Navigation-entry dragging and explicit target-row/column controls remain available. Swapping exchanges complete slots, including their span. “前移 / 后移” changes reading order; visual order numbers are guides, not exported panel labels. Insufficient capacity, collisions, and out-of-bounds moves are rejected. Resizing preserves unaffected slots and relocates displaced panels into available cells.
8. Undo/redo retains up to 80 changes, including across refreshes and reopened projects. Save up to 20 named versions in a single project. A restored version creates a new history step, so restoration itself can be undone. Original SVGs are stored once; state history stores style differences only. Browser auto-save is a convenience, not a substitute for the downloadable project. Committed edits schedule local persistence of the current state, bounded undo/redo history and named versions. Refresh restores successfully saved history, including the redo branch. The header reports save failures or conflicting updates from another window; download the project when this happens.

## Exports and QA

### Physical canvas alternatives

With `--with-layouts`, supported workbench group-comparison recipes prepare original, portrait (3.6 × 4.8 in), and wide (7.2 × 3.6 in) canvases once. The workbench redraws from verified source data and the existing analysis record; two-axis estimation charts stack in portrait. The browser then switches those embedded SVGs without AI or a Python server. Size and chart-family choices are separate. Optional master matching selects an available same-family portrait/wide canvas for a tall/wide slot. Standalone SVGs and other recipe families retain their supplied dimensions. The companion `make-sci-data-figures` skill and its Python dependencies are required only to prepare these variants. Canvas orientation does not swap the data variables or rotate the artwork. For the reviewed exact-reflow templates, the local service can also redraw at the current slot dimensions; see the plot-frame contract below. Other recipes use their prepared canvases.

With the local service, reviewed exact-reflow templates are regenerated from their tables for the occupied slot. Other assets retain their prepared or native dimensions and are centered without anisotropic stretching. Fit-to-window zoom considers both width and height. Layout choices and selected canvas variants are saved with the project and named versions. Element-specific edits stay with their variant; panel/all-scope edits apply to all prepared variants.

Three additional redraws target two-column, two-row, and 2 × 2 slots, calculated from the original panel canvas plus the default 12 pt gutter. Master matching uses these for spanning slots, and swaps adapt only the moved panels. For reviewed exact-reflow templates, gutter and span changes request a matching physical redraw. Other prepared canvases can leave intentional whitespace when the slot differs; the editor never distorts a prepared drawing to fill it. Each redraw is stored once, and history keeps only its index and edits.

- SVG preserves vector geometry and live text where the input has them. Embedded raster layers stay raster. IDs and clip references are namespaced separately for every panel and preview.
- PNG defaults to 600 dpi, with 900/1200 dpi options, at the declared publication dimensions. A CRC-checked pHYs chunk records the actual output resolution. Width/height changes lock the aspect ratio and preserve internal geometry; text controls use final printed points. Embedded raster images are checked against their native pixel dimensions; upsampling cannot create detail. Browser canvas capacity failures do not silently lower the requested resolution. PNG has a white background and is not editable vector artwork.
- The JSON project contains original assets, current modifications, undo/redo history, and named versions. Reload it in Figure Studio. The original Python/R plotting source is not silently rewritten by browser edits.
- PDF export, arbitrary SVG stylesheet support, raster OCR editing, AI chat inside the page, and fitting arbitrary upstream statistical models are not implemented in this version. Use the original pipeline or a declared external renderer for those tasks. The local service supports the documented table-driven redraws and four declared comparison methods below. Original AI generation remains available through the existing skill.
- Sanitization permits a restricted static SVG subset. Convert stylesheet-based SVGs to inline styles before importing; external resources, scripts, active content, and remote fonts are not supported. The served editor permits its authorized local engine; it does not load chart dependencies from a remote CDN.
- Treat outputs as edited drafts until existing `check_svg_canvas.py`, `check_svg_editability.py`, accessibility checks, and final-size visual/container QA have been performed. The editor is not a statistical or journal-compliance approval tool.

## Agent handoff

Keep the authoritative data, analysis plan, and recipe beside the source bundle. Deliver the editor page first when manual refinement is requested. When the user returns a saved project or exported SVG, inspect the diff against the original, retain intentional changes, and rerun the existing final delivery checks. Do not regenerate over the user's selected style without checking the saved project.

## Source attribution

The requested Xiaohongshu note is “如何高效拼一张论文组图”, author Sleeping Candidate, observed on 2026-10-11 with relative date “3天前”; exact publication date and full video transcript remain unverified. The readable note identifies Image Layout Manager. Its official documentation describes editable layouts, text matching, and AI/MCP cooperation:

- <https://www.xiaohongshu.com/explore/6ac76c3c000000001303c4ec>
- <https://luojiajiang.uk/image-layout-manager/>
- <https://github.com/zw87652015/ImageLayoutManager>

This implementation is original code built from the user's explicit requirements and the existing suite. The user subsequently clarified that ILM is a conceptual reference, not a repository to distill. No ILM source is copied, no ILM compatibility is claimed, and a full video transcript is not a development prerequisite. See `human_ai_figure_workflow.md` for the user's governing product principles.


## Language, personal preferences, and discovery

Choose 中文 or English in the header. The UI initially follows browser language and remembers the explicit choice. Interface translation never rewrites figure labels, data, project names, or saved version names.

Personal preferences are local to this browser and origin. Intentional project saves and named checkpoints teach palette, typography, chart, canvas, and layout preferences. Autosaves and repeated saves of an identical project state do not add preference counts. Suggestions appear after repeated choices and require explicit application; scientific suitability and the actual available candidates still constrain chart suggestions. Pause learning, clear preferences with two clicks, or restore the just-cleared preferences during the same session. This is not an account or cloud-sync system. Clearing browser storage removes local memory and autosaves; downloadable projects remain the portable backup.

The bilingual candidate explanations in `assets/figure-studio/discovery.js` describe implemented upstream variants. Expand this curated library as part of future development, using `chart_discovery_curation.md`; it does not run background research or generate arbitrary charts. The suite catalog's 124 audited templates are not 124 universally interchangeable chart types.


## Wide panels occupy multiple cells

A 3 × 3 master specifies nine layout units, not a requirement for nine images. Eight panels fit with one spanning two columns. A large microscopy panel or dense plot may occupy three columns or a full row. The new slot shortcuts preview these placements before applying. Slot resizing preserves unaffected positions and relocates displaced panels into available cells; insufficient capacity is rejected without losing panels. Undo restores the complete prior arrangement.

Wide canvas choices now also reserve two columns; the three-column redraw reserves three. Supported workbench sources supply a true three-column canvas, preserving font sizes rather than stretching content. Existing standalone SVGs can occupy spanning slots but retain their native artwork dimensions. Larger slots do not invent new detail or perform raster reconstruction. Added demo variants are appended to existing assets, preserving prior variant indices and local history.


## Direct manipulation and publication details

Layout mode exposes right/bottom/corner handles. Drag to reserve whole cells; previews show valid placement in muted blue and invalid placement in muted red, with Move here, Swap panels or Cannot place here feedback. Pointer release records one undo step. Data-supported variants redraw their axes and marks; unstructured imported SVGs keep native geometry. Wide/three-column workbench bars cap default physical bar width and offer width and between-group spacing sliders. This initial single-factor renderer has no within-group multi-series spacing control. Shared typography uses physical point sizes; explicit object edits remain overrides.

Shift-select panels in the navigator (or layout canvas) to group them; panel groups translate together into unoccupied cells. Element groups provide joint selection and styling, not arbitrary geometric transformation of internal chart elements. Lock panels or selected objects to protect them from applicable edits; unlock explicitly. Groups/locks, geometry, labels, and scales are saved in history. Fixed cells are not a pixel-position lock against a global gutter change.

Formal panel labels support uppercase/lowercase letters or numbers, custom text, font, size, weight, percentage position, and direct dragging. Automatic labels follow occupied slots from left to right and then top to bottom, including after a move or swap. Editing a label's text marks it as a manual override; moving the panel preserves that text. Disable automatic numbering to freeze current labels, or use Restore automatic numbering to reset manual overrides explicitly. A single click selects the label and opens its controls; a double-click focuses the text field. Dragging preserves the pointer offset and records one undo step. Labels export with the figure. Labels burned into raster images are not separate editable objects.

Scale bars attach to a selected unrotated raster image within SVG. The user supplies that image's full-field physical width in micrometres and desired bar length. Length is proportional to the image width; thickness, corner, font, weight, and translucent white background are editable. No calibration is inferred from pixels, and existing burned-in scales are not removed. Cropping and arbitrary rotated/complex transformed image workflows require renewed calibration/QA; no whole-slide metadata reader is implemented.

Gutter controls offer a live slider, precise 0–100 pt input, and restore-first-draft button. The current builder uses a 12 pt initial gutter, not an automatic journal-specific layout optimiser. The preparing agent should review the first draft and tune its initial state to the intended output dimensions.

## Statistical annotation styles

For the data-supported mean-bar view, switch recorded comparisons between bracketed stars, bracketed hashes, numeric italic P labels, and letter groups. Numerical values and comparison identities are not recalculated by a style switch. A two-group primary comparison can be reused directly. Multi-group input needs `analysis.pairwise` records `{a: zeroBasedGroupIndex, b: zeroBasedGroupIndex, p: reportedPValue}` plus the analysis method and multiplicity description in the analysis record. The preparer must use the intended raw/adjusted P values consistently. Global ANOVA P values do not become pairwise results.

Letter grouping requires a complete matrix. It uses maximal non-significant comparison cliques to produce valid shared-letter assignments (not necessarily a minimum-letter solution). Shared letters indicate failure to detect a difference at alpha 0.05, not equivalence. Stars/hashes use strict thresholds 0.05, 0.01, 0.001, 0.0001; these are explicit conventions, not a claim of compliance with every journal. Extra vertical space is reserved for annotations so the source graph is not squashed. Reference: https://rvlenth.github.io/emmeans/reference/CLD.emmGrid.html

## ROC discovery expansion

The empirical starter set includes ROC, PR, area fill, threshold points/colour/labels, exploratory Youden, pointwise bands, direct labels, bootstrap curves, AUC forest, log-FPR, confusion counts, score distributions and sensitivity/specificity versus threshold. These use supplied observations/cohorts; bootstrap AUC intervals reuse the original analysis. Equal scores are aggregated at common thresholds; tied-score ordering no longer changes AUC.

The additional 12 result-driven templates cover partial AUC, convex hull, probit display, cost-based decisions, smoothing, cutoff intervals, cross-validation, subgroups, training/validation, multiple models/classes, time-dependent ROC and SROC. They render explicitly supplied results; a display card does not fit the corresponding model. Neither illustrative reference images nor synthetic demos replace the required observations or computed results. Primary references: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.roc_curve.html and https://scikit-learn.org/stable/auto_examples/model_selection/plot_roc_crossval.html


## Statistical method comparison

The method explorer compares the existing primary and sensitivity results in the source analysis package, including the original mean effect/CI where provided. Recommendation order is conditional on the selected mean-versus-rank/distribution target, never the size of P. This is an initial decision aid, not an automatic comprehensive model-selection system: independence, pairing, covariates, hierarchy, and estimands need study-context confirmation. Existing source diagnostics and records remain available. Missing effect intervals for rank methods are stated rather than borrowed from mean contrasts.

Selection requires a rationale, is reversible/persistent, clears added statistical annotations for reconfirmation, and is embedded with the selected result in exported SVG description metadata. Two-group added annotations then use the selected computed test. Multi-group global tests cannot generate pairwise letters. Mean-based plot summaries remain descriptive means; selecting a rank test does not turn them into rank-effect intervals. Switching away from the primary test is blocked if the original artwork already embeds its P value; regenerate upstream first.

The existing primary/sensitivity explorer remains distinct from the local-analysis workflow below. ANCOVA, mixed models, general-purpose permutation models, robust estimators, categorical models and survival-model fitting still require their upstream analysis. Bounded permutation P values used within the supported rank tests are part of those tests, not a general model-fitting interface. Do not encourage method selection after inspecting which method produces significance.

### Analyze observations or connect comparison results

In the current source (14 October 2026), statistical presentation styles and condition-table controls have a single home in **Annotations**; the panel context-menu shortcut opens that section. The analysis dialog accepts the current table, an external raw CSV/TSV, or an existing comparison-result table when results are missing. Selecting a presentation style after a valid analysis changes its display without rerunning the test.

Grouped observations (`grouped_observations`) and faceted boxes (`compare_facet_boxes`) carry explicit group/facet identities so each comparison is drawn above its corresponding source artists. Anchors follow spacing, data redraws, font size and panel dimensions; large labels can use staggered rows with additional headroom. Generated lines and text remain individually editable and movable. Unsupported or ambiguous group geometry retains the named-result-area fallback; continuous axes do not acquire categorical brackets merely because comparison results exist. These are source-version changes, not a new installer-release statement.

For raw observations, the user must confirm independent or paired design, identify the genuine independent experimental unit, and map group and numeric outcome columns. The design is not selected automatically. A facet and an explicit column/value row filter are optional. Technical repeats must first be handled at the real experimental-unit level or by an appropriate upstream hierarchical analysis; unique row numbers alone do not establish independence. The local engine rejects duplicate unit/group/facet records, independent units reused across groups, incomplete pairs and missing/nonfinite values rather than silently deleting observations. Paired records are joined by unit ID. Constant data that make a test undefined produce a specific explanation.

The supported methods are:

| Declared design | Method | Interpretation |
| --- | --- | --- |
| Independent | Welch two-sample t | Difference in group means without assuming equal variances |
| Independent | Mann–Whitney U | Distribution/rank comparison; not generally a test of medians |
| Paired | Paired t | Mean within-unit difference |
| Paired | Wilcoxon signed-rank | Signed ranks of within-unit differences; a location interpretation requires symmetric differences |

Recommendations follow the declared design and mean-versus-distribution goal, not significance. Small tied-sample rank tests use fixed-seed bounded permutations where needed; ordering the table does not change these seeded results. All tests are two-sided. The comparison family is either all pairs or each group against a declared control. One Holm adjustment covers every requested comparison across all facets; the displayed facet results remain separate and do not imply cross-facet comparisons. Compact letters require a complete all-pairs family. A global ANOVA or other omnibus P value cannot generate pairwise annotations. T-test intervals describe unadjusted pairwise 95% uncertainty and are not borrowed for rank methods or presented as simultaneous intervals.

For an existing result table, map the two group columns and numeric P column, optionally a facet column, and declare the method and comparison family. Confirm whether values are raw or already adjusted. Choose Holm for raw P values; already-adjusted results require the actual correction method and are not adjusted again. An unadjusted import is limited to one comparison. Duplicate comparisons or an incomplete declared family are rejected. Existing values are preserved; the editor does not derive a missing P value from a plot, reference image or significance symbol.

Current-table analyses are bound to their data revision. Changing that table sends the saved configuration with the redraw request, and commits the new figure and new results together. An invalid analysis leaves the last valid figure intact. External observations and imported comparison results retain their source table and declaration in project state; after the plotted table changes, their old results become stale and disappear from the automatic annotation display until reconnected. Undo/redo restores the matching figure and analysis state. Existing authoritative plot-analysis records remain separate from these added comparisons.

The service accepts `POST /api/analyze` with `{recipe, rows, config}` and returns `{analysis, config, data_sha256}`. `POST /api/render` accepts optional `statistics: config` and returns the recalculated object as `panel.statistics`. The hash uses canonical UTF-8 CSV serialization of the supplied rows, so it need not equal the byte hash of an older LF/CRLF source file. The confirmed configuration records the unit, design, mappings, method, family and any filter. Current limits are 10,000 observations, 10 groups per facet, 12 facets and 120 comparisons, with an additional cap on permutation work. Neither endpoint executes submitted code or contacts an external analysis service.

PCA mixed score/loading tables require an explicit `role = score` filter. Comparing a score coordinate tests only that coordinate; it is not a test of overall PCA separation. SHAP, fitted-model and other result-based templates continue to require their documented upstream results. A visual template alone does not make its rows independent observations.

For layouts without reliable category anchors, named result areas preserve the original plot geometry and identify the comparison groups. Direct above-axis placement for single-/multiple-facet categorical layouts is being checked separately; consult the validation log for the exact browser-tested geometries. Current browser confirmation includes raincloud analysis and changed-data recomputation, generated text at 24 pt, PCA score-only letter presentation, and stale imported-result removal after a plotted-data change.

Method references: [Welch t-test](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ttest_ind.html), [Mann–Whitney U](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mannwhitneyu.html), [paired t-test](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ttest_rel.html), [Wilcoxon signed-rank](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.wilcoxon.html), [Holm multiple-comparison adjustment](https://www.statsmodels.org/stable/generated/statsmodels.stats.multitest.multipletests.html).

## Optional examples in papers

The current source adds **Chart types → Examples in papers**. Search is opt-in: only **Find examples** (or submitting that search field) starts a Europe PMC request. The query contains controlled chart-type terms and an optional manually entered topic, never table values, images, project text or source files. The editor checks available full-text figure captions for those chart terms. Only a matched caption produces a figure label/link; a current compatible local candidate is additionally required for **Preview with my data**. Unverified hits remain paper-level information. Preview uses the current data, and applying a candidate is undoable. A caption match does not validate the paper's design or statistical method for the user's data. A failed or offline search leaves local editing and analysis available. See the [English](../../../README.en.md#examples-in-papers) and [Chinese](../../../README.zh-CN.md#文献作图实例) user guides.

## Local collection and reusable edit presets

The collection stores project assets and edit/history payloads in IndexedDB. Opening the collection adds or updates the current project by ID; subsequent edits update its registered entry. Thumbnails open a figure for refinement. Import multiple project JSON files or export/import a collection backup. Existing local IDs are retained on import rather than silently overwritten. Archive/unarchive is reversible. Storage is local to this browser origin, not an account or cloud service.

A preset retains the full source-state snapshot. Exact restoration is available in its source project. Pasting onto a different project matches panels by reading order and transfers supported palettes/opacity, text roles, bar geometry, label appearance, scale-bar appearance and eligible annotation presentation. Matching panel counts allow layout transfer; incompatible layouts and locked panels are not forcibly overwritten. Data, text contents, chosen statistical method/results and physical image calibration/scale length remain those of the target. Arbitrary SVG element IDs are not portable semantic identities. Review category-color correspondence after transfer. Imported raster/path-only artwork does not acquire editable text or data semantics.

## Plot fitting, annotations and typography

The reviewed plot-frame contract currently covers 27 views: 25 gallery templates and two empirical ROC views. The local engine redraws these views from their tables at the slot's actual physical dimensions. Primary plotting frames use 60 pt left, 44 pt right, 56 pt top and 42 pt bottom margins, so matching panel boundaries share plotting baselines. Fonts, markers and line widths retain physical sizes. Compound charts explicitly place their auxiliary axes; the PCA density strips sit outside the main frame, and equal data units are preserved by extending axis limits. This alignment review does not cover all 191 gallery templates. Other supported legacy SVG fitting and prepared-canvas paths remain separate, and unstructured imports retain their native geometry.

Statistical letters anchor above each group's observed/error-bar extent; bracket levels anchor above the data, with physical spacing. Dense comparison sets reserve additional room and minimum row height. Generated annotation objects are excluded from source-element edit IDs; panel-wide font changes update their separate font settings. Font inputs preview on input and commit on Enter/blur, with a visible count of applicable text objects. Unifying typography clears conflicting unlocked font overrides, while preserving run-level italics and size ratios. Selected-text changes can span panels: the inspector applies font settings to the actual selected text set. Color controls include compact muted blue, red, slate and neutral swatches, recent colors, a custom picker and validated HEX input. A fine border and contrast-aware check mark indicate the selected swatch. Default swatches never recolor an existing figure, and recent user colors retain their values. These are original controls informed by general editor conventions, not copied Adobe assets.

## Editor feedback and reviewed interaction cases

Hold Alt while scrolling over the canvas for continuous 10%–400% preview zoom around the pointer. Ctrl-wheel trackpad pinch gestures use the same canvas zoom. An unmodified wheel scrolls normally. The zoom selector shows the current percentage and retains Fit to window. Zoom updates the existing SVG's CSS dimensions and viewport scroll offsets in animation frames; it does not regenerate plots, add an undo step or change publication/export dimensions. At scroll boundaries, the viewport clamps to the available canvas extent. Existing selection outlines refresh independently of the chart, retaining 2 px padding; starting a canvas selection cancels a queued zoom before selection geometry is captured. Window resize recomputes Fit to window while preserving a fixed zoom choice.

Enabled buttons, tabs, selectors, inputs, summaries, interactive cards, sliders and checkbox/radio labels have restrained blue-gray hover, pressed or selected feedback as applicable. Keyboard focus remains visible. Feedback changes paint rather than control dimensions; reduced-motion preferences suppress transitions. Disabled controls retain their unavailable state. These shared CSS rules establish the interaction vocabulary; they are not a claim that every control has been manually exercised in every browser.

Whole-panel dragging uses a 3 px movement threshold. A simple click, release in the original slot, out-of-canvas drop or cancelled gesture leaves history unchanged. Preview candidates are computed once per target cell, not once per pointer pixel; moving the pointer does not regenerate the charts or rebuild the inspector. Successful movement commits one history step and renders once. Pointer capture loss, released pointer buttons, Escape, window blur and a canvas repaint cancel an active panel gesture. Cancelling a native navigator drag clears its drop preview. Selecting or moving a whole panel restores the Panel property scope, so a previous element selection cannot silently disable subsequent edits. Clicking a resize handle without changing its span preserves explicit row heights and column widths.

The selection tool shows a crosshair; whole-panel grips and movable objects show an open hand, active moves a closed hand, and invalid panel destinations an unavailable cursor. Selection and Arrange panels are mutually exclusive. Editor grips, target previews and guides are omitted from figure export.

`test_studio_panel_drag.cjs` executes production pointer, native-drag and mode handlers in a Node DOM mock. It checks occupied-slot swaps, empty moves, spanning-slot exchange, locks, property/data preservation, automatic visual numbering, undo/redo, direct grips, annotation/label routing in Arrange mode, same-cell caching, cancellation and no-op track-size preservation. These are functional script checks; the main thread records native-browser cases separately.

Selection can start in the gray workspace and cross into the figure. The selection tool uses a crosshair throughout that workspace; its rectangle is clipped to the visible workspace, and each matching object receives its own preview outline. Releasing the pointer changes candidate outlines into the final selection. Shift extends the selected set, including a mixture of chart elements and inserted annotations. After a marquee selection, the next ordinary click anywhere in the central workspace clears that selection without immediately selecting a different object. A subsequent click selects normally. Blank-space clicks also clear ordinary selections; dragging a selected object still moves it. Selection and deselection do not alter figure data or add history steps. Scrollbars, toolbar controls and ordinary wheel scrolling retain their normal behavior. Scrolling or losing pointer capture cancels an unfinished marquee, preventing stale hit coordinates.

`test_studio_workspace_selection.cjs` executes the production viewport/SVG pointer handlers, hit testing, preview drawing and selection finalization in a bounded Node DOM mock. It covers gray-origin selection, animation-frame coalescing, final outlines, deselection and delete-button state, Shift/mixed annotation selection, scrollbar and toolbar exclusion, cancellation, clipping and retained element dragging. This is a script check, separate from native browser validation. In the main thread's browser check, a gray-origin drag selected exactly five vertical-axis values; a second case selected those five plus the axis title. Gray-space and figure-interior clicks cleared the chosen classes and all element outlines and disabled Delete. Native browser text selection remained empty. Evidence: `.cache/viewport-selection-proof.png`. These cases do not certify every imported SVG structure.

`test_studio_zoom_events.cjs` executes the actual wheel, zoom-selector and pointer-down handlers in a bounded Node DOM mock, including animation-frame coalescing, ordinary-wheel pass-through, active-drag protection, dynamic percentages and fit-on-resize calculations. It also checks outline geometry at 10%–400% zoom. This is event-handler simulation; native browser Alt-wheel and touchpad-pinch behavior has not been exercised by the available browser automation.

For older projects, unchanged labels are identified against the same panel in `project.initialState` and can follow automatic numbering; changed legacy text is retained as a manual override. This migration includes undo states and named versions. `test_studio_delete_labels.cjs` checks source hiding, lock protection, undo/reopen, keyboard guards, legacy-label migration and the complete pointer-down/up/click/double-click sequence, including capture-target retargeting, in Node mocks. Native pointer verification is tracked separately.

The recorded browser check selected five vertical-axis numbers in panel A and changed only those five to 12 pt. Shift-clicking Feature 1 in panel B extended the selection to six text objects; setting 10 pt updated all six, and one undo restored the preceding values together. Native browser text selection remained empty during the canvas gesture. This verifies that specific cross-panel workflow, not every possible imported SVG structure.

The alignment script measured 36 original/edited, normal/wide cases across nine representative views against the physical frame contract, with no failures. The exact-reflow backend report contains 83 successful rendering checks across the 25 reviewed gallery templates and two ROC views, 49 rejected invalid-input cases and 12 HTTP checks. The reports are `.cache/composite-alignment-qa/measurements.json` and `.cache/studio-reflow-qa/report.json`; the browser selection proof is `.cache/marquee-axis-font-proof.png`. These checks complement final-size visual review rather than replace it.

## Insert rows and columns

Right-click a canvas cell or use Insert rows / columns. Enter a positive integer, then choose above/below/left/right. Insertion preserves downstream order and existing physical track sizes, expands spans crossing the insertion, and shifts downstream panels. A change affecting a locked panel is rejected. It is one undoable operation. Current validated grid limits are 24 rows and 6 columns, shown as remaining capacity in the dialog; these are implementation limits, not a fixed master layout. Choosing a new master can reset explicit track sizing.

## Contextual shortcuts

Right-click selects the clicked panel or source element, retaining an existing multiple selection when applicable. Contextual color, typography, chart previews, spans, labels, statistical annotations, scale bars, group/ungroup, lock/unlock and undo/redo reuse the sidebar controls and history. Detail actions open and focus the existing inspector; unavailable actions are disabled. Empty grid cells retain insertion and history actions. Both entry points support Chinese/English.


## Original editable gallery (2026-10-12)

The gallery provides 218 editable starter templates: 191 table-driven gallery layouts, 15 empirical ROC/precision–recall views and 12 supplied-result ROC layouts. The 187 entries in `chart_gallery.zip` and all 100 chart entries in the older 102-card collection now map to an implemented renderer. Two older cards describe palette and colormap principles; they remain design guidance for the color editor. Multiple references can map to one template. Reference artwork and third-party scripts are not embedded or executed.

The central `gallery_registry.py` registers declared input contracts, bilingual descriptions, fixtures and explicitly reviewed compatible alternatives. Matching column names alone does not establish that another chart is scientifically applicable. Each starter creates an undoable synthetic-data panel and opens its editable table. Current-data previews only use successfully generated alternatives. Gallery previews and inserted panels use the same renderers and palette, not a separate decorative thumbnail implementation.

For AI-assisted preparation outside the editor, run `python skills/make-sci-data-figures/scripts/gallery_cli.py --list` to inspect the bilingual contracts. Generate an editable bundle with `--view TEMPLATE --input TABLE.csv --out NEW_DIRECTORY`, then open it with the existing studio command. Select a template only after confirming its experimental-unit, variable and supplied-result meanings.

Coverage includes distributions and effect estimates, relationships and model diagnostics, longitudinal and compositional displays, survival and meta-analysis, multi-omics, genomic tracks, networks and model explanations. Supplied-result templates (for example, SHAP, nomograms, STL decompositions, mixed-model intervals and diagnostic meta-analysis) visualize declared analysis outputs. Editing their table does not fit the upstream model. Raw-observation templates compute only their documented descriptive quantities or fitted summaries. No statistical result is inferred from a reference image.

Every gallery template and selected ROC view has seven physical canvas sizes, generated by rerendering axes, legends and layout. Geometry-sensitive views preserve equal units or native shape geometry. The editor selects the corresponding canvas for one-, two- and three-column spans; it does not anisotropically stretch an SVG to simulate reflow. Changing the candidate prepares its responsive canvases. Replacing data preserves the selected view, span and transferable appearance, and creates an undoable asset revision. Rapid candidate changes cannot allow an older rendering response to overwrite the latest selection.

The automated checks cover all template contracts, original and changed data in four aspect ratios, vector output and text bounds. `test_gallery_registry.py --engine` exercises every gallery template through the actual data engine in seven sizes. `test_reference_catalogue.py` verifies reference coverage and that every starter has an original vector preview. Rendered contact sheets and the browser editor still require visual review: geometric bounds alone do not establish good composition. Browser checks cover gallery insertion, candidate changes, Enter-to-commit data editing, resizing and undo. Unsupported or invalid input retains the last valid figure and reports the contract error.

ROC result templates require their computed coordinates, intervals and method metadata. Survival ROC and pooled diagnostic models cannot be derived from an ordinary binary ROC table. Smoothing is a model choice and can change AUC. Youden and confusion-matrix layouts reserve a separate result region rather than placing summaries on top of the curve. Threshold facets share one numerical color scale. Bootstrap displays distinguish internal fixed-prediction resampling from model refitting.

Selections apply immediately. Text/numeric edits commit on Enter or blur; supported sliders preview while dragging and commit one undoable operation. There is no additional Apply step for typography, color, stroke, panel spans, grid settings or overlays. A data edit triggers local regeneration; invalid drafts retain the last valid chart.

Every rendered gallery card offers an enlarged vector preview with its data provenance and input requirements. Inspecting this view leaves the current project unchanged; close it to return to the same gallery search. This keeps small card dimensions from hiding the structure of complex plots.

Layout thumbnails use neutral gray surfaces and muted blue emphasis, with numerical labels centered in each occupied rectangle including spanning panels. Plot data colors remain independent of this interface styling.

Raincloud and violin previews now use 256-point Gaussian KDE outlines with Scott bandwidth and tails extended by three kernel bandwidths. The density estimate can extend beyond observed values; plotted observations and quartiles remain unchanged. Constant samples omit the density rather than inventing a shape. See the [SciPy gaussian_kde documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.gaussian_kde.html) for the bandwidth definition. Rainclouds separate raw points, quartile summaries and half densities; violins use narrower outlines and lighter fills.

Enrichment bubbles and threshold-colored ROC previews use a palette-linked sequential light-to-dark scale. Threshold facets share a numerical normalization and one horizontal colorbar. Existing saved SVG assets are retained as versioned resources; use Data table → Recompute now to regenerate from the unchanged table with the current renderer. This is an undoable asset revision, not an automatic overwrite of saved designs.


## Direct editing, axes and independent facets (2026-10-12)

The canvas toolbar provides text/shape insertion, alignment guides, alignment, final-size typography, character formatting, colour and deletion. Text placement is armed first, then a canvas click opens an inline editor. Shapes can be placed by dragging. Enter finishes text, Shift+Enter inserts a line break, and Escape cancels. Double-click vector text to edit it in place. The character editor supports selected-range bold, italic, superscript and subscript while retaining unaffected math spans. Changing generated statistical text is recorded as a manual annotation override; it does not alter the analysis result.

Horizontal and vertical editor alignment guides are individually movable/removable, have no fixed count limit, and can be cleared together. They are excluded from figure exports. Moving selected objects shows alignment feedback against other objects, panel frames and these guides; Alt bypasses magnetic snapping. Data-coordinate reference lines are a separate chart setting: choose horizontal/vertical value, dashed/dotted/solid style, width and colour. They do not extend axis ranges or change data, and nonpositive positions on logarithmic axes are rejected.

Supported Cartesian templates expose axis limits and signed first-group spacing. A negative gap can move the vertical axis into the categorical plotting region; negative outcome values require a corresponding y range and are not inferred from the gap. Bars retain their zero baseline semantics. Optional group-condition rows align +/−, doses or other entered values with categorical group anchors. They are enabled separately according to the chart’s experimental meaning, not attached automatically to negative-value charts. Numeric axes do not receive a fabricated group-condition table.

Properties → Group spacing is a separate display control for reliably identified categories. It moves horizontal or vertical category groups, including their marks, intervals, labels and supported comparison annotations; paired/interaction lines retain response coordinates. Cumming observation/effect rows share the same category displacement. Canonical workbench bars use this same control at 65%–105%, while bar width remains independent. One gesture creates one history step. Numeric axes, adjacency-dependent matrices and insufficient-space cases are not coerced into categorical movement. The dedicated test covers 107 SVG fixtures across 59 chart types, rather than claiming that every catalogue template supports this operation.

The two workspace separators resize the left navigator, canvas region and right inspector. Width preferences survive reload and narrower-window excursions; double-clicking a separator restores its default. Built-in bilingual panel names and project titles follow the language switch, including regenerated revisions; custom user names remain user text. Layout-card labels wrap within their cards.

For a `compare_facet_boxes` panel with 2–6 factor levels, Chart types → Split facets into panels creates independent panels across consecutive horizontal grid cells. Existing panels and physical tracks are preserved. The operation, including inserted resource revisions, is undoable as one action. Child panels share the original y-axis range and retain their facet identity. Existing statistics preserve the complete original comparison family and its adjusted P values. Editing a child table makes the connected result snapshot stale until the original-family results are reconnected; splitting does not silently redefine the tests.


### Keyboard fine positioning

With canvas objects selected, arrow keys move them by 1 pt in the final exported figure; Shift+arrow uses 10 pt and Alt+arrow uses 0.1 pt. This applies to selectable source vector elements, generated statistical annotations, group-condition text, panel letters, inserted text/shapes and manual alignment guides. Multiple objects move together and locked objects stay fixed. Arrow keys retain normal behavior inside text/numeric inputs and IME composition. Panel-arrangement mode uses its existing grid interaction instead.

Holding an arrow previews movement without redrawing the whole figure and becomes one history step on release or blur. Escape cancels the active gesture. Alignment hints remain visible, but fine positioning is not magnetically snapped back to a nearby object. The unit is independent of preview zoom and accounts for the chosen publication export scale.

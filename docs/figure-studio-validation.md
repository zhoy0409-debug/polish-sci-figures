# Figure Studio validation record

Updated: 2026-10-12. This is a chronological record of source, browser and template checks for suite v1.4.0 / Figure Studio 0.1.0. Early sections describe the initial preview and retain their original scope; later sections record subsequent implementation and checks. They are not an all-template, all-browser visual certification. Release packaging and distribution details are separate in [the v1.4.0 release notes](release-v1.4.0.md) and [desktop build guide](../desktop/BUILD.md).

## Initial preview checks — 2026-10-11

- Six Python packaging tests: complete offline HTML, safe JSON embedding, overwrite refusal, original asset preservation, source hash mismatch rejection, candidate canvas mismatch rejection, required analysis/recipe declarations, physical units, and XML entity rejection.
- Node history/state tests: independent snapshots, undo/redo, discarded redo branches, bounded history without copied SVGs, invalid edits, invalid layouts, and complementary colour conversion.
- Existing unified CLI behavioral tests pass.
- Release archive extraction test passes, including editor assets and building a standalone HTML editor using the extracted CLI. Skill folder validation passes.
- Browser on the current Windows host: actual SVG candidates rendered; selecting an axis title and changing size from 12 to 18 pt, undoing to 12, and redoing to 18 verified in the rendered element. Font/size changes are one undo step.
- Candidate replacement and palette application verified on the real synthetic workbench outputs. In the revised discovery view, selecting the estimation graphic added the actual effect-size axes; clicking a label opened the detail pane and a 14 pt edit was verified.
- Opacity changed on a selected text element; UI and rendered SVG both reflected the change. Colour/opacity input handlers support local preview without an AI call; candidate/palette hover preview uses a transient state, with explicit click to commit.
- Named version save, project download, text editing, project reimport, and restoration of the original label verified. Browser error/warning log empty during these checks.
- Actual SVG and PNG were downloaded through the UI. SVG automated QA reported no blocking findings, live editable text, and no raster layers in the tested composite. PNG was inspected visually and had the expected 2931 × 2210 pixel dimensions for approximately 300 dpi at 248.073 mm width.
- DOM audit of the revised page: 633 unique SVG IDs out of 633; zero unresolved `use` references. Preview SVGs do not share conflicting clip/marker IDs with the composite.

## Scope and limits

The demo uses synthetic data. The independent, paired, and multigroup candidates were freshly generated from current repository examples because an older checked-in example's recorded data hash did not match the current file. Existing example files were preserved. ROC/PR previews use the existing atlas assets.

The tested browser is the current Codex in-app browser on Windows. Other operating systems, browsers, very large figures, complex third-party SVGs, mixed script fonts, and all scientific families were not exhaustively tested. The page uses standard browser APIs and no additional runtime libraries, but that is not a claim of completed cross-platform visual testing.

Automatic SVG QA does not approve scientific meaning, collision-free final placement, colour-only encoding, glyph coverage, or journal compliance. The demo preserves each source panel's physical size; it does not implement plot-area reflow. Its 248 mm composite is a functionality demonstration, not a prescribed journal width.

Original AI generation remains available. Manual edits are kept in a separate project; the next AI step must inspect those choices and run final QA. Live in-page AI/MCP control, automatic Python/R source rewriting, automatic generation of additional chart families, PDF export, and editable raster text are not part of this preview.

## Reproduce

```sh
python skills/polish-sci-figures/scripts/test_figure_studio.py
node scripts/test_studio_state.cjs
python test_sci_figures_cli.py
python scripts/test_release_bundle.py
python scripts/validate_skill_structure.py
python sci_figures.py studio path/to/reviewed-candidates panel2.svg --out figure-studio.html
```

On a restricted host where the system temporary directory is not writable, use a permitted workspace temporary directory for Python's test harness. This environment issue is separate from test assertions.

## Layout update — 2026-10-11

The new `layout-studio.html` adds row/column master previews, spanning slots, pointer dragging on the canvas, navigation drag/drop, direct row/column placement, and per-family canvas alternatives. The original limitations above describe the initial preview: supported workbench bundles now redraw portrait, wide, two-column, two-row, and large canvases from verified source data. Other SVG inputs retain their physical dimensions.

- Seven Python tests pass, including real redraws, unchanged source bundle hashes and unchanged analysis records.
- Node tests cover 15-panel 5 × 3 placement, capacity rejection, spanning swaps, empty moves, self-drop, overlap/bounds rejection, and undo/redo without asset duplication.
- Current Windows browser: an actual pointer drag swapped the first and fourth panels; undo restored them. Five-row/three-column master selection, tall/wide master matching, explicit row/column swap, and undo verified through visible UI state.
- SVG exported while layout guides were active passed physical-canvas and editability checks: 248.073 × 282.787 mm, 45 live text elements, no embedded raster. Guides and temporary order numbers are excluded from export. Browser error/warning log was empty during these checks.
- Suite archive extraction, CLI, and skill-structure checks passed. No claim of cross-platform visual completion, journal-ready typography for every arbitrary dataset, or automatic evidence-group arrangement.

The two new TomatoSCI links were inspected only to the extent available in the browser: title, author, text and cover images. Full video playback and before/after transformations were not available. Evidence-group design principles are explicitly recorded as our inference from the user's requirements and visible material, not a verified video transcript.


## Bilingual interface, local memory, and recovery (2026-10-11)

- Browser checks: English interface and candidate descriptions; project/scientific labels retained; explicit language choice survived reload.
- Changed gutter with keyboard input, reloaded, undid, reloaded again, and redid: saved edits and both history directions survived. Named checkpoints restored in the UI.
- Two distinct intentional checkpoint states produced preference suggestions; saving the same state again did not increase the count. Autosaving did not count as preference approval.
- State tests cover persisted undo/redo, invalid histories, preference deduplication/pause/clear/restore, bilingual UI keys, and bilingual discovery metadata. Seven builder tests and release-bundle tests passed.
- The embedded browser's native confirmation dialog blocked further interactions during preference-clear QA. Preference clearing now uses inline two-step confirmation plus same-session restore. End-to-end browser revalidation of these replacement controls remains pending; preference-model clear/restore tests pass. No claim of account sync or background chart-library harvesting.


## Canvas interaction and discovery expansion (2026-10-11)

- State tests passed for 8 panels in 3 × 3 with a two-cell panel, three-cell full-row placement, insufficient-capacity rejection, and undo.
- Browser drag from a panel's right handle to the third column set column span to 3 and selected a 1060.8 pt redraw; switching to mean bars showed geometry controls. Width changes updated horizontal transforms, and locking blocked subsequent geometry changes.
- Browser-generated formal A–D labels and two-group letter/numeric P annotations exported to live-text SVG. P symbol alone was italic; original recorded P = 2.234883390359084e-09 displayed as P = 2.23e-9.
- Calibration fixture: a 260-unit-wide image representing 1000 μm produced a 26-unit bar for 100 μm, with separate background and live text.
- State tests validate labels/scales/locks and persistence. Letter-group tests cover the non-transitive a/ab/b case and reject incomplete comparisons.
- All 12 new ROC view renderers passed a tied-score fixture (AUC 0.5). Full advanced workbench regression checks passed. Browser grouping translation with undo and label dragging subsequently passed; scale-background removal persisted through reload. Complex transformed-image calibration and multi-group statistical export still need broader interaction coverage; no blanket Prism/PowerPoint feature parity is claimed.

Method-order tests verify that changing P values does not affect target-based ranking. The method explorer currently compares already computed primary/sensitivity results; it does not run general model selection.

Browser method cards showed the existing Welch and Mann–Whitney results with distinct interpretations; target-driven ordering, rationale capture and undo passed. The new gutter slider committed and undid successfully. Exported composite SVG passed physical-canvas and live-text editability checks.


## Collection, interaction fixes and expandable grids (2026-10-11)

- The first fitting attempt incorrectly reused large native margins across panels and compressed small plots; it was withdrawn from the live page. Subsequent work was checked on a separate QA URL and project ID.
- Browser verified a spanning single-axis plot against two stacked neighbours, physical-size glyph compensation, and data-anchored letters/brackets. Raster and multi-axis fallback is intentional. Arbitrary source SVGs, dense real-world labels and complex multi-axis reflow have not received blanket visual validation.
- Reproduced a font-save failure caused by generated annotations with no persistent source element IDs. Source-object filtering and separate annotation font state fixed it. Browser checks passed for panel font input at 14 pt, direct single-axis-title selection at 12 pt, undo and English UI. SVG DOM showed the requested font sizes while other panels retained 9 pt.
- Browser collection tests passed: capture preset, import a second project, open it, paste layout/styles, reopen a saved figure, and archive the synthetic test entries. Cross-project text/data/analysis are not copied by the preset path. Whole-library backup import and quota/error recovery still need broader browser coverage.
- Right-click insertion of three rows produced 6 × 3; insertion of two columns produced 3 × 5; undo restored 3 × 3. A subsequent check confirmed physical canvas width grows while old track widths are retained.
- Node regressions cover track insertion, crossing spans, locks, bounds, preserved state/data, undo, explicit track dimensions and annotation-font validation. Existing bilingual/state tests, seven HTML builder tests, structure validation and archive-content checks passed during this revision.

## Publication export and contextual actions (2026-10-12)

- Browser export at 180.00 × 139.41 mm produced a 4252 × 3293 PNG. Pillow read 599.9988 dpi (integer pixels/metre rounding); all PNG chunk CRCs passed and exactly one pHYs chunk was present. Export was visually inspected. Changing publication width preserved all internal path geometry and transforms. The prior 300 dpi check above describes the older revision.
- Right-clicking a text object selected that object and exposed contextual editing. Font adjustment through the inspector committed successfully; right-click Undo used the same history and restored the preceding state. Menu actions delegate to existing sidebar handlers instead of introducing separate state mutations.
# Interactive editing and visual catalogue checks — 2026-10-12

Validated in the local browser: text selection, Shift multiselect, multi-object dragging, top alignment, text anchors, hollow bar hit testing, final-size stroke width, positive error-bar segment/end-cap coordination, image replacement, undo/redo and recovery after reload. Data-engine regression confirms changed observations produce changed statistics and SVG candidates; malformed drafts are rejected without changing source files.

The categorized gallery was inspected in every category. It contains 69 preview cards, including 27 ROC-related presentations (18 computed templates and 9 additional-analysis illustrations). Templates are labelled separately from current-data previews. All 60 synthetic template assets were captured from successful renderer regressions and bundled for offline use. Chinese and English navigation labels retain a single line.

Remaining scope boundaries: error direction currently uses the bar workbench's semantic group IDs; embedded raster-image text is not separately editable; illustrative advanced ROC cards require the indicated inputs and analyses before application. These are not claims of universal object interpretation or of scientific validation of arbitrary imported figures.


## Original-template quality checks — 2026-10-12

This revision supersedes the earlier embedded reference-card gallery. The original 102 card images have been removed from shipped assets. Metadata indexes cover those 102 references and the additional 187 ZIP entries. The ZIP scripts were read as reference text, never executed.

- 21 original layouts and 12 ROC result layouts pass rendered-text canvas-boundary checks on deterministic synthetic fixtures. All 33 starters have editable data, bilingual metadata and vector previews without embedded bitmap images. This is fixture coverage, not a guarantee for every arbitrary label length or data set.
- Numerical regressions check Bland–Altman coordinates, exclusive UpSet counts, a 100-cell waffle allocation, GSEA running-sum closure and standardized partial AUC. Missing fields and incomplete partial-AUC intervals are rejected; input tables remain unchanged.
- Engine round trips check template selection, compatible alternatives and exact data-table retention. Shape-dependent templates retain their native aspect ratio rather than stretching circles, cells or coordinate geometry.
- Browser verification: font size 14 applied with Enter and one undo restored the previous styles. Loading the composition template opened its data table; changing count 42 to 84 updated total 100 to 142 automatically. Undo restored both the chart and count; a second undo restored the preceding panel.
- New templates were inspected as rendered contact sheets. Clipped colorbars and a right-edge legend were corrected; matrix and colorbar primitives were changed to vectors. ROC operating-point values and confusion matrices use a reserved results area.
- Browser inspection confirmed the recomputed Youden and confusion-matrix cards have separate plot/result regions. The PCA enlarged preview was inspected at full dialog size; loading labels were moved outward and given a small white backing for legibility over observations. Enlarging a preview does not replace the selected panel.

The shipped gallery contains 98 SVG previews. The 187 reference entries are not 187 new implemented engines. Result-based ROC templates require correctly computed source results; no new inferential results are fabricated for preview. Existing saved assets are preserved; local recomputation is an undoable revision.


## Heatmap cell-value controls — 2026-10-12

- Numerical heatmaps carry exact IEEE-754 cell values and transparent cell geometry in their SVG metadata. Values follow the actual rendered order, including clustering and percentage conversion; missing observations remain unlabelled. Categorical risk/event matrices are not assigned invented numerical values.
- The inspector now offers an immediate show/hide control, 0–6 decimal places, font size, automatic black/white contrast or a custom HEX color. The color control reuses the existing compact swatch style. Valid numeric input updates immediately; Enter/change use the same state path. Matrix-wide text is fitted inside its cells, so the requested size is an upper limit for dense matrices; explicit selected-element sizes retain priority.
- The settings belong to panel state: undo/redo, JSON project restore, data replacement and SVG export use the same values. Labels remain vector text. The scientific data are never rounded or altered by display settings.
- `scripts/test_heatmap_values.py`: 54 exact-value/metadata checks passed across nine numerical heatmap types, original and changed data, and normal/wide/portrait canvases. The checks compare label values directly with plotted mesh/image values and cover missing cells and duplicate SVG IDs. This is geometry/data binding coverage, not a visual guarantee for arbitrary datasets.
- `node scripts/test_studio_heatmap.cjs`: exact float decoding, negative-zero formatting, decimal rounding, automatic contrast, invalid settings, undo/redo, JSON history restoration and appearance retention after data replacement passed. The existing state/history regression suite also passed.
- Main-thread browser checks confirmed 56 clustered-matrix labels, one decimal place, a changed value of 0.82 after table recomputation with visibility retained, and SVG export with 56 visible editable labels and no editor guides or selection overlays. The optional `--browser` mode in the new Node script is an additional isolated SVG check; it was not run as part of this handoff.

### Heatmap palette and live font follow-up

The font-size and decimal-place fields now respond to each valid input event, with Enter/change deduplicated by the shared history. A single fitted font size is used across the matrix, and the inspector reports the actual size when the requested maximum exceeds cell capacity. Safe requested sizes are used directly.

Continuous heatmap colors now use each cell's original normalized scalar, the original scale domain, and its zero midpoint where applicable. Vector cell overlays replace the original mesh/image colors; colorbar segments use the same original normalized positions, preserving all scale labels and geometry. Palette changes precede individual element edits, while automatic numeric-text contrast follows the final cell fill. Sequential and diverging palettes have separate stops.

The 54 metadata cases were rerun with exact, ordered cell-to-mesh comparisons plus cell and colorbar normalization checks; all passed. Node checks additionally verify palette interpolation at a noncentral zero midpoint, real renderer metadata driving every cell/colorbar segment, palette-state undo/restore and retention after data replacement, and production live-input bindings. Visual palette-preview and inspector font input verification is handled by the main-thread browser QA.

### Explicit cell-text edits preserve priority

Matrix-wide numeric formatting now runs before per-element edits. The final heatmap pass adjusts only inherited automatic text contrast; it does not reset font sizes, opacity, or visibility. An explicitly selected cell therefore keeps its requested font size even when the other cells use the recommended uniform default. These explicit sizes are respected directly rather than silently reduced to the size of unselected cells.

`node scripts/test_studio_heatmap_overrides.cjs` executes the production `editedSvg` function and passes: one of 56 cells from 8 to 12 pt (other 55 unchanged), five cells from 8 to 12 pt (other 51 unchanged), hidden/deleted labels remaining hidden, explicit opacity and text color retained, later matrix-default changes preserving local edits, and visibility-off/on preserving deleted labels. This regression verifies production pipeline precedence; the main thread performs browser interaction confirmation.


## Browser confirmation of heatmap edits, source deletion and panel labels — 2026-10-12

The following checks were performed by the main thread in the actual editor:

- Entering 12 in the heatmap font field immediately changed all 56 numeric labels to 12 pt, without pressing Enter. Selecting one cell and setting its text to 14 pt changed that cell while the other 55 remained at 12 pt; undo restored the preceding state.
- A saved project containing older heatmap metadata was upgraded while preserving the project.
- All eight palette previews displayed different colors in both the actual heatmap cells and their colorbar. Clicking the blue-orange card and then leaving the palette pane retained the new cell/scale colors, all 56 values and the 18 pt setting; undo restored the previous red-blue colors.
- Selecting an original ROC caption and pressing Delete removed it; undo restored the source caption.
- The nine visible panel labels were A–I. Manually changing a label to B1 worked and was undone. Moving the panel down swapped the B/C ordering and updated automatic labels; undo restored the preceding order.

Double-clicking the B label focused the label input with B populated. A separate browser page also confirmed that double-clicking the original D label focused the input with D populated. Repeated label clicks now reuse the inspector rather than rebuilding every preview.

Regression commands rerun for this confirmation: `node scripts/test_studio_heatmap_palettes.cjs` passed, including the startup guard that permits swatch rendering before project/history selection exists, all eight real-color preview cards, sequential/diverging scope handling, old-metadata/ROC guards, retained styles, single-cell editing, locks and palette-state undo/redo. `node scripts/test_studio_heatmap_overrides.cjs` also passed against the current production `editedSvg` pipeline, including selected-cell font priority and deleted-label preservation.

## Canvas rearrangement and inspector layout — 2026-10-12

Native browser dragging was checked in both entry paths. In Arrange panels mode, dragging inside heatmap B to occupied cell F exchanged the panels and updated their letters, retaining all 56 cell values and the 18 pt setting. In ordinary editing mode, dragging the six-dot top handle exchanged B with D without enabling Arrange mode. Undo restored each original arrangement. A further final-build check moved ROC C to E, verified panel-wide scope, and undid it. Browser computed cursors were `grab` for arrangement and handles, and `crosshair` for the SVG, text and handles in marquee mode. Active grabbing and invalid-drop cursor states are covered in the production-handler/CSS regression, not a held-pointer browser screenshot.

The inspector header now separates “Adjustments”, the selected-object title and the tab bar. Delete is a compact, labelled icon aligned at the right of the header; preferences are below the editing sections. The ROC selection was visually checked at the live viewport size, with no title/button overlap or repeated Properties heading.

## Gray-workspace selection and final UI check — 2026-10-12

In the native browser, dragging from the gray area above panel A selected exactly its five y-axis tick labels (7.5, 10.0, 12.5, 15.0, 17.5), with five persistent outlines and an enabled Delete action. Starting in the left gray area selected the same five ticks plus the y-axis title, matching the drawn rectangle. Native browser text selection remained empty. Clicking either the gray background or inside the chart cleared all outlines and chosen objects and disabled Delete. The five-tick selection also worked with the explicit marquee button off, in ordinary editing mode. With marquee mode on, both the gray viewport and SVG reported `crosshair`.

The brand subtitle was separately typeset with a local system sans-serif stack, distinct Latin/Chinese tracking and a quieter separator. The actual 1330 px editor view was inspected together with the reorganized inspector. Screenshot: `.cache/viewport-selection-proof.png`. These checks only changed transient selection; they did not change chart data or layout.

### Inspector disclosure rows

Preferences, delivery checks and the other sidebar disclosures now share a 34 px header, a small rotating outline chevron and an in-bounds hover background. Preferences and statistics no longer introduce a separate filled outer card. Keyboard focus remains visible as a thin inset outline. Opening Preferences in the actual browser confirmed consistent left edges, separators and spacing with the adjacent delivery-check and analysis rows.

## Statistical annotation controls and layout — 2026-10-12

Statistics now has a visible section under Properties and a direct panel context-menu entry. Five illustrated choices cover no annotation, compact letters, stars, hashes and exact P values. Bracket, horizontal line and rounded bracket forms are separate immediate choices. The first implementation required recorded comparisons and reliable single-axis group anchors, extending eligible legacy point, box, violin, raincloud and paired plots beyond bar charts. The local-analysis workflow below now also connects calculated or imported comparisons to compound templates; missing results are not inferred from artwork.

Browser verification used an isolated copy of the existing synthetic independent/paired/multigroup/ROC project; source tables and recorded analysis results were unchanged. In the two-group scatter plot, choosing letters displayed `a` and `b` above their actual groups; hashes displayed `####`, stars `****`, and exact P displayed `P = 2.23 × 10⁻⁹` with only P italic. Horizontal and rounded connecting lines updated immediately. Setting the selected generated P label to 32 pt preserved separate space for the effect summary and statistic. Delete hid the selected generated label and Undo restored it. The four-group fixture has only an omnibus test: automatic comparison choices remained disabled with an explicit missing-pairwise explanation. The panel context menu successfully opened the statistics section. Screenshot: `.cache/statistical-annotation-proof.png`.

The independent Node regressions `test_studio_statistical_annotations.cjs` and `test_studio_stat_layout.cjs` cover complete/nontransitive letters, invalid and incomplete result families, selected-method isolation, unrounded P preservation, immediate state changes, generated deletion, 9/24/32 pt spacing for 1/3/6 comparisons, summary separation and retained reflow dimensions. These are bounded production-helper/DOM checks; the browser inspection above does not claim validation for arbitrary datasets or all gallery templates. Main editor pages were regenerated with their original project IDs and restored browser autosaves.

## Local statistical analysis and compound-template results — 2026-10-12

The loopback service now exposes `/api/analyze` for declared raw-observation analysis or a supplied comparison table. The request contains `recipe`, `rows` and `config`; its response contains `analysis`, the confirmed `config` and a canonical CSV `data_sha256`. `/api/render` accepts an optional statistics configuration and returns newly computed results in `panel.statistics`, separate from the existing plot analysis and estimates. Host, Origin and per-process token checks apply to both endpoints; submitted code is never executed.

- Raw analysis requires explicit independent/paired design, a genuine experimental-unit column, group/outcome mappings and a comparison family. Repeated records for the same unit/group/facet, cross-group reuse of an independent unit, incomplete pairing, missing/nonfinite outcomes and undefined constant-data tests are rejected. Pairing follows unit identity, not row order. No observation is silently dropped; an optional, declared row filter records included/excluded counts.
- Implemented methods are Welch two-sample t, Mann–Whitney U, paired t and Wilcoxon signed-rank. Recommendations use the declared design and mean-versus-distribution goal, never the smallest P value. Small tied-sample rank tests use bounded, reproducible permutation calculations where needed. Canonical internal ordering prevents table sorting from changing seeded results. Method assumptions and method-specific interpretations remain visible in the configuration/results.
- All requested pairs, including pairs in different facets, receive one Holm adjustment. Facet records retain separate group orders and named comparisons; the engine does not manufacture cross-facet contrasts. All-pairs and control-only families are explicit. Compact letters require complete all-pairs results; an omnibus P value is not a substitute. Welch/paired-t effect intervals are labelled as unadjusted pairwise 95% intervals, not simultaneous intervals.
- Existing-result import requires group A/group B/P column mappings, method description, family and confirmation of provenance. Raw P values can receive Holm adjustment; already-adjusted P values retain their supplied values and require a named correction method. An unadjusted import is limited to a single comparison. Duplicate or incomplete declared comparison families are rejected.
- A current-table binding recomputes statistics with its figure revision. An external-observation or supplied-result binding becomes stale when the plotted table changes; its previous automatic result display is removed until the source is updated. Undo/redo restores the corresponding figure and statistical state. Analysis failure preserves the last valid figure rather than attaching old P values to new data.

Actual browser checks by the main thread passed: the raincloud's raw table was analyzed, exact-P presentation selected, and the generated text changed to 24 pt. Editing a value recomputed the comparison P values; undo and redo restored the corresponding revisions. PCA was analyzed after explicitly selecting `role = score`, and letter presentation worked in a separate named results area. These are tests of the selected score coordinate, not evidence of overall PCA group separation. An external Holm-adjusted comparison table was connected; changing the plotted x value removed the old result area and displayed the update-required message.

Compound templates no longer require manual statistical text solely because they preserve aspect ratio or lack a categorical axis. Charts such as PCA keep their existing geometry and use a named results area. Direct above-axis placement for recognized single-/multiple-facet categorical charts is being checked separately; the browser evidence in this section does not certify that new placement across all facet layouts.

Backend validation: `scripts/test_studio_statistics.py` passed 15 tests covering the four methods against SciPy/known examples, Holm/control families, imported-result declarations, unit/pairing guards, PCA filtering, row-order stability, bounded permutation work, actual local HTTP authorization/validation and two actual figure/data recomputations. `scripts/test_composite_statistics.py` passed independent checks on two outcomes and three groups with one global Holm family. Its `--render` run additionally passed two actual compound-facet gallery recomputations, analysis/table hash agreement and preserved vector size variants. PCA score filtering excluded loadings; changing loading values left the score tests unchanged while updating the full-table hash.

Independent synthetic starter identities were corrected in 27 templates: group/condition prefixes now distinguish independent units. `scripts/test_synthetic_gallery_units.py` verified that every affected template accepts its declared independent analysis, all measurements and supplied P/CI values remain unchanged, both paired fixture hashes remain unchanged, and SuperPlot technical-repeat identities are retained. Saved user observations are not relabelled by this fix.

Statistical implementation references: [Welch two-sample t](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ttest_ind.html), [Mann–Whitney U](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mannwhitneyu.html), [paired t](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ttest_rel.html), [Wilcoxon signed-rank](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.wilcoxon.html) and [Holm adjustment](https://www.statsmodels.org/stable/generated/statsmodels.stats.multitest.multipletests.html).


## Direct manipulation, coordinate controls and split facets — 2026-10-12

Browser checks on the synthetic editing fixture confirmed bars above and below zero, an editable zero baseline, and logarithmic-axis reference lines. Entering 1.2 as the first-group spacing regenerated the actual chart. Optional PBS/dose condition rows followed their three categorical anchors; they were then disabled on the negative-value example because they did not belong to that example's scientific message. Group-condition and statistical decorations are independent opt-ins.

Canvas insertion was exercised by placing text, entering content and pressing Enter. Selected-range character edits made only `bind` subscript and only `G` italic, preserving the remaining characters. Two editor guides were added. Dragging the inserted text onto the horizontal guide aligned its centre to the guide (screen y 376.54 versus 376.50). Guide isolation from exports and 1,200-guide state handling are covered by the separate Node regression.

The actual browser separators changed the navigator from 220 to 293 px and inspector from 320 to 420 px; reload retained both values. The production-handler regression covers animation-frame coalescing, immediate reverse motion at a limit, lost capture/Escape/blur cancellation, persistence, mobile-window restoration and keyboard access. English mode displayed translated panel names and the current-panel header, including the regenerated negative-value revision. All eight visible layout cards had scroll width equal to client width (117 px), with no horizontal text overflow.

The three-factor comparison panel was split through its real UI/API into Day 1, Day 7 and Day 14 in three consecutive horizontal cells. Both pre-existing panels retained their cells. One Undo returned to three original panels; Redo restored five panels and the horizontal facet row. The three child plots shared their y range, and their titles, tick labels and nine comparison annotations were inspected in the rendered canvas. The backend regression verifies exact preservation of all nine globally Holm-adjusted comparisons, original-row filtering without value changes, supplied results, stale/hash rejection and loopback authentication. Three child panels and square/wide/tall reflows were also rendered and inspected; contact sheet: `.cache/facet-split-qa/contact.png`.

These checks cover the named fixtures and supported facet template. They do not certify every possible imported SVG, data table or long user-authored label.


### Keyboard positioning and inline text — 2026-10-12

In the actual browser, double-clicking an existing added text object opened its inline editor. Selecting only `G` and pressing the toolbar Bold button made that character bold while preserving its italic style, the `bind` subscript and normal remaining text. A prior tap/full-SVG replacement and pointer-capture retargeting issue was fixed so the browser retains the double-click target.

Arrow positioning was measured on the canvas: Right moved a selected text object by 0.7264 screen px at the current fit zoom (1 final pt), Shift+Right by 7.2640 px (10 pt), and Alt+Up by 0.0727 px (0.1 pt). Undo restored the vertical move. A generated P label moved upward by the same 1 pt and Undo restored its original position and unmodified text. Two selected y-axis numbers moved together by equal distances. A direction key used while the font input held focus did not move either chart object. Temporary inserted test text and editor guides were removed after verification.

The dedicated keyboard regression additionally exercises original elements, statistical e9 and condition e8 nodes, mixed selections, panel labels, guide axes, physical export scale, changing preview zoom, lock and input/IME guards, animation-frame coalescing, repeat-key history, cancellation and stale-target protection. These scripted paths are distinguished from the specific browser measurements above.

## Packaged desktop and first-use acceptance — 2026-10-12

The final Windows 0.1.0 installer was installed, reinstalled and uninstalled in an isolated local test directory. Every installed application file matched the build. The installed executable passed Tk resources, HTTP authorization, analysis, rendering and reflow with only Windows system directories on PATH and no external Python. Reinstallation retained external data/settings; uninstall removed the application while retaining those data. This was an isolated environment on the development Windows x64 machine, not a clean virtual machine or a low-end hardware benchmark.

The frozen application rendered 20 representative templates covering distributions, compound comparisons, clustered heatmaps, ROC, PCA, volcano, meta-analysis, dose/time response, sets, flow, survival, enrichment, SHAP, decomposition, mediation, genomic association and synergy. A changed heatmap table produced a changed canonical hash and artwork. These are actual packaged HTTP/render checks, not manual approval of every catalogue combination.

A fresh application-data directory and empty browser origin were used for the first-use browser test. The welcome page led to the box-and-points template; its 72-row example was replaced with a synthetic 16-row, two-group CSV. The graph refreshed automatically (3.2 seconds reported in this run), and the earlier revision remained undoable. The analysis form inferred the column roles but required confirmation of independent experimental units and design. Welch comparison with the declared Holm family then connected one result and displayed a non-overlapping, selectively italicized P annotation. Saving and reopening project JSON preserved the result. SVG and 2880 × 2160 px / 600 dpi PNG exports completed; the PNG was visually inspected. A service restart during the test required reloading the browser to refresh local authorization; autosaved data recovered. The launcher must remain open for local computation.

Separate browser and export checks verified the corrected raincloud density/annotation clearance, immediate data/statistics updates, and deletion/undo of user text, shapes, a mixed selection, guides and an imported image. Locked objects and active text editing were protected. See [deletion and contour checks](figure-studio-deletion-and-contour-qa.md) for the bounded cases.

The portable skill archive also completed inspection of 16 synthetic raw rows, three actual candidate previews and a self-contained editable page without changing its source table. Claude and WorkBuddy installation guidance was checked against official documentation; account-level installation and low-quota model behavior were not tested in those hosts. Their supported upload format is distinguished from a live-host acceptance claim.


## Independent panel gaps, compact margins and TIFF — 2026-10-12

In the actual browser check, margin trimming changed the example composition from 248.1 × 187.1 mm to 239.6 × 174.4 mm, reporting 24.1 pt trimmed horizontally and 36.0 pt vertically. Changing the horizontal gap from 12 pt to 0 moved only the right column by −12 pt; all vertical coordinates and glyph SVG stayed unchanged. Setting the vertical gap to 0 then produced 235.3 × 170.2 mm. Actual TIFF exports were obtained for the whole figure (4252 × 3207 px at 600 dpi) and a single panel (2880 × 2813 px at 600 dpi). These dimensions reflect the respective test figures and export settings; they are not fixed output sizes.

The compact planner measures the current rendered text, images and vector geometry, including statistical and condition decorations and panel labels. Rectangular SVG clip paths are respected. Unused space is trimmed consistently per row/column; source SVG artwork keeps its original size and receives only a translated, clipped viewport. The cell clip prevents an original full-page background from painting over its neighbours. Spanning panels, cross-cell overlays and out-of-cell content receive an explicit unchanged-layout status.

Scripted checks cover separate X/Y values, zero/decimal limits, legacy project and preset handling, one-step undo, source-coordinate overlay/label dragging, resizing, insertion and keyboard positioning. The production compact-cache check confirms that five gutter-preview frames reuse local bounds without DOM remeasurement, while typography, reflow assets and loaded fonts invalidate them. These regressions run through `test_studio_panel_gaps.cjs`, `test_studio_compact_whitespace.cjs`, and `test_studio_compact_interactions.cjs`; the latter has 102 geometry/state assertions. Browser screenshot: `.cache/export-proof/compact-spacing-ui.png`. The TIFF checks above are actual exported files, distinct from the separate scripted TIFF encoder/dialog checks.

Actual compact-mode interaction checks then passed in panel D: inserted “Alignment check” text moved from x = 489.70547 to 490.70547 SVG pt with one Right key, with identical y. Mouse dragging retained its 10 pt font size. Delete removed it and Undo restored it. The exported whole-figure SVG had viewBox 667.1280 × 482.4386, 68 text nodes, no raster image nodes and no editor data attributes; panel labels and clipping were visually checked.

## Expanded category spacing — 2026-10-12

`build_group_spacing_fixtures.py` and `test_studio_group_spacing_gallery.cjs` exercised 107 actual SVGs across 59 categorical or track-plot types. The final run passed 96,222 geometry assertions: 106 assets were movable and one extremely narrow three-facet asset was safely rejected for insufficient space. The run checked 211 paired/interaction connecting paths and 58 vertical category axes. Movement changes category coordinates while retaining response coordinates and glyph dimensions. Cumming's empty reference-category glyph no longer excludes its effect axis: both rows participate, and every matching category center is checked for alignment.

The actual browser exercised group-spacing controls in six chart types. The canonical bar chart now uses the same Properties control, with a 65%–105% range and no duplicate visible spacing control. At 75%, bar path definitions and the existing fit transform remained unchanged while category groups translated by 15 pt; one Undo returned to 100%. A portrait forest plot and a data replacement retained a 70% spacing setting. These checks cover category spacing on the tested assets, not every possible data-column rename or all 218 templates. Continuous axes and adjacency-dependent matrix structures are outside this operation; geometry checks are separate from visual acceptance.

## Codex data update, text retention and actual exports — 2026-10-12

The actual browser workflow changed the vertical-axis title from `Value` to `Response`, italicized only `R`, and updated C01 from 9.5 to 9.4 with Enter. Recalculation completed in 6.72 seconds in this run and retained the title and partial italics; Undo restored 9.5 and Redo restored 9.4. This is a single observed duration, not a performance target. The targeted regression passed 41 guard assertions and six actual SVG fixtures, restricting migration to unambiguous matching semantic text and excluding old numerical ticks and statistical results.

The downloaded SVG was parsed: seven live text elements, no raster images, and the italic `R` within `Response` were present. The downloaded PNG measured 2880 × 2160 px at approximately 600 dpi, corresponding to 121.92 × 91.44 mm, and was visually inspected without clipping or overlap. Saved project JSON retained C01 = 9.4, rich-text formatting and six history states. These checks used the actual editor's downloads; they do not change the separate unverified Claude download-path status. Evidence: `.cache/codex-novice-qa/browser-qa.json` and `.cache/codex-novice-qa/browser-edit-data-export.png`.

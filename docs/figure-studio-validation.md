# Figure Studio preview validation — 2026-10-11

Status: local development preview on branch `codex/figure-studio`; not a published release.

## Verified

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

Original AI generation remains available. Manual edits are kept in a separate project; the next AI step must inspect those choices and run final QA. Live in-page AI/MCP control, automatic Python/R source rewriting, automatic generation of additional chart families, PDF/TIFF export, and editable raster text are not part of this preview.

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

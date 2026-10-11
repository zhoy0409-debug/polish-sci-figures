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

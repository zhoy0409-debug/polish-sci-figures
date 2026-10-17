# Carbon Atelier UI tokens and migration evidence

Source review date: 2026-10-17. Baseline: `main` commit `2c6d11a`; work branch: `codex/carbon-atelier-jade`. This report covers presentation code and bounded Chrome checks. Installer acceptance and whole-editor performance are reported separately.

## Inventory and implementation

The reproducible audit reads UI CSS assets and explicitly identified style fragments in `image-color-ui.js`, `image-insets-ui.js`, `image-links-ui.js`, and the updater. It does not read user projects, scientific SVG assets, datasets, or figure palettes. Values in this inventory are declaration occurrences, including `transparent`, rather than counts of visible pixels.

| Baseline declarations | Occurrences | Distinct values |
| --- | ---: | ---: |
| Colors | 934 | 580 |
| Pixel spacing | 896 | 31 |
| Font sizes | 292 | 21 |
| Corner radii | 152 | 24 |
| Shadows | 89 | 65 |

`studio.css` was 83,644 bytes and contained three separate `:root` definitions. Its old roots were removed. Existing components were migrated at their original declarations in all ten existing CSS files and in the three image-tool UI style fragments. There is no second full-editor stylesheet appended to override the old colors. `theme.css` contains the new appearance/project/context components and the small shared foundation; `theme-tokens.css` contains theme values and compatibility aliases.

The ten existing CSS files plus the three image UI modules contained 879 color literal occurrences and 73 variable references at baseline. After migration they contain 44 color literal occurrences and more than 2,100 variable references. Remaining literals include transparent hit surfaces and the separate A/B evidence colors in duplicate matching. Scientific paint values and user color swatches are preserved. The updater's separate stylesheet and new theme definitions are listed separately in the current inventory; comparing the entire baseline/current file totals directly would mix different file scopes.

Machine-readable details: [baseline inventory](token-audit-baseline.json), [current inventory](token-audit-current.json), and [presentation protection checks](token-protection-checks.json).

## Token contract

Load `theme-tokens.css`, then `theme.css`, then the existing component styles. The default root uses Carbon. Setting `document.documentElement.dataset.theme` to `pearl` selects Pearl; appearance persistence belongs to the theme controller, outside scientific project state.

| Role | Carbon Atelier | Pearl Pro |
| --- | --- | --- |
| App / header | `#151B25` / `#1C2430` | `#E6EBF2` / `#F9FAFC` |
| Navigation / inspector | `#202A37` / `#253142` | `#F4F7FB` / `#FFFFFF` |
| Main accent | `#49C3A5` | `#176B5D` |
| Accent hover / pressed | `#70DEC6` / `#1D806F` | `#145749` / `#104A3E` |
| Normal / pressed accent foreground | `#101B1C` / white | White / white |
| Selected surface | `#22443D` | `#D7F0E7` |
| Primary / secondary text | `#F0F4FA` / `#BCC8D8` | `#253246` / `#4D5E73` |
| Muted text | `#B2BFD0` | `#526278` |
| Important control boundary | `#788AA3` | `#77869B` |
| Decorative separator | `#405064` | `#BCC9D8` |
| Scientific paper / inherited artwork ink | White / `#30343B` | White / `#30343B` |

The suggested muted, success, and boundary colors were adjusted after contrast measurement. Brand accents are unchanged. Decorative separators are deliberately distinct from important control boundaries; separators do not carry the 3:1 control-boundary claim.

The semantic groups are `surface-0/1/2/raised`, `text-primary/secondary/muted/disabled`, `stroke-subtle/default/strong`, accent/selected/focus, hover/pressed, success/warning/error, and role-based control/popover/dialog/drawer/paper shadows. Repeated spacing uses a 4px grid (4/8/12/16/20/24/28/32); 2–3px offsets remain for small icon details. Corner radii use 2/4/6/8/12px, with separate round controls. Body/helper text starts at 12px; 13/14/16/18/20/24px tokens provide the hierarchy. The brand monogram and graphic glyphs retain their own sizes.

Normal controls target 36px and primary buttons 38px. Compact canvas controls use 34px; virtualized layer rows retain their existing 36px geometry and 28px row actions. Existing touch rules remain separate. Hover uses 130ms, pressed 100ms, and panel entrance 160ms. Reduced motion sets theme durations to zero and retains existing component-specific reduced-motion rules.

## Scientific artwork protection

The theme never replaces source SVG `fill`/`stroke`, palettes, image adjustments, measurements, or statistical parameters. The image modules are byte-equivalent to baseline outside their CSS fragments after line-ending normalization. Existing non-editor `fill`/`stroke` CSS declarations are unchanged against baseline.

Scientific preview boundaries retain white paper, the baseline inherited `currentColor` (`#30343B`), the baseline inherited font stack, and a light native color scheme. Explicit user SVG paint/font attributes still take precedence. Canvas surroundings can change independently. Editor-only grid guides, transform handles, marquee/selection outlines, and panel grips use a fixed dark jade that remains readable over the white paper; these selectors target identifiable editor overlays.

The component fixture includes explicit colored SVG artwork and a `currentColor` line. Both themes produced identical SVG DOM, computed paint, and cropped raster SHA-256:

`2ef4cfe732d5bbad77d0991733670c765f953e47bbf0a36b216072b4d97eef15`

This fixture establishes the theme boundary. It is not a substitute for the release's real-project SVG/PNG/PDF/TIFF export regression.

## Reproduce the bounded checks

From the repository root, use the project's Python environment and a Node environment containing Playwright. On this Windows test host, `NODE_PATH` points to the bundled Codex runtime dependencies; a normal developer installation can provide Playwright through its own Node environment.

```powershell
.venv/Scripts/python.exe scripts/audit_studio_ui_tokens.py --output docs/qa/carbon-atelier/token-audit-current.json --check-baseline 2c6d11a --checks-output docs/qa/carbon-atelier/token-protection-checks.json
node scripts/test_studio_theme_tokens.cjs
```

The component test ran on Windows Chrome 155.0.8059.82 at 1440×900. Each theme passed 13 representative text checks, three important control-boundary checks, five hover/pressed/focus checks, 27 semantic foreground/background token pairs, reduced motion, scientific paint/DOM/raster invariance, and zero network requests. State assertions check the exact specified hover/pressed brand colors and their foregrounds. [Recorded component results](theme-component-checks.json) identify the browser and actual minimum ratios. These checks cover the named components and token pairs; they do not certify every page or all combinations as WCAG AA.

For a running source build with the current assets:

```powershell
$env:STUDIO_THEME_URL = 'http://127.0.0.1:18961/'
node scripts/test_studio_theme_layout_browser.cjs
```

The layout test uses disposable local text, blocks remote requests, and checks 1280/1440/1920 widths, both UI languages, both themes, selection/fit geometry, complete inspector tab labels, short layer names, and the actual editor guide colors. Its detailed proof is written under `.cache/carbon-qa/`. It does not claim scientific-data accuracy, physical Windows display scaling, or installed-executable acceptance. Midnight remains unimplemented.

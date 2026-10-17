# Figure Discovery implementation and validation

This is a source feature on `codex/scientific-figure-discovery`, not a claim that store installers or every supported platform were rebuilt. Test inputs under `scripts/fixtures/discovery` are small synthetic, non-patient fixtures with deliberately explicit designs; they are not clinical validation datasets.

## Audit and stages

The pre-implementation audit read the make-data Skill, statistics/data contracts, gallery registry and renderers, Studio gallery contracts/catalogue/discovery metadata/literature/controller/HTML, loopback server, curation reference, literature tests, Windows/macOS packaging and browser/mobile adapters. Existing 218 starters and manual editor stay intact. The initial knowledge registry deliberately curates a small tested subset. A summary-only renderer is added through the original gallery registry.

Stage 1: shared profile and scientific gates, registry, CLI/Skill integration, actual-data cards, reversible apply, local XLSX import and limited standalone fallback are implemented. Stage 2: semantic evidence/exploration queries, bounded two-page search, a capped 429 retry, stable-ID deduplication, explicit evidence levels and retained captions are implemented atop the existing service. Persistent cache and broader method extraction remain deferred. Stage 3: registry versioning and repeatable evaluation are implemented; OpenAlex and other device/store releases are not enabled.

## Reproduce

```sh
node scripts/test_figure_discovery.cjs
python scripts/test_figure_discovery.py
node scripts/test_studio_literature.cjs
python desktop/build_starter.py --out .cache/discovery-starter.html
python skills/polish-sci-figures/scripts/studio_server.py .cache/discovery-starter.html --port 18941
# In another terminal, with Playwright and Chrome available:
node scripts/test_figure_discovery_browser.cjs
```

`STUDIO_DISCOVERY_URL`, `STUDIO_BROWSER` and `NODE_PATH` can select the local test service, installed browser and development dependencies. Windows sandbox runs may require an allowed task-local TEMP/TMP and permission for browser localhost access. Tests never send the fixtures to a literature service.

The automated scientific suite covers small independent groups, genuine paired long-table pivoting, duplicate/incomplete pairs, technical-repeat isolation, repeated time grids, summary-only rejection of fabricated observations, supplied differential results versus raw expression matrices, real labels/scores versus AUC-only text, invalid/missing values, unsupported counts/nesting, privacy and browser/CLI JSON parity. Python exercises the actual existing renderer for every shortlisted candidate in all seven fixtures, XLSX import and CLI generation of editable HTML.

The Chromium test exercises upload, multiple real previews, apply, undo, redo, save/reopen, design invalidation, Chinese/English, zero unsolicited remote requests, and actual standalone offline rendering/application. It writes `.cache/discovery-qa/result.json` and screenshots. Regression tests cover gallery contracts, existing beginner flow, state/history, data validation, variant switching, file imports, local web scheduling and loopback rendering. Final executed outcomes and screenshots are recorded below after the run.

No macOS, iOS, Android device, rebuilt Windows installer or store distribution is certified by these tests. Source packaging/resource checks do not substitute for device interaction tests. The scientific gates rely on truthful user declarations; no code can infer genuine biological independence from an ID column.

## Executed results · 2026-10-17

All commands below completed successfully on the Windows source checkout with Python 3.12.14 and Node.js 24.18.0. Test development initially exposed and fixed stale declaration bindings, language refresh, missing-candidate status and a portable Markdown link. Sandboxed TEMP/localhost access required a task-local temporary directory and an allowed local-browser test environment; these were environment restrictions, not successful product checks.

| Command | Outcome |
| --- | --- |
| `node scripts/test_figure_discovery.cjs` | Seven synthetic scenarios, hard exclusions, provenance, private-query guards and browser/CLI parity passed |
| `python scripts/test_figure_discovery.py` | Five integration tests passed: reproducible registry, every shortlisted actual renderer, XLSX import, preserved leading-zero IDs/precision and duplicate-header rejection, CLI editable HTML |
| `node scripts/test_studio_literature.cjs` | Existing privacy, transport, cancellation, timeout, cache, XML safety, caption and stale-UI tests passed |
| `node scripts/test_discovery_literature.cjs` | Semantic modes, two-page bound, stable-ID deduplication, evidence levels, zero results, partial responses and 429 retry passed |
| `node scripts/test_figure_discovery_browser.cjs` | Real installed Chrome: actual previews, history/save/reopen, language switching, invalidation and standalone offline application passed |
| `node scripts/test_discovery_live_literature.cjs --live` | Explicit live Europe PMC query with fixed public keywords: 10 papers, 5 official API requests, 1 verified caption/figure, no partial failure |
| `python scripts/test_gallery_registry.py` | 192 gallery contracts valid; existing 218 starters preserved |
| `node scripts/test_studio_beginner_flow.cjs` | Existing beginner flow passed |
| `node scripts/test_studio_data_validation.cjs` | Existing template/data validation passed |
| `node scripts/test_studio_state.cjs` | Existing history, state, layout and bilingual discovery metadata passed |
| `node scripts/test_studio_variant_switch.cjs` | Existing switch/draft/ownership regressions passed |
| `node scripts/test_studio_file_import.cjs` | All 28 file import DOM integrations passed |
| `node scripts/test_local_web_engine.cjs` | All 8 browser scheduling checks passed |
| `python scripts/test_studio_server.py` | Actual local regeneration and invalid-draft rejection passed |
| `python scripts/test_release_bundle.py` | Extracted source CLI and bytecode-only renderer/resource checks passed |
| `python scripts/test_portable_skill.py` | Portable Skill extraction, links and raw-data workflow passed |
| `python scripts/test_local_web_build.py` | Four local browser build/resource checks passed |
| `python skills/polish-sci-figures/scripts/test_figure_studio.py` | Ten packaging/provenance tests passed; the new knowledge script is validated as inert JSON, retaining exactly one executable runtime |
| Text/PDF regressions (`test_studio_pdf_text_editing.cjs`, `test_studio_text_formatting.cjs`, `test_studio_rich_text_regression.cjs`, `test_studio_text_geometry.cjs`) | Production DOM integrations, physical font sizes, character formatting and editor initialization passed after keeping discovery bindings in the existing startup section |
| Original history/state DOM group | 45 original checks exercised; the one exposed new-project initialization dependency was fixed with an optional-module guard and its targeted regression reran successfully |

The live [API record](qa/figure-discovery/live-literature.json) retains the real IDs and source links. It identified an estimation chart term in **Fig. 5** of the returned article; other returned papers remain unverified at figure level. This smoke test confirms access/record handling, not applicability of that article’s methods to arbitrary data.

Real browser evidence (synthetic acceptance data, always rendered through the product): [English independent groups](qa/figure-discovery/independent-en.png), [Chinese paired views](qa/figure-discovery/paired-zh.png), [offline editable summary](qa/figure-discovery/offline-editor.png), [machine-readable browser result](qa/figure-discovery/result.json). These images were visually inspected for readable labels, differing data views and retained editor controls.

Before a binary release, rebuild the Windows application, run the same tests inside that packaged application, exercise macOS/iOS/Android and the full WASM runtime on their actual hosts, and review target-specific fonts and memory behavior. These operations have not been performed in this change. No automatic AI service or OpenAlex key/configuration was introduced.

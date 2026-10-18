# Minimal update companions · 2026-10-18

This record helps users and maintainers review the restored small ink cat and its matching dog. The current source passed controlled Chrome component checks and a generated-editor save/export check; the published Windows installers have not been rebuilt or replaced for this artwork revision.

## What changed

The cat retains the original `ef27dbe` geometry and colours. A small monochrome dog accompanies it along a compact progress track, with staggered hops, tail movement and subtle pointer feedback. The [scene design](../../update-scene-design.md) describes the state mapping and editable SVG sources.

## Verified scope

- Chrome 155.0.8059.82 rendered 22 controlled component snapshots, including known/unknown byte totals, verification, ready, preparation, connection loss, errors, motion settings, first-time desktop installation and in-editor upgrade.
- Six actual pointer cases checked the cat and dog with animation enabled, manually disabled and system reduced motion; feedback did not change progress or call the updater.
- Carbon and Pearl themes, hidden/out-of-view/closed animation suspension, and narrow emulated device pixel ratios 1, 1.25 and 1.5 passed.
- The generated editor opened the new scene through its existing update button. Its saved project remained exact, preserving 150 observations and 12 SVG sources; Carbon/Pearl scientific SVG exports matched the canonical originals.
- The recorded component and generated-editor runs reported no external requests or page errors.

## Review the result

See the [Carbon preview](carbon-preview.png), [Pearl preview](pearl-preview.png) and [actual generated-editor screenshot](editor-preview.png). The [recorded interaction GIF](interaction-demo.gif), [original WebM](interaction-demo.webm) and [recording provenance](demo-provenance.json) show actual pointer feedback and explicitly selected demonstration states. The [component summary](browser-summary.json) and [editor summary](full-editor-summary.json) retain scope and attempt details.

First-time setup opens only the official Windows Setup link. The registered edition keeps **Download and prepare update** inside the local updater, without opening an external download. Even a same-version unregistered copy can find the one-time Setup entry. See the [first-install screenshot](first-desktop-install.png), [in-editor download screenshot](in-editor-upgrade.png) and [quick start](../../../desktop/QUICKSTART.en.md#save-quit-and-upgrade). These two browser cases use controlled responses.

The existing real [0.1.20 / 0.1.21 → 0.1.22 acceptance](../live-preview/postrelease-20261018/README.md) verifies the installed updater separately; it does not verify this new artwork in a new Windows package.

## Evidence limits

Transport responses were controlled. No update package was downloaded or installed in these checks, and no new Windows installer or actual update-flow acceptance is claimed. Emulated device pixel ratios are not Windows system scaling. Short component timing does not establish full-editor performance, operating-system CPU usage or GPU usage.

The earlier [Carbon scene report](../carbon-atelier/update-scene-controlled.json) depicts the historical detailed characters. It remains historical evidence and does not verify the new small-cat-and-dog artwork.

## Reproduce

Run `node scripts/test_studio_update_scene.cjs`, then run `node scripts/test_studio_update_scene_browser.cjs` with Playwright and installed Chrome. Set `STUDIO_SCENE_PROOF` to a new empty directory to retain each attempt separately. The browser script uses controlled responses and does not fetch or install a release.

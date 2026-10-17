# Update scene design and verification

This note explains Figure Studio's original cat and dog update scene for maintainers and reviewers. The decoration follows the existing updater's confirmed state, while download bytes, verification, saved-project confirmation and installer handoff keep their separate meanings. Component screenshots explicitly identify controlled responses; actual Windows download and installation evidence belongs in the release acceptance record.

*Last checked: 2026-10-17. Status: component implementation and controlled Chrome verification complete; final installed-client verification is tracked separately.*

## Editable artwork

The silver and cream Maine Coon and black and white Border Collie are original layered vector artwork distributed under the repository's [MIT license](../LICENSE). There are no external images, fonts, animation runtimes or network requests in the scene.

| Source | Editable structure |
| --- | --- |
| [Maine Coon](../skills/polish-sci-figures/assets/figure-studio/mascot-maine-coon.svg) | Ear tufts, silver coat, cream ruff, facial features, fluffy tail and alternative paw positions. |
| [Border Collie](../skills/polish-sci-figures/assets/figure-studio/mascot-border-collie.svg) | Black and white coat, blaze, ears, muzzle, chest, feathered tail and alternative paw positions. |
| [Composed scene](../skills/polish-sci-figures/assets/figure-studio/mascot-scene.svg) | Shared floor, parcel, inspection lens and quiet doorway. All resource IDs begin with `fs-update-`. |

Edit the individual character source, then run `python scripts/build_update_mascot_scene.py` from the repository root to regenerate the composed scene. The build embeds that scene into `studioUpdateMascotTemplate`; the controller clones it once. Character paths are absent from JavaScript. Resting forelegs switch off when the corresponding working or greeting paw is visible, preserving the limb structure.

## State and pose mapping

The [presentation controller](../skills/polish-sci-figures/assets/figure-studio/update-scene.js) maps the existing transport contract without introducing a progress clock.

| Confirmed condition | Pose and motion | Meaning |
| --- | --- | --- |
| Idle or release checking | Resting pose; looking toward the version mark during checking. | No claimed download progress. |
| Downloading with a known total | Working paw positions, small parcel movement tied to the byte ratio, local paw and tail motion. | The displayed percentage is `received / total`. |
| Downloading with an unknown total | Working pose and indeterminate native progress. | Received MB only; no percentage. |
| Downloading and all bytes received | Cat holds an inspection lens; dog waits. | Verification remains pending. No install button. |
| Updater returns `ready` | Greeting paws and one short acknowledgement. | The package is verified. Installation still requires the saved-project checkbox and an explicit action. |
| Preparing | Slow cooperative paw movement. | The preserved installer performs backup and preparation. |
| Updater returns `installing` | Cooperative pose and visible doorway. | The helper has accepted handoff. The old client stops polling; it does not claim the new installation has completed. |
| Lost connection | Quiet pose and neutral reconnection text. | State is temporarily unknown; installation is not retried automatically. |
| Cancelled or backend error | Quiet pose; no success badge or celebration. | Recovery text follows the actual updater response. Known preparation stages receive concise descriptions. |
| Current release confirmed | Greeting pose with one brief acknowledgement. | The release check found this channel current; this is not an installation result. |

Each explicit download resets the client byte-history epoch. Within that epoch, a decreasing received count or a change to an already known positive total is rejected as invalid progress. The last confirmed sample remains available and the user can recheck status. This is not a global maximum carried across downloads. The backend has no public job identifier, and the scene does not add one or alter the protocol.

## Motion and accessibility

The [scoped stylesheet](../skills/polish-sci-figures/assets/figure-studio/update-scene.css) consumes the application's semantic theme tokens for dialog chrome. The small neutral illustration stage retains its own material colors. None of its selectors target the artboard or exported scientific artwork.

The native progress element, byte caption, stage list, error alert, keyboard controls and saved-project checkbox remain independent of the decorative `aria-hidden` scene. The character-animation checkbox persists locally. System reduced motion, a closed dialog, a hidden document or scrolling the scene out of view stops character CSS animation; byte and status updates continue. Reopening a verified state does not restart an endless celebration. The scene uses transforms and opacity, with no animation timer, canvas repaint loop or animated blur.

## Reproducible checks

The existing update-check, installed-update UI and transport scripts retain their protocol and safety assertions. New component checks run with `node scripts/test_studio_update_scene.cjs`; they exercise byte ratios, verification gating, separate download epochs, malformed progress, cancellation, reduced motion, hidden-document logic and preference persistence.

`node scripts/test_studio_update_scene_browser.cjs` requires Playwright and installed Chrome. Its output directory can be set with `STUDIO_SCENE_PROOF`. It renders controlled transport responses without fetching release files or starting an installer. The output records asset bytes, first observed double-animation-frame latency, short animation-on/off frame and task measurements, and explicit evidence limitations.

The [controlled Chrome report](qa/carbon-atelier/update-scene-controlled.json) and [working](qa/carbon-atelier/update-scene-controlled-download-52.png), [inspection](qa/carbon-atelier/update-scene-controlled-download-100.png) and [verified](qa/carbon-atelier/update-scene-controlled-verified-ready.png) keyframes make this boundary visible. Each image contains a controlled-fixture disclosure inside the dialog. The narrow view additionally reserves a separate number strip, so download percentages do not overlap either character's head.

The narrow screenshots use a 420 × 900 physical-pixel target with reduced effective CSS viewports and emulated device pixel ratios of 1, 1.25 and 1.5. They assert the actual reported device pixel ratio, all four dialog edges, and scroll access to the bottom action. These are browser simulations, not Windows display-scaling measurements. An earlier artificial root-CSS-zoom screenshot was rejected during visual review because it cropped the dialog; the retained attempt is disclosed in the browser report.

Short component timing on one host does not establish full-editor frame rate, GPU load or performance on other machines. A real installed updater must separately download and verify a published package, preserve the old program and settings, complete helper handoff and reopen the resulting installation before release acceptance is complete.

The operator-only [real Windows acceptance script](../scripts/test_studio_update_real_windows.cjs) requires an explicit loopback service URL and `STUDIO_REAL_UPDATE_INSTALL=YES`. It saves the real project before downloading, checks every scientific table row and project identity, records actual transport/UI states and video, sends one installation command, and checks the reopened version and saved data. It never reconstructs stages missed by a fast real update. Its output stays in ignored `.cache` by default and is separate from controlled-fixture proof.

Video capture requires the matching Playwright ffmpeg runtime; `PLAYWRIGHT_BROWSERS_PATH` selects its configured local runtime directory. Browser, context and page initialization are inside cleanup handling. Recorder initialization failures stop before any update action, close acquired resources and produce a failed report. A video-finalization error cannot skip the browser-close attempt.

Each run uses a new empty proof directory, so failed attempts are retained separately. The script accepts only the exact existing Chinese or English project-replacement confirmation during an explicitly requested project open; it dismisses and records unknown dialogs, then stops acceptance.

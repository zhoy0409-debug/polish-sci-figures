# Update scene design and verification

This note explains Figure Studio's original cat and dog update scene for maintainers and reviewers. The decoration follows the existing updater's confirmed state, while download bytes, verification, saved-project confirmation and installer handoff keep their separate meanings. Component screenshots explicitly identify controlled responses; actual Windows download and installation evidence belongs in the release acceptance record.

*Last checked: 2026-10-18. Status: the restored small-cat scene and matching dog passed source and controlled Chrome checks. This revision has not rebuilt or replaced the published Windows installers, or undergone a new actual download/install run. See the [minimal-companion evidence](qa/minimal-companions/README.md).*

## First install and later updates

Windows users download the official **Setup** once, run the installer, and open Figure Studio from its desktop or Start-menu shortcut. Later supported updates stay inside the editor: **Updates → Download and prepare update → save the project and tick the confirmation → Install and reopen**. Download, integrity verification and installation use the existing updater; users do not need to extract or replace application folders.

Portable, source-run and unrecognized custom copies are not overwritten. Users who want the supported installed workflow can save a project JSON, quit that copy, run the official Setup using its default location, then launch the installed shortcut and open the saved project. This does not bypass installation-location or Windows security checks, or guarantee a fix for every reported error. The [quick start](../desktop/QUICKSTART.en.md#save-quit-and-upgrade) retains the older-version, same-version candidate and long-path exceptions.

## Editable artwork

The small ink cat preserves the original geometry, facial features and colours from commit `ef27dbe`; a matching round dog adds drooping ears and a small muzzle. Both use simple monochrome silhouettes, distributed under the repository's [MIT license](../LICENSE). There are no external images, fonts, animation runtimes or network requests in the scene.

| Source | Editable structure |
| --- | --- |
| [Original small cat](../skills/polish-sci-figures/assets/figure-studio/mascot-minimal-cat.svg) | Preserved silhouette, ears, eyes, mouth, tail, check mark and parcel; separate motion groups. |
| [Matching small dog](../skills/polish-sci-figures/assets/figure-studio/mascot-minimal-dog.svg) | Round silhouette, drooping ears, white eyes, muzzle and tail in the same ink style. |
| [Composed scene](../skills/polish-sci-figures/assets/figure-studio/mascot-scene.svg) | Compact pair, independent hop groups and shadows, byte-linked track and inspection lens. |

Edit the individual character source, then run `python scripts/build_update_mascot_scene.py` from the repository root to regenerate the composed scene. The build embeds that scene into `studioUpdateMascotTemplate`; the controller clones it once. Character paths are absent from JavaScript. The earlier detailed Maine Coon and Border Collie SVGs remain as historical resources and are not composed into the current scene.

## State and pose mapping

The [presentation controller](../skills/polish-sci-figures/assets/figure-studio/update-scene.js) maps the existing transport contract without introducing a progress clock.

| Confirmed condition | Pose and motion | Meaning |
| --- | --- | --- |
| Idle or release checking | Compact pair rests centrally; checking adds staggered hops and tail movement. | No claimed download progress. |
| Downloading with a known total | The pair advances along the track at the byte ratio, with staggered hops and tail movement. | The displayed percentage is `received / total`. |
| Downloading with an unknown total | The pair stays centrally on a pale track. | Received MB only; no percentage. |
| Downloading and all bytes received | Inspection lens appears; the pair makes small alternating inspection movements. | Verification remains pending. No install button. |
| Updater returns `ready` | Original check mark and one short staggered hop. | The package is verified. Installation still requires the saved-project checkbox and an explicit action. |
| Preparing | Original parcel appears; the pair makes gentle carrying movements. | The preserved installer performs backup and preparation. |
| Updater returns `installing` | The carrying pose continues. | The helper has accepted handoff. The old client stops polling; it does not claim the new installation has completed. |
| Lost connection | Quiet pose and neutral reconnection text. | State is temporarily unknown; installation is not retried automatically. |
| Cancelled or backend error | Quiet pose; no success badge or celebration. | Recovery text follows the actual updater response. Known preparation stages receive concise descriptions. |
| Current release confirmed | Check mark with one brief hop. | The release check found this channel current; this is not an installation result. |

Each explicit download resets the client byte-history epoch. Within that epoch, a decreasing received count or a change to an already known positive total is rejected as invalid progress. The last confirmed sample remains available and the user can recheck status. This is not a global maximum carried across downloads. The backend has no public job identifier, and the scene does not add one or alter the protocol.

## Motion and accessibility

The [scoped stylesheet](../skills/polish-sci-figures/assets/figure-studio/update-scene.css) consumes the application's semantic theme tokens for dialog chrome. The compact illustration uses the original near-black ink and pale grey stage. None of its selectors target the artboard or exported scientific artwork.

The native progress element, byte caption, stage list, error alert, keyboard controls and saved-project checkbox remain independent of the decorative `aria-hidden` scene. The character-animation checkbox persists locally. System reduced motion, a closed dialog, a hidden document or scrolling the scene out of view stops character CSS animation; byte and status updates continue. Reopening a verified state does not restart an endless celebration. The scene uses transforms and opacity, with no animation timer, canvas repaint loop or animated blur.

With animation enabled, hovering shifts the nearest animal's eyes and gives the dog a quicker tail wag; pressing gives a small lift. These decorative responses stop when animation is disabled or reduced motion is requested. They do not change download progress or invoke updater actions.

## Reproducible checks

The existing update-check, installed-update UI and transport scripts retain their protocol and safety assertions. New component checks run with `node scripts/test_studio_update_scene.cjs`; they exercise byte ratios, verification gating, separate download epochs, malformed progress, cancellation, reduced motion, hidden-document logic and preference persistence.

`node scripts/test_studio_update_scene_browser.cjs` requires Playwright and installed Chrome. Its output directory can be set with `STUDIO_SCENE_PROOF`. It renders controlled transport responses without fetching release files or starting an installer. The output records asset bytes, first observed double-animation-frame latency, short animation-on/off frame and task measurements, and explicit evidence limitations.

The [minimal-companion evidence](qa/minimal-companions/README.md) records the current artwork's controlled Chrome states, pointer feedback, motion settings and generated-editor save/export checks. The earlier [Carbon report](qa/carbon-atelier/update-scene-controlled.json) and its [working](qa/carbon-atelier/update-scene-controlled-download-52.png), [inspection](qa/carbon-atelier/update-scene-controlled-download-100.png) and [verified](qa/carbon-atelier/update-scene-controlled-verified-ready.png) keyframes show the historical detailed characters, not this revision's artwork. Controlled screenshots identify the fixture inside the dialog. The narrow view reserves a separate number strip, so download percentages do not overlap either character's head.

The narrow screenshots use a 420 × 900 physical-pixel target with reduced effective CSS viewports and emulated device pixel ratios of 1, 1.25 and 1.5. They assert the actual reported device pixel ratio, all four dialog edges, and scroll access to the bottom action. These are browser simulations, not Windows display-scaling measurements. The historical Carbon report retains an earlier rejected artificial root-CSS-zoom screenshot that cropped the dialog.

Short component timing on one host does not establish full-editor frame rate, GPU load or performance on other machines. A real installed updater must separately download and verify a published package, preserve the old program and settings, complete helper handoff and reopen the resulting installation before release acceptance is complete.

The operator-only [real Windows acceptance script](../scripts/test_studio_update_real_windows.cjs) requires an explicit loopback service URL and `STUDIO_REAL_UPDATE_INSTALL=YES`. It saves the real project before downloading, checks every scientific table row and project identity, records actual transport/UI states and video, sends one installation command, and checks the reopened version and saved data. It never reconstructs stages missed by a fast real update. Its output stays in ignored `.cache` by default and is separate from controlled-fixture proof.

Video capture requires the matching Playwright ffmpeg runtime; `PLAYWRIGHT_BROWSERS_PATH` selects its configured local runtime directory. Browser, context and page initialization are inside cleanup handling. Recorder initialization failures stop before any update action, close acquired resources and produce a failed report. A video-finalization error cannot skip the browser-close attempt.

Each run uses a new empty proof directory, so failed attempts are retained separately. The script accepts only the exact existing Chinese or English project-replacement confirmation during an explicitly requested project open; it dismisses and records unknown dialogs, then stops acceptance.

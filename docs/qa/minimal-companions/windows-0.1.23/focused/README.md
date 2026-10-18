# Windows 0.1.23 focused UI and data acceptance

This record contains the actual installed-service Chrome acceptance from 2026-10-18. [The original result](installed-minimal-result.json), three screenshots and the [unedited recording](video/page@a139ba48e4a447e14d2d32bd4c908b9b.webm) are byte-preserved copies of the successful third attempt.

## Verified scope

The registered Windows installation was deliberately launched with an explicit `--data-dir` for isolated testing. Its real service reported Studio **0.1.23**, suite **1.4.23**, Windows x86_64 and **`inAppInstall: false`**. This launch is distinct from a normal default-profile installed upgrade. The harness neither started nor installed the native application.

The independently captured HTML, direct local HTTP response and actual Chrome main-document response all matched SHA256 `ac520ce5852480c1778798bc89af0465687e4ae97786d83b73e1a11a486f1a67`. No HTML fulfillment or bridge injection was used. Browser requests remained local; the real service could fetch official release metadata. No update package was downloaded or installed.

- The existing update button opened the small cat-and-dog scene. Actual pointer hover, press, release and motion-off behavior passed for both characters.
- The public [UCI Iris dataset](https://archive.ics.uci.edu/dataset/53/iris), DOI `10.24432/C56C76`, retained **150 observations and 12 original SVG sources**. Original tables, variants, recipes and analyses matched the independent input completely.
- The known legacy import added only `labelNumbering: "upper"` to `project.initialState` and `state`. These two defaults were independently expected from the production import contract; the saved result did not supply its own expected values.
- Opening and operating the update dialog preserved the complete saved project, state, history, checkpoints and data drafts. A real F2 text edit produced one history commit; Undo restored the original state, and Open/Save retained the restored project and legitimate redo entry.
- Carbon and Pearl scientific SVG exports matched after the existing export ID-prefix normalization. Their PNG bytes and all **2880 × 2160 RGBA pixels** were identical. The raw export hashes remain in the original result.
- No external browser requests, forbidden update actions, page errors or unexpected dialogs were reported.

## Screenshots

[Carbon update dialog](installed-carbon-theme-update.png) · [Pearl update dialog](installed-pearl-theme-update.png) · [Restored Iris project](installed-restored-public-iris.png)

The theme screenshots capture an actual metadata check before 0.1.23 publication; the last official version can therefore read 0.1.22. They are not staged download-progress screenshots.

## Limits and retained attempts

This focused run does not establish a real update handoff, native IME behavior, detector accuracy, full-editor performance or every scientific workflow. Checkpoints and data drafts were empty in this fixture. The original recording is unedited; copying it is not a claim that every frame was manually reviewed.

Earlier attempts remain in the local evidence: the first hit Chrome's default response-body cache limit; the second exposed the test's missing expectation for the existing legacy numbering migration. Both failed before editing. The third passed with bounded direct-CDP navigation evidence and an independently canonicalized input. The scientific data assertions were retained.

## Raw file integrity

The JSON, PNG and WebM bytes were copied without sanitizing, editing or re-encoding. The result was reviewed for credentials and private filesystem paths; it contains only a loopback origin, relative artifact paths, public-fixture counts and hashes.

```text
2f0414c318150f00f2e6757353fed0fb87597e00c216fb016df9de5959c6fff4  installed-minimal-result.json
b6b32f40257ef9c5c9628dca77cdddfd0524adf645cc82cefb35f731d8ec07ae  installed-carbon-theme-update.png
3103222eece99570829f29c5bcce0746cfa466a9e9a22b7cb00254476200d66d  installed-pearl-theme-update.png
0387518445981b287432b5e4f94b2fd9ed91d07399d55793d2db647a39f41720  installed-restored-public-iris.png
02f643634134f685708c2ca3a114da72985dc329fcb478296cf591d784db4eb9  video/page@a139ba48e4a447e14d2d32bd4c908b9b.webm
```

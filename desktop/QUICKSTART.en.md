# Getting started with Figure Studio

The unreleased 0.2.0 candidate still has a user-reported Chinese installer text-clipping issue. The narrow desktop workspace fix is separate; see the [remaining acceptance work](../docs/qa/windows-next-stable/remaining-20261031.md). Do not change system display scaling to complete installation.

**0.2.0 release-preparation snapshot (Suite 1.5.0, 2026-10-28):** the new-version links are pending publication and installed-app/real-upgrade acceptance. For an available installer, use the [previous stable v1.4.26](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.26). See [candidate scope](../docs/release-notes-v1.5.0.md#english).

The Windows installer workflow and genuine official 0.1.25 → 0.1.26 in-editor upgrade passed the listed checks. The [acceptance record](../docs/qa/photo-correction/windows-0.1.26/README.md) details data protection, performance results and remaining items.

The update window keeps the simple companions and shows downloaded bytes with an outline heart and jade water. Download completion is followed by integrity verification; save and confirm before installation. Animation preferences and reduced motion retain readable progress. See the [release notes](../docs/release-notes-v1.5.0.md) and separate [historical 0.1.23 acceptance](../docs/release-notes-v1.4.23.md) for each version's scope.

Version 0.2.0 retains local outline correction, ruler straightening and global colour controls. See the [photo guide](../docs/figure-studio-photo-correction.md) and [actual acceptance scope](../docs/figure-studio-photo-correction-validation.md).

Figure Studio creates, edits and arranges scientific figures. The Windows desktop edition supports Windows 10/11, 64-bit. Once installed, it works offline without Codex, a separate Python installation or an API key.

Figure Studio is the **official companion editor for polish-sci-figures**. The [zhoy0409-debug/polish-sci-figures repository](https://github.com/zhoy0409-debug/polish-sci-figures) is the project's sole official maintenance and release channel. Download installers from its **Releases** page. The launcher's **Official project** button opens that repository only when clicked. No account, activation or online verification is required.

2026-10-18: the [actual original official 0.1.20 → 0.1.22 update](https://github.com/zhoy0409-debug/polish-sci-figures/blob/main/docs/qa/live-preview/postrelease-20261018/README.md) passed, including automatic project recovery and normal cleanup. Its input scope is explicit; the separate 0.1.21 → 0.1.22 update with nonempty history, checkpoint and original-table draft also passed, including normal cleanup.

## Install and open

1. **Choose the Setup installer for first use:** download [polish-sci-figures-Studio-0.2.0-Setup-x64.exe](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.5.0/polish-sci-figures-Studio-0.2.0-Setup-x64.exe) from the [v1.5.0 release when published](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.5.0), then run it for your Windows user account. No extraction is needed.
2. Open **polish-sci-figures Studio** from the desktop or Start menu. When the small launcher window says **Editor is ready**, the editor opens in your default browser. You can also click **Open editor** in that window.

The installer's **Shortcuts** page only chooses whether to create a desktop shortcut. It is optional. The Chinese wizard uses a CJK UI font and wrapped instructions without reducing the system text size.
3. Choose **English** or **中文** at the top right. Opening the shortcut again opens the editor already running.

**For later versions, stay in the editor: Updates → Download and prepare update → save your project and tick the confirmation → Install and reopen.** The supported installer edition downloads, verifies and installs the update without repeated manual GitHub downloads, extraction or folder replacement.

For the portable edition, extract the entire `polish-sci-figures-Studio-VERSION-Portable-x64.zip` before running `Figure Studio.exe`. Keep its adjacent `_internal` folder.

## Correct a photographed image

1. Import the original PNG, JPEG or WebP, select it, then open **Image tools → Auto straighten & refine**. Review the suggested outline; choose another outline or refine its four corners.
2. For an overall tilt, choose **Ruler straighten** and draw a reference that should be horizontal or vertical. This uses one rigid rotation and an inscribed crop, replacing the four-corner perspective. Repeated line edits reuse the same selected range.
3. Set a known aspect ratio if available. The default edge estimate is a display choice, not the subject’s measured proportions. Preview first, then **Keep correction**; **Cancel** or Esc discards the draft.
4. Choose **Auto color & refine next**, or **Image display → Auto color (photos)**. Inspect the global suggestion and clipping, refine manually, then Apply. Fluorescence mode does not offer per-image automatic balancing.

**Image version → Retained original / Corrected** switches between preserved versions. Reopening uses the original pixels and recorded geometry. Scale calibration and ROIs need rechecking. See the [photo workflow and limits](../docs/figure-studio-photo-correction.md#english-quick-reference).

## Choose appearance and find tools

Open **Appearance → Interface theme** for default **Carbon Atelier** or light **Pearl Pro**. The 0.2.0 candidate refines the existing directory, setting surfaces and folded groups while retaining the jade selection accent. **Canvas surround** changes the area around the white figure page to neutral, dark or light. Figure colours, image pixels and exported artwork are independent of these preferences. The current browser remembers your choice; if it cannot save the preference, the menu explains this.

Six task categories open a single right-hand tool drawer: **Data & charts**, **Text & object style**, **Image processing**, **Layout & canvas**, **Annotations & measurement**, and **Review & export**. Every tool has one category. Project, versions, local preferences and layers live on the left; Help stays in the header. Object paint, image display, straightening rulers, physical calibration, analysis and statistical annotation remain distinct.

The contextual canvas toolbar shows common controls for the selected text or image. Font settings show the basics first; batch replacement, paragraph and character settings expand on demand and keep your explicit choices when selection changes. Search expands the requested advanced group. Find panel arrangement under Layout and duplicate screening under Review & export.

**Text content & character formatting** contains the existing live text editor and character tools. Opening it brings the group into view. Without a text selection, the disabled fallback field explains what to select; locked text remains protected.

Font-size changes preview on the canvas. Enter or moving focus keeps the edit; Escape restores the original value and ends the live-preview status without adding an undo entry.

Choose **Back to this category** to find related tools, or collapse/reopen **Tools** to resume the current settings. Selecting another canvas object retains the chosen tool. Search with **Ctrl + K**; aliases such as `text spacing` lead to one canonical text tool and focus the actual field. Selection requirements, locking, live-preview cancellation and one-step history remain in effect.

Use **Help → Send feedback** to prepare and review text, then confirm public submission on GitHub. Basic version diagnostics are optional and off by default. No project, image or measurement data are automatically attached. The deployed issue route assigns the maintainer; notifications depend on the account's existing GitHub/email settings. A prepared draft is not a submitted issue.

**Help → Downloads excluding QA** fetches public metadata only after an explicit click. It counts new stable Windows Setup/Portable downloads after the accounting baseline, subtracting registered QA. Lifetime net downloads remain unknown; downloads are not users. No usage telemetry is collected. An unpublished/unavailable ledger or inconsistent counters yields an unreconciled result. See the [workflow and accounting details](../docs/figure-studio-workspace-and-feedback.md).

## Adjust directly on the canvas

Version 0.1.26 supports [live canvas editing](../docs/live-preview-editing.en.md). Borders and image display dock beside the canvas; axis preview uses real local data without applying every input. Simple fields preview while typing and keep one edit on Enter or blur; Esc cancels. Drafts with an explicit Apply/Keep button must be kept before saving or exporting. Confirmation retains the real draft rendering and final validation; the palette pane keeps all eight complete previews. Candidate Enter/Esc during input-method composition does not end the whole edit; finish selecting the text before committing or cancelling. See the [acceptance report](../docs/live-preview-validation.md) and [Windows IME record](../docs/windows-native-ime-acceptance.md) for the actual scope.

## Start with Figure Discovery

Open **Figure Discovery** on the start page or **Chart types** tab. Upload CSV, TSV or XLSX (first worksheet, headers in row one), check the column mapping and confirm the design, experimental unit, data level, technical replicates and nesting. Describe your research purpose, sample and assay. Inferred information is marked separately and never establishes independence or pairing.

Click **Find suitable views** and compare the candidates' reasons, limitations and previews rendered from your own data. Normally 3–6 views are offered; scientific restrictions can yield fewer or none. Choose **Compare on canvas**, then **Apply current view** to keep it or **Cancel canvas preview** to restore the canvas. Continue editing, undo/redo, and save a project JSON. Desktop discovery needs no Node.js installation. The template data editor still accepts CSV/TSV; use Discovery for direct XLSX upload.

Literature lookup is optional and starts only after a click. Enter public topic/sample/assay keywords; never enter patient identifiers, measurements or private project content. Verified figure captions and merely related papers have different evidence labels. Paper images are not downloaded. Local recommendation, plotting and export work offline. See the bundled [discovery guide](../docs/figure-discovery.md).

## Create your first figure

1. Choose **Start from a template**, browse a category and enlarge the previews. **Start with example** loads example data: replace it with your own before using the figure. You can also import an existing SVG, image, or selected PDF page. Native text and vectors stay editable; image contents remain images. Review font substitutions in imported PDFs before export.
2. In **Data table**, paste cells (including an Excel range) or import CSV/TSV. Choose **Check data** to locate invalid cells, correct them, then **Update chart**. The first row must contain the template's required column names. **Auto-update** is optional. For direct `.xlsx` import, use Figure Discovery.
3. For group comparisons, expand **Statistical analysis** and choose **Set up analysis** (**Update analysis** when results exist). Confirm the recognized columns, data type, independent or paired design, and experimental unit. Methods appear in recommendation order; select one to calculate and preview the result, then choose **Apply to figure**. You can also connect existing comparison results. Model-result templates require their corresponding result tables.
4. Select, drag or draw a selection rectangle around objects to adjust text, colors, annotations and layout. Use **Undo** to go back. Set your publication dimensions, then open **Export** and choose **SVG**, **PNG**, or **TIF**. SVG retains vector artwork; PNG and TIFF use your chosen dimensions and resolution. Enlarging an imported low-resolution image cannot restore missing detail.
5. Choose **Save** to download a project JSON file. Use **Project → Open project** to continue later. SVG/PNG/TIFF files are figure exports; the project JSON is the backup containing editable state, data and version history.

**Undo and redo:** finish editing text or return focus to the canvas. Ctrl + Z undoes; Windows Ctrl + Y and Ctrl + Shift + Z redo. Cmd + Shift + Z remains available on macOS. The toolbar buttons use the same history. Focused text and property fields retain their native editing shortcuts.

Analyses linked to the current data are recomputed after valid data changes. Linked external results and retained results from split facets need reconnection or updating when their chart data changes; follow the message in the editor. Invalid or unfinished data edits preserve the last valid chart.

To add more figures, drag PDF, SVG, PNG, JPEG or WebP files from a folder into the canvas, header or sidebar. The green cell shows the import destination; an occupied cell is marked separately and its existing figure is kept. Multiple files are handled in sequence, and each PDF asks you to select a page. Drag one saved project JSON to open the whole workspace after confirmation. Dropping CSV/TSV opens the data workflow. Double-click editable text and click outside when finished. Grouped elements created in the editor can be separated with **Ungroup**; imported SVG text and shapes can be selected directly while their original transforms and clipping are retained.

Statistical styles and condition tables are in **Annotations**. For optional published examples, expand **Chart types → Examples in papers** and choose **Find examples**. Only this explicit search connects to Europe PMC, sending chart terms and an optional topic you type; research data stay local. [How caption checks and data previews work](../README.en.md#examples-in-papers).

**Adjust layout and chart components:** drag grid boundaries to set row heights or column widths. In **Properties → Style by component**, choose the part to change and whether it applies to this panel or the whole figure. To extend a recognized numeric axis, select the axis and drag its endpoint; ticks and numbers follow the existing mapping while data positions stay fixed. Use **Undo** to restore the previous state.

Select text to use **Text spacing** or copy its style with **Format painter**; use **Eyedropper** separately for shape colours. Shift-click panels to select several, then use the alignment control or **Delete**. Panel labels can be selected together with artwork. Lock finished content before further grid adjustments; unlock it to edit again. Deleting an empty cell removes only a wholly empty row or column.

The arrow beside **Format painter** chooses which styles to copy and whether to keep the imported font or use Arial / Times New Roman; keeping a font name does not install a missing font. Use **Copy** then **Paste elements** to duplicate editable text or shapes in the current panel, or select another panel or empty cell before pasting. Existing artwork, paper bounds and grid track sizes are preserved. Quick font-size edits apply when you leave the field. See the [editing guide](../README.en.md#image-insets-and-updates).

Open the alignment icon to see left, centre, right, top, middle and bottom actions. Equal horizontal or vertical spacing requires three or more editable items. The selection stays active after alignment, so direction keys can fine-tune its position before the next edit; hold Shift for a larger step.

## Save, quit and upgrade

**Download a project JSON regularly using Save.** Keep it in a folder you manage. **Project → Projects & presets** also provides a figure overview and an option to back up the whole collection.

Application settings, the workspace page and logs are under `%LOCALAPPDATA%\Figure Studio`. Autosaves, recent projects and the project collection are stored separately in your browser's local storage. Clearing site data, using a private window, or switching browser/profile can remove or hide those records. Copying the application data folder alone does not replace a downloaded project backup.

Closing a browser tab leaves the local service running. To stop it, choose **Quit** in the small Figure Studio launcher window, or close that window. Accepted calculations finish before the service exits.

**Upgrading from 0.1.8 or earlier:** save a project JSON, close Figure Studio, then run the 0.1.26 installer. The older update entry only opens a download; it cannot install this upgrade for you.

**Already on a local 0.1.26 candidate?** When replacing a local 0.1.26 candidate with the official build, save your project, close Figure Studio and run the official Setup linked above. The updater compares version numbers and will not offer another build with the same version.

**Already using installed 0.1.9–0.1.25?** You can use its in-app update flow. If 0.1.9 cannot prepare the update because a path is too long, save your project, close Figure Studio and run the linked 0.1.26 installer manually. Version 0.2.0 retains the long-path fix introduced in 0.1.10.

**Future updates from the 0.1.26 installer edition:** open **Updates**, choose **Download and prepare update**, and wait for the download and integrity check. Save your project, confirm that you are ready to close the editor, then choose **Install and reopen**. The installer keeps the supported application location and reopens Figure Studio on success; you do not need to extract or replace files. Installation is never started without confirmation, and Windows security prompts are not bypassed.

**Portable, source-run or unrecognized custom copies:** these are not forcibly overwritten. To use future in-editor upgrades, save a project JSON, quit the old copy, download and run the official Setup once using its default location, then open the installed desktop or Start-menu shortcut. Use **Project → Open project** to load your backup. If the installed copy still reports an unsupported setup, follow its specific error; installation-location and security checks remain in force. The older-version, same-version candidate and long-path exceptions above still apply.

The update window's cat and dog follow the actual download, verification and installation stage. Download 100% still requires integrity verification; wait for **Ready when you are** before confirming installation. Clear **Character animation (respects reduced motion)** to keep them still; progress and controls keep updating. A system reduced-motion preference also stops movement. Once the installer has taken over, an expected service shutdown retains the neutral installation message rather than appearing as a failed update. A connection problem before that handoff has its own **Check progress** action.

Normal upgrades and uninstallation do not deliberately delete the user data directory. Browser records remain subject to browser storage behavior and are not guaranteed to persist indefinitely. Unsigned releases may show an unknown-publisher or Windows security message; check the download source and the publisher's supplied checksum.

SHA-256 checksums compare file contents; they are not a publisher's digital signature. The official branding and download link identify the maintained distribution. They do not prevent copying or redistribution; the included licenses state the applicable terms.

## Image tools and professional axes

The unreleased candidate adds **Submission size and export → Submission profiles…**. Save researcher-declared dimensions and review thresholds, preview on the actual canvas, Keep or Cancel, then review the final output. Profiles travel with projects or separate JSON files; their sources are never fetched automatically. See the bundled [profile guide](docs/figure-studio-submission-profiles.md).

The unreleased candidate adds [native TIFF display](docs/figure-studio-native-tiff.md): import a TIFF, adjust its native window/gamma/LUT on the real canvas, then Keep or Cancel. Download the exact original afterward. **New display from original TIFF** reopens the retained plane in a separate display, preserving existing images and edits and sharing the original file. The guide is bundled for offline use and lists the supported formats. The release page remains the authority for published versions.

Use the five workflow shortcuts or the categorized **Find function** directory above. Shortcuts do not change a function's category. Selected objects expose contextual actions. Image tools keep source pixels local and require explicit Apply; professional native axes re-render from data in four sections: range, ticks, size and appearance. See [image tools](../docs/figure-studio-image-tools.md), [axes](../docs/figure-studio-axes-round2.md) and [actual acceptance scope](../docs/figure-studio-experience-round2-validation.md).


## Western blot workflow

The unreleased candidate adds **Image processing → WB processing & composition** (Ctrl+K: WB). Import retained originals, crop/straighten, confirm lane/source mappings and keep editable canvas objects. Suspend preserves a working draft. Original 16-bit TIFF and 8-bit display derivatives remain distinct; no densitometry is provided. See the bundled [workflow guide](docs/figure-studio-western-blot.zh-CN.md).

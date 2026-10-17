# Getting started with Figure Studio

Figure Studio creates, edits and arranges scientific figures. The Windows desktop edition supports Windows 10/11, 64-bit. Once installed, it works offline without Codex, a separate Python installation or an API key.

Figure Studio is the **official companion editor for polish-sci-figures**. The [zhoy0409-debug/polish-sci-figures repository](https://github.com/zhoy0409-debug/polish-sci-figures) is the project's sole official maintenance and release channel. Download installers from its **Releases** page. The launcher's **Official project** button opens that repository only when clicked. No account, activation or online verification is required.

2026-10-18: the [actual original official 0.1.20 → 0.1.22 update](https://github.com/zhoy0409-debug/polish-sci-figures/blob/main/docs/qa/live-preview/postrelease-20261018/README.md) passed, including automatic project recovery and normal cleanup. Its input scope is explicit; the separate 0.1.21 → 0.1.22 update with nonempty history, checkpoint and original-table draft also passed, including normal cleanup.

## Install and open

1. Download [polish-sci-figures-Studio-0.1.22-Setup-x64.exe](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.22/polish-sci-figures-Studio-0.1.22-Setup-x64.exe) from the [official v1.4.22 release](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.22), then follow the installer for your Windows user account.
2. Open **polish-sci-figures Studio** from the desktop or Start menu. When the small launcher window says **Editor is ready**, the editor opens in your default browser. You can also click **Open editor** in that window.
3. Choose **English** or **中文** at the top right. Opening the shortcut again opens the editor already running.

For the portable edition, extract the entire `polish-sci-figures-Studio-VERSION-Portable-x64.zip` before running `Figure Studio.exe`. Keep its adjacent `_internal` folder.

## Choose appearance and find tools

In Studio 0.1.22, open **Appearance → Interface theme** for default **Carbon Atelier** or light **Pearl Pro**. **Canvas surround** changes the area around the white figure page to neutral, dark or light. Figure colours, image pixels and exported artwork are independent of these preferences. The current browser remembers your choice; if it cannot save the preference, the menu explains this.

The inspector identifies the selected object type and prioritises related controls; expand other headings for more settings. Choose **Find command** or press **Ctrl + K** to search for `theme`, `border`, `duplicates` or `axis`. Search opens the existing tools. See the [appearance and update guide](../docs/figure-studio-appearance.md) for the exact controls, and the [0.1.22 release notes](../docs/release-notes-v1.4.22.md) for this build's validation status.


## Adjust directly on the canvas

Version 0.1.22 supports [live canvas editing](../docs/live-preview-editing.en.md). Borders and image display dock beside the canvas; axis preview uses real local data without applying every input. Simple fields preview while typing and keep one edit on Enter or blur; Esc cancels. Drafts with an explicit Apply/Keep button must be kept before saving or exporting. Confirmation retains the real draft rendering and final validation; the palette pane keeps all eight complete previews. Candidate Enter/Esc during input-method composition does not end the whole edit; finish selecting the text before committing or cancelling. See the [acceptance report](../docs/live-preview-validation.md) and [Windows IME record](../docs/windows-native-ime-acceptance.md) for the actual scope.

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

**Upgrading from 0.1.8 or earlier:** save a project JSON, close Figure Studio, then run the 0.1.22 installer. The older update entry only opens a download; it cannot install this upgrade for you.

**Already on a local 0.1.22 candidate?** Save your project, close Figure Studio and run the official 0.1.22 Setup linked above to replace it. The updater compares version numbers and will not offer another build with the same version.

**Already using installed 0.1.9–0.1.21?** You can use its in-app update flow. If 0.1.9 cannot prepare the update because a path is too long, save your project, close Figure Studio and run the linked 0.1.22 installer manually. Version 0.1.22 includes the long-path fix introduced in 0.1.10.

**Future updates from the 0.1.22 installer edition:** open **Updates**, choose **Download and prepare update**, and wait for the download and integrity check. Save your project, confirm that you are ready to close the editor, then choose **Install and reopen**. The installer keeps the same application location and reopens Figure Studio on success. The portable edition still uses manual replacement. Installation is never started without confirmation, and Windows security prompts are not bypassed.

The update window's cat and dog follow the actual download, verification and installation stage. Download 100% still requires integrity verification; wait for **Ready when you are** before confirming installation. Clear **Character animation (respects reduced motion)** to keep them still; progress and controls keep updating. A system reduced-motion preference also stops movement. Once the installer has taken over, an expected service shutdown retains the neutral installation message rather than appearing as a failed update. A connection problem before that handoff has its own **Check progress** action.

Normal upgrades and uninstallation do not deliberately delete the user data directory. Browser records remain subject to browser storage behavior and are not guaranteed to persist indefinitely. Unsigned releases may show an unknown-publisher or Windows security message; check the download source and the publisher's supplied checksum.

SHA-256 checksums compare file contents; they are not a publisher's digital signature. The official branding and download link identify the maintained distribution. They do not prevent copying or redistribution; the included licenses state the applicable terms.

## Image tools and professional axes

Use the five workflow entries, or **Find command** / Ctrl + K to search for borders, duplicate screening or tick intervals. Selected objects expose contextual actions. Image tools keep source pixels local and require explicit Apply; professional native axes re-render from data in four sections: range, ticks, size and appearance. See [image tools](../docs/figure-studio-image-tools.md), [axes](../docs/figure-studio-axes-round2.md) and [actual acceptance scope](../docs/figure-studio-experience-round2-validation.md).

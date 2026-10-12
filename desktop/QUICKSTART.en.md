# Getting started with Figure Studio

Figure Studio creates, edits and arranges scientific figures. The Windows desktop edition supports Windows 10/11, 64-bit. Once installed, it works offline without Codex, a separate Python installation or an API key.

Figure Studio is the **official companion editor for polish-sci-figures**. The [zhoy0409-debug/polish-sci-figures repository](https://github.com/zhoy0409-debug/polish-sci-figures) is the project's sole official maintenance and release channel. Download installers from its **Releases** page. The launcher's **Official project** button opens that repository only when clicked. No account, activation or online verification is required.

## Install and open

1. Run `polish-sci-figures-Studio-VERSION-Setup-x64.exe` and follow the installer for your Windows user account.
2. Open **polish-sci-figures Studio** from the desktop or Start menu. When the small launcher window says **Editor is ready**, the editor opens in your default browser. You can also click **Open editor** in that window.
3. Choose **English** or **中文** at the top right. Opening the shortcut again opens the editor already running.

For the portable edition, extract the entire `polish-sci-figures-Studio-VERSION-Portable-x64.zip` before running `Figure Studio.exe`. Keep its adjacent `_internal` folder.

## Create your first figure

1. Choose **Start from a template**, browse a category and enlarge the previews. **Start with example** loads example data: replace it with your own before using the figure. Alternatively, choose **Import image** to add existing images or diagrams.
2. Edit cells in the data table or replace the table with a **CSV/TSV** file. The first row must contain column names, and the data must match the template's input requirements. Valid changes update the chart; use **Recompute now** when needed. This import does not directly read `.xlsx` files; export CSV/TSV from your spreadsheet software first.
3. For group comparisons, expand **Statistical analysis** in the right pane and choose **Set up analysis** (**Update analysis** when results already exist). Map the group, value and experimental-unit ID columns, confirm the independent or paired design, choose a suitable method and click **Analyze and annotate**. You can also connect existing comparison results. Templates for fitted models or effect estimates require the corresponding result tables; drawing them does not perform those analyses automatically.
4. Select, drag or draw a selection rectangle around objects to adjust text, colors, annotations and layout. Use **Undo** to go back. Set your publication dimensions, then open **Export** and choose **SVG**, **PNG**, or **TIF**. SVG retains vector artwork; PNG and TIFF use your chosen dimensions and resolution. Enlarging an imported low-resolution image cannot restore missing detail.
5. Choose **Save** to download a project JSON file. Use **Project → Open project** to continue later. SVG/PNG/TIFF files are figure exports; the project JSON is the backup containing editable state, data and version history.

Analyses linked to the current data are recomputed after valid data changes. Linked external results and retained results from split facets need reconnection or updating when their chart data changes; follow the message in the editor. Invalid or unfinished data edits preserve the last valid chart.

## Save, quit and upgrade

**Download a project JSON regularly using Save.** Keep it in a folder you manage. **Project → Projects & presets** also provides a figure overview and an option to back up the whole collection.

Application settings, the workspace page and logs are under `%LOCALAPPDATA%\Figure Studio`. Autosaves, recent projects and the project collection are stored separately in your browser's local storage. Clearing site data, using a private window, or switching browser/profile can remove or hide those records. Copying the application data folder alone does not replace a downloaded project backup.

Closing a browser tab leaves the local service running. To stop it, choose **Quit** in the small Figure Studio launcher window, or close that window. Accepted calculations finish before the service exits.

Before upgrading, download your project backup and quit the application, then run the new installer. Normal upgrades and uninstallation do not deliberately delete the user data directory. Browser records remain subject to browser storage behavior and are not guaranteed to persist indefinitely. Unsigned releases may show an unknown-publisher or Windows security message; check the download source and the publisher's supplied checksum.

SHA-256 checksums compare file contents; they are not a publisher's digital signature. The official branding and download link identify the maintained distribution. They do not prevent copying or redistribution; the included licenses state the applicable terms.

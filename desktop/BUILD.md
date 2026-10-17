# Building Figure Studio for Windows

This guide is for maintainers building the standalone desktop distribution. End users receive an installer or portable ZIP; they do not run these commands or install Python. The entry point is [figure_studio_app.py](figure_studio_app.py), and [build_windows.py](build_windows.py) stages resources, freezes the runtime and packages the release.

Figure Studio is the official companion editor for **polish-sci-figures**. [zhoy0409-debug/polish-sci-figures](https://github.com/zhoy0409-debug/polish-sci-figures) is the sole official maintenance and release channel; publish distribution files through that repository's Releases. The launcher links to this fixed URL only when the user selects **Official project**. It performs no account, activation or online authenticity check. Bundle `desktop/resources/figure-studio.ico` under `_internal/suite` for the launcher window, in addition to the executable icon configured by the spec.

## Build environment

Use Windows with **CPython 3.12 x64**, including Tk, and **Inno Setup 7 or later** with its language files. The current build requirements record CPython 3.12.14 and pinned numerical/build packages. Build dependencies are separate from the runtime requirements used by the skill suite.

From the repository root, install the pinned build dependencies into your build environment:

```powershell
python -m pip install -r desktop/requirements-build.txt
```

Run the full build, replacing the quoted compiler path with your installed `ISCC.exe`:

```powershell
python desktop/build_windows.py --iscc "C:\path\to\Inno Setup 7\ISCC.exe"
```

The script regenerates the blank starter page, stages the suite and license notices, runs the windowed PyInstaller onedir build, and invokes Inno Setup. Application versions are set in `build_windows.py`; review that value before release.

Outputs are under `dist/desktop/`:

| Output | Purpose |
| --- | --- |
| `Figure Studio/` | Complete app directory, including `Figure Studio.exe` and `_internal` |
| `polish-sci-figures-Studio-VERSION-Setup-x64.exe` | Installer for the current Windows user |
| `polish-sci-figures-Studio-VERSION-Portable-x64.zip` | Complete portable app directory |
| `SHA256SUMS.txt` | SHA-256 values for the installer and ZIP |

The executable alone is not a portable distribution: keep the entire app directory. [FigureStudio.spec](FigureStudio.spec) bundles Python, Tk and the scientific libraries. Suite Python modules are distributed as adjacent `.pyc` files under `_internal/suite`, preserving renderers' relative-path lookups; HTML/JavaScript resources remain browser-readable. This packaging is not DRM and does not amend the MIT license. The launcher uses that bundled code in-process and never invokes a separately installed Python. The installed shortcut is named **polish-sci-figures Studio**; the internal executable, installation identity and user data paths remain unchanged for upgrade compatibility.

## Rebuilding resources

`--stage-only` prepares the starter page, suite files and notices without freezing or packaging. `--skip-freeze` reuses an existing frozen app and updates staged resources before packaging:

```powershell
python desktop/build_windows.py --iscc "C:\path\to\ISCC.exe" --skip-freeze
```

Use `--skip-freeze` only for resource changes compatible with the existing runtime, such as editor HTML/CSS/JavaScript or bundled renderer source that needs no new dependency. **Changes to `figure_studio_app.py`, the spec, runtime dependencies, hidden imports, executable branding or bootloader configuration require a full build.** Never use the flag to distribute a changed launcher without refreezing it.

## Verify the build

Run the launcher lifecycle tests against the source before packaging:

```powershell
python desktop/test_figure_studio_app.py -v
```

Then run the actual frozen executable's no-window self-test in an isolated data directory. From the repository root in PowerShell:

```powershell
$checkArgs = '--self-test --data-dir "{0}" --output-dir "{1}"' -f "$PWD\.cache\frozen-check-data", "$PWD\.cache\frozen-check-output"
$check = Start-Process -FilePath ".\dist\desktop\Figure Studio\Figure Studio.exe" -ArgumentList $checkArgs -WindowStyle Hidden -Wait -PassThru
$check.ExitCode
Get-Content .cache/frozen-check-output/self-test.json
```

Require exit code `0`, `passed: true` and `frozen: true`. The self-test creates and immediately hides a Tk window to verify Tcl/Tk resources, then uses real HTTP requests for analysis, rendering and physical-size reflow, checks matching data hashes and verifies request authorization. It writes `analysis.json`, `render.svg`, `reflow.svg` and `self-test.json`, including Tk/Tcl versions. Also repeat with system Python removed from the test process's PATH and without Python-specific environment configuration; this checks that the executable uses its bundled runtime.

The self-test does not prove every UI action or every template. Before publishing, install the installer in an isolated test location/account and check the shortcut, native launcher, browser opening, template creation, data replacement, saving/reopening a JSON project, SVG/PNG export, repeated launch and quitting. Check that reopening retains the same browser origin. Review any changed templates at their actual output sizes. Record the version and actual results; do not describe an untested package as verified.

## User data and release boundaries

Normal application data is stored in `%LOCALAPPDATA%\Figure Studio`; `--data-dir PATH` isolates tests. Autosaves and the project collection live separately in the browser's storage for the saved localhost origin. The launcher preserves its selected port across restarts and reports a conflict instead of silently changing the origin. Managed starter HTML can be refreshed when unchanged, while a user-replaced workspace page is preserved. The installer and uninstaller do not remove the application data directory; browser storage is not a permanent backup.

The current packaging process **does not code-sign** the executable or installer. Checksums detect file changes but do not identify the publisher. Expect unsigned Windows builds to be subject to publisher/reputation prompts. If signing is added, sign the final artifacts and regenerate their checksums afterward. Local build/self-test success is not a claim of Windows certification, signing or broad compatibility testing.

Official branding and a fixed repository link are distribution provenance, not copy protection, and do not guarantee that copies or modified distributions cannot be made. Preserve the project license and all third-party license notices; the official-channel designation does not amend their terms.

Include the generated license notices and both [Chinese](QUICKSTART.zh-CN.md) and [English](QUICKSTART.en.md) user guides in each distribution.

Windows builds can use `--outdir .cache/windows-release` when the default `dist` location is unavailable. The directory contains the complete frozen app, installer, portable archive and checksums. Published Mac/Android preview downloads remain at their last separately validated version; changing source version metadata does not publish those packages.

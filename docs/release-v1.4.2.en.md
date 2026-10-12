# polish-sci-figures v1.4.2

[English](release-v1.4.2.en.md) | [中文](release-v1.4.2.md)

Suite v1.4.2 and **Figure Studio 0.1.2** introduce a clearer editor toolbar and a visual introduction to the actual application. The homepage keeps the complete English introduction first, followed by Chinese.

## What changed

- **A calmer toolbar.** Save stays visible; Export groups SVG, PNG and TIF in one menu. New/open project, projects and presets, and restore move into the Project menu. Compact undo, redo and comparison controls leave more room for the figure, including in English.
- **Spacing changes are saved when you leave the field.** Entering a group-spacing percentage and pressing Tab or clicking elsewhere commits the preview, so it is retained in the saved project and can be undone.
- **See the editor before installing.** The homepage shows an actual application screenshot and a step-by-step animation, with static screenshots and bilingual instructions in the [editor tour](editor-tour.en.md).
- **Follow the same example.** The tour covers starting from a template, replacing data, refining a figure, saving the editable project, and exporting. Its [downloadable observations](media/demo-observations.csv) are synthetic demonstration data.
- **Matching downloads and guides.** Both Windows editions contain the updated interface. The source and single-entry skill packages include the tour and its media; the desktop package also carries the linked guides alongside its bundled runtime.

This update improves presentation, navigation, and editing. Statistical methods, data requirements, the 218 template starting points, and the existing SVG/PNG/TIFF export capabilities remain unchanged. Earlier host-validation and resource-test results are recorded in the [v1.4.1 notes](release-v1.4.1.en.md).

## Downloads

| Package | Intended use |
| --- | --- |
| [Windows installer](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.2/polish-sci-figures-Studio-0.1.2-Setup-x64.exe) | Windows 10/11 x64; install and open without separate Python or Codex |
| [Windows portable ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.2/polish-sci-figures-Studio-0.1.2-Portable-x64.zip) | Extract everything and run `Figure Studio.exe`; retain `_internal` |
| [Single-entry skill ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.2/polish-sci-figures-v1.4.2-skill.zip) | Upload into a compatible skill host; contains exactly one `SKILL.md` |
| [Three-skill source suite](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.2/sci-figure-suite-v1.4.2.zip) | Codex and other folder-based skill workflows, or local CLI use |
| [SHA256SUMS.txt](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.2/SHA256SUMS.txt) | Verify the four release files above |

Before upgrading, choose **Save** to download your project JSON, close Figure Studio, and run the new installer. Use **Project → Open project** to resume. The [desktop quick start](../desktop/QUICKSTART.en.md) and [platform guide](platform-installation.en.md) explain both routes.

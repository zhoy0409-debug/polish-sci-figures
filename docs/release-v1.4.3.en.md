# polish-sci-figures v1.4.3

[English](release-v1.4.3.en.md) | [中文](release-v1.4.3.md)

Suite v1.4.3 and **Figure Studio 0.1.3** make data analysis and figure editing easier to approach, with guided choices and direct visual feedback.

## What changed

- **Continue editing existing figures.** Import SVG or choose a page from a PDF. Supported native text and paths remain editable; embedded images stay images. Isolated PDF effects may become local image layers. When blending or transparency depends on the backdrop and cannot be preserved as separate objects, the whole page becomes an appearance image. This is a conversion limit, not evidence that the original PDF was image-only. Outlined letters and scanned text are not presented as editable characters. Review local font substitutions before export.
- **Choose an analysis with guidance.** Common group, value, and ID columns are recognized. Confirm the study design and comparison target to see applicable methods in recommendation order, with short explanations. Selecting a method calculates the result and previews it in the figure; apply when ready. Rankings follow suitability, never the smallest *P* value.
- **Refine automatic annotations.** Select a comparison line to adjust its left and right ends, width and bracket shape, or restore its automatic placement. Annotation text supports content and character formatting edits. Applying a new analysis resets manual statistical text and placement with a notice; undo restores the previous version.
- **Draw the line you intended.** Dedicated horizontal and vertical tools preserve direction. Drag either endpoint to change length, use free-line snapping or Shift to constrain the angle, and insert a comparison bracket for manual annotation. Text opens for editing where it is inserted.
- **Correct data where the problem is.** Paste a table, including an Excel range, or import CSV/TSV; choose **Check data**, then **Update chart**. Invalid cells are highlighted with an explanation. The editable draft and last valid figure remain available; unusual values are not silently removed or treated as errors just because they are extreme.
- **See a real palette difference.** Research red–blue stays first, alongside blue–orange–teal, teal–coral, violet–gold, Okabe–Ito categories, and single-hue scales. Previews use the current figure; diverging heatmaps retain a neutral center.
- **Refine observations and intervals.** Live sliders adjust sample-point size, error-bar cap length, and line width on supported artwork. Vertical error bars can show upper, lower, or both directions using the actual estimate, including asymmetric intervals and log axes.

The guide asks for design information that a table alone cannot establish. Binary, count, survival, or model-result data are not forced into an unsuitable continuous-outcome test; specialized results can be connected instead. Existing data and uncertainty definitions are retained when editing appearance.

## Downloads

| Package | Intended use |
| --- | --- |
| [Windows installer](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.3/polish-sci-figures-Studio-0.1.3-Setup-x64.exe) | Windows 10/11 x64; includes the runtime |
| [Windows portable ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.3/polish-sci-figures-Studio-0.1.3-Portable-x64.zip) | Extract everything and run `Figure Studio.exe`; retain `_internal` |
| [Single-entry skill ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.3/polish-sci-figures-v1.4.3-skill.zip) | Upload to a compatible skill host; exactly one `SKILL.md` |
| [Three-skill source suite](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.3/sci-figure-suite-v1.4.3.zip) | Codex and other folder-based skills, or local CLI use |
| [SHA256SUMS.txt](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.3/SHA256SUMS.txt) | Verify the four release files |

Before upgrading, choose **Save** to download your project JSON, close Figure Studio, and run the new installer. Resume with **Project → Open project**. See the [desktop quick start](../desktop/QUICKSTART.en.md) and [platform guide](platform-installation.en.md).

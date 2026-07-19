---
name: standardize-sci-images
description: Standardize microscopy, fluorescence, histology, and electron-microscopy images without compromising scientific integrity. Use for locked batch tone settings, equal pixel dimensions, calibrated scale bars, consistent crops, non-destructive processing, image manifests, scientific montages, and auditable publication-image preparation.
---

# Standardize Scientific Images

Prepare comparable scientific images as a documented batch. Preserve raw files, apply only declared global operations, and fail when an honest scale bar or comparable display cannot be produced.

## Start with the manifest

Read `references/image_contract.md`, then create a CSV manifest. At minimum it needs `file`, `output_name`, and `um_per_pixel` when a scale bar is requested. Add `batch` when images were acquired under different settings. The same comparison batch must share calibration and display settings.

```bash
python scripts/standardize_images.py manifest.csv \
  --outdir standardized --scale-bar-um 20
```

The command center-crops every image to a common pixel canvas and writes three practical derivatives: an unannotated display raster, a labelled preview, and an SVG panel whose faithful raster content remains embedded while scale bars and text stay editable vector/live layers. It also builds a montage and writes CSV/JSON audits containing source hashes and every operation. It never overwrites the source.

By default, the SVG physical width is set to the largest size that preserves 300 dpi. Use `--panel-width-mm` only for a known final slot; the command refuses a width that would fall below 300 dpi instead of inventing pixels.

## Scientific integrity rules

- Treat raw acquisition files as immutable. Write derivatives to a new directory and record source SHA-256 hashes.
- Never invent a scale bar. Require calibration from image metadata, acquisition software, or an authoritative record.
- Do not infer calibration from another image unless the acquisition record proves they share it.
- Apply the same crop policy, intensity window, gamma, and LUT to images in the same comparison batch. Do not tune each experimental group separately.
- Default to no tone adjustment. If display adjustment is needed, declare fixed `display_min`, `display_max`, `gamma`, and `lut` settings in the manifest.
- Keep higher-bit-depth single-channel data at their native depth until display mapping. Require an explicit native-unit display window; never silently cast 16-bit data to 8-bit.
- Preserve a quantitative image/table separately. Display normalization is not a substitute for quantitative preprocessing.
- Do not erase, clone, selectively blur, locally enhance, or move biological structures.
- Do not resample by default. Equalize size by a common crop. If resampling is scientifically justified, perform it in a documented downstream workflow and update calibration.

Read `references/integrity_and_layout.md` before processing fluorescence composites, electron micrographs, unequal calibrations, or images used for quantification.

## Layout rules

- Use one target canvas per comparison set, with identical output pixel dimensions and equal gutters.
- Use one physical SVG panel size per slot class and verify effective raster dpi at that final size.
- Use the same scale-bar length and placement within a comparable batch when it fits the shared field of view.
- Center the scale-bar label over the bar; do not right-align it to the bar endpoint. Keep this alignment and type size identical across the batch.
- Keep scale bars inside a safety margin and choose black or white from the local background for contrast.
- Do not add panel letters, serial numbers, per-image titles, or conclusions by default. Add only explicitly requested sample labels that are necessary to interpret the image.
- Keep captions, acquisition settings, and interpretation outside the image montage.
- Do not stretch images to make them fit. Crop consistently and record the crop box.
- Keep scale bars and their labels editable in the SVG delivery layer. Treat the underlying scientific image as faithful raster content, not as a fully vector-editable object.
- Judge scale-bar and sample-label size in the final panel or montage, not while zoomed into the source. Use one readable label hierarchy and baseline within each slot class.

## Finish with the polish skill

Use `$polish-sci-figures` for final multi-panel grid assembly, font selection, whitespace control, overlap checks, and placement in the manuscript or slide. A visually aligned montage does not pass if calibration, processing provenance, or comparability is unresolved.

Read `references/professional_basis.md` for the image-integrity, publication-layer, calibration, metadata, and reporting sources behind these safeguards. The implementation is original to this repository.

## Acceptance gate

Do not deliver if any raw file was changed, calibration is absent or guessed, comparison-batch display settings differ, crops remove different scientific regions without justification, outputs differ in size, a scale bar is clipped, incorrect, or too small at final size, or unrequested labels/titles/serial numbers appear.

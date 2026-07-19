# Integrity and layout guide

## Raw, quantitative, and display layers

Keep three concepts separate:

1. Raw acquisition: immutable original data and metadata.
2. Quantitative derivative: segmentation, measurements, masks, or calibrated intensities produced by a declared analysis pipeline.
3. Display derivative: crop, global intensity window, LUT, scale bar, and layout used for communication.

Never measure intensity from a contrast-normalized montage. Never present a display-only operation as quantitative preprocessing.

## Batch locking

Define comparison batches from acquisition settings and the scientific contrast. Within a batch, lock the intensity window, gamma, LUT, crop policy, scale-bar policy, and output size before looking for the visually most favorable group. If an image cannot be displayed fairly under that policy, disclose it; do not tune it privately.

## Calibration

Calibration is tied to the source pixels. Center cropping preserves it. Resampling changes it. Screenshots and pasted images often lose acquisition metadata, so require an authoritative `um_per_pixel` value before drawing a bar. Record bar length in micrometres and pixels in the audit.

Keep the scale bar and label on editable vector/live layers in the publication panel rather than flattening them into the scientific raster. A flattened preview is useful for review, but it must not be the only deliverable.

## Fluorescence and electron microscopy

- Avoid saturated highlights that erase intensity relationships.
- Keep channel colors stable across the series; describe false-color LUTs in the legend/methods.
- For composites, retain the single-channel source images and disclose channel mapping.
- Do not apply local contrast, selective sharpening, object removal, or cloning.
- For electron micrographs, use calibration from the acquisition record and do not move or reconstruct structures to improve composition.

## Cropping and layout

Use a common field-of-view/crop rule for comparison images. Center crop is only a neutral default when the biologically relevant region was acquired consistently. If regions of interest differ, define the ROI scientifically and record coordinates. Do not stretch images. Put narrative titles and panel letters outside reusable image assets unless the target explicitly requires them.

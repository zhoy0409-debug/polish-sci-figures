# Image reuse screening

## Screen image reuse when reviewing image panels

For a figure containing two or more scientific raster images, include local duplicate screening in final image QA when the source images are available. Also accept ordinary requests such as “看看这些图有没有放重” or “Check these images for reuse.” Use the complete suite's CLI from the suite root; paths to user inputs and outputs must remain in the user's workspace:

```bash
python sci_figures.py duplicates image-a.png image-b.tif figure.svg --out image-check
```

The check compares 2–60 raster images, including raster images embedded in SVG, without modifying the artwork. The editor offers the same check for the current figure, selected images, or local files. Read [the image duplicate guide](../../../docs/image-duplicate-check.md) for the supported scope and report workflow. A local service is required for screening from a standalone Studio HTML page; the installed desktop application starts it automatically.

Review exact-image findings and suspected transformed/cropped overlaps with the original files and acquisition records. Preserve the pair identities, matching evidence and report in the QA delivery. Never delete images automatically or call a similarity result proof of misconduct. Intended reuse, shared controls and related acquisition channels need contextual review. Do not describe an empty report as proof of uniqueness or exhaustive image-integrity certification. This is cross-image screening, not detection of copy-move edits within one image or automatic segmentation of a flattened multipanel screenshot; vector chart glyphs are not image candidates.

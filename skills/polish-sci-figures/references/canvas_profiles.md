# Canvas and final-size typography contract

Read this file whenever multiple standalone SVG panels will later be assembled
into a manuscript figure, poster, Word document, or PowerPoint grid.

## Root cause

A nominal 10 pt label does not remain visually consistent when SVG files with
different canvas sizes are independently scaled to fit equal layout cells.
Tight export cropping makes the problem worse because each plot receives a
different physical canvas even when the source `figsize` was identical.

The fix is to draw for the final slot and avoid post-export scaling.

## Define slot classes

Before plotting, define each repeated slot by physical size. Example only:

```text
equal-panel:  90 mm × 68 mm
wide-panel:  184 mm × 68 mm
tall-panel:   90 mm × 140 mm
```

Use the real manuscript or slide grid instead of copying these example values.
Every asset in one slot class must share the same physical width, height, and
viewBox dimensions. Different slot classes may have different canvases, but
they must use the same final-size typography hierarchy.

## Matplotlib pattern

```python
MM_PER_INCH = 25.4
width_mm, height_mm = 90, 68
fig, ax = plt.subplots(figsize=(width_mm / MM_PER_INCH,
                               height_mm / MM_PER_INCH))

# Reserve margins inside the fixed canvas. Tune once per slot class.
fig.subplots_adjust(left=0.18, right=0.97, bottom=0.20, top=0.94)

# Do not pass bbox_inches="tight".
fig.savefig("panel.svg", transparent=True)  # presentation example
```

The bundled style sets `savefig.bbox: standard`. Do not override it with
`tight`. Constrained layout may arrange axes inside the canvas, but it must not
change the exported physical canvas.

## Final placement rule

Insert the SVG at the declared physical width and height: 100% scale. If a
figure does not fit, regenerate it for the new slot. Do not resize individual
SVGs by eye in Illustrator, Word, PowerPoint, or layout software.

For presentation mode with no existing template, a reasonable starting
hierarchy is 11 pt ticks, 12 pt axis titles, 10 pt legends/statistical notes,
and 14 pt panel labels at the final placed size. The user's deck and viewing
distance override these defaults. Manuscript typography must follow the target
journal at final print width.

## Audit

Run the auditor separately for every slot class:

```bash
python scripts/check_svg_canvas.py final_figures/panel_*.svg
```

Or require a declared target:

```bash
python scripts/check_svg_canvas.py --width-mm 90 --height-mm 68 \
  final_figures/panel_*.svg
```

Any mismatch is a delivery blocker. After the audit passes, place the figures
at their declared size and render the real page or slide to verify typography,
spacing, and alignment.

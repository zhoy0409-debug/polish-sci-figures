# Image manifest contract

Use a UTF-8 CSV with one source image per row.

| Column | Required | Meaning |
| --- | --- | --- |
| `file` | yes | Source path, relative to the manifest or absolute |
| `output_name` | yes | Safe output stem without an extension |
| `um_per_pixel` | for scale bars | Physical calibration in micrometres per source pixel |
| `batch` | recommended | Images compared under one acquisition/display policy |
| `scale_bar_um` | optional | Row/batch override for scale-bar length |
| `display_min` | optional for 8-bit; required for higher bit depth | Fixed lower display bound in native intensity units |
| `display_max` | optional for 8-bit; required for higher bit depth | Fixed upper display bound in native intensity units |
| `gamma` | optional | Fixed display gamma; default 1.0 |
| `lut` | optional | `gray`, `green`, `magenta`, or `cyan` for single-channel images |
| `label` | optional | Explicitly requested sample label; blank by default |

Rules:

- `um_per_pixel` must come from the image/acquisition record. Do not estimate it from a screenshot.
- Rows in the same batch must share `um_per_pixel`, `display_min`, `display_max`, `gamma`, and `lut` unless they are not used for visual comparison.
- For 8-bit data, omitted display bounds mean 0-255. Higher-bit-depth single-channel data require explicit bounds in native intensity units and are mapped only for the display derivative; source data remain untouched.
- Labels are not panel letters. Keep `label` blank unless the user explicitly needs a sample/condition identifier in the image.
- Relative source paths resolve from the manifest directory.

Each row produces `<name>_display.png`, `<name>_preview.png`, and `<name>.svg`. The SVG embeds the display raster and keeps its scale bar and text as separate editable elements. It is therefore scientifically faithful and practically editable, but not a fully vector scientific image.

The SVG stores a physical width/height in millimetres plus a pixel-coordinate `viewBox`. If `--panel-width-mm` is omitted, the width is derived at 300 dpi. A requested width that would reduce effective resolution below 300 dpi is rejected.

#!/usr/bin/env python3
"""Non-destructive, batch-locked preparation of scientific raster images."""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import math
from pathlib import Path
from xml.sax.saxutils import escape

import numpy as np
import pandas as pd
from PIL import Image, ImageDraw, ImageFont

LOCKED_COLUMNS = ["um_per_pixel", "display_min", "display_max", "gamma", "lut", "scale_bar_um"]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_path(manifest: Path, text: str) -> Path:
    path = Path(text)
    if not path.is_absolute():
        path = manifest.parent / path
    return path.resolve()


def clean_scalar(value, default=None):
    if value is None or (isinstance(value, float) and math.isnan(value)) or str(value).strip() == "":
        return default
    return value


def validate_manifest(df: pd.DataFrame, manifest: Path, require_scale: bool) -> pd.DataFrame:
    required = {"file", "output_name"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Manifest is missing required columns: {sorted(missing)}")
    df = df.copy()
    for column, default in {"batch": "batch_1", "gamma": 1.0, "lut": "gray", "label": ""}.items():
        if column not in df:
            df[column] = default
        df[column] = df[column].fillna(default)
    if require_scale and "um_per_pixel" not in df:
        raise ValueError("A scale bar requires an authoritative um_per_pixel column.")
    df["_source"] = [source_path(manifest, str(x)) for x in df["file"]]
    absent = [str(p) for p in df["_source"] if not p.is_file()]
    if absent:
        raise FileNotFoundError(f"Source images not found: {absent}")
    if df["output_name"].astype(str).duplicated().any():
        raise ValueError("output_name values must be unique.")
    if require_scale:
        calibration = pd.to_numeric(df["um_per_pixel"], errors="coerce")
        if calibration.isna().any() or (calibration <= 0).any():
            raise ValueError("Every scale-bar image needs a positive numeric um_per_pixel value.")
        df["um_per_pixel"] = calibration
    for batch, rows in df.groupby("batch", dropna=False):
        for column in LOCKED_COLUMNS:
            if column not in rows:
                continue
            values = rows[column].map(
                lambda value: "<missing>" if clean_scalar(value) is None else str(clean_scalar(value)).strip()
            )
            if values.nunique() > 1:
                raise ValueError(
                    f"Batch '{batch}' has mixed {column} settings: {sorted(values.unique())}. "
                    "Split it into honest batches or lock one setting."
                )
    return df


def open_source(path: Path) -> Image.Image:
    # Detach pixel data from the source file immediately.  Pillow otherwise
    # keeps formats such as TIFF open until the Image object is collected,
    # which can lock raw microscopy files on Windows.
    with Image.open(path) as opened:
        if opened.mode in {"L", "RGB", "RGBA", "I;16", "I", "F"}:
            image = opened.copy()
        else:
            image = opened.convert("RGB")
            image.load()
    return image


def center_crop(image: Image.Image, width: int, height: int) -> tuple[Image.Image, tuple[int, int, int, int]]:
    if image.width < width or image.height < height:
        raise ValueError(
            f"Target {width}x{height} is larger than source {image.width}x{image.height}; "
            "padding/resampling is not automatic. Choose a shared crop no larger than every source."
        )
    left = (image.width - width) // 2
    top = (image.height - height) // 2
    box = (left, top, left + width, top + height)
    return image.crop(box), box


def apply_display(image: Image.Image, display_min, display_max, gamma: float, lut: str) -> Image.Image:
    high_bit = image.mode in {"I;16", "I", "F"}
    if high_bit and (clean_scalar(display_min) is None or clean_scalar(display_max) is None):
        raise ValueError(
            "Higher-bit-depth single-channel images require explicit batch-locked display_min and display_max "
            "in native intensity units; they will not be silently truncated."
        )
    lo = float(clean_scalar(display_min, 0.0))
    hi = float(clean_scalar(display_max, 255.0))
    gamma = float(clean_scalar(gamma, 1.0))
    lut = str(clean_scalar(lut, "gray")).lower()
    if not (0 <= lo < hi) or (not high_bit and hi > 255):
        limit = "native intensity range" if high_bit else "0-255"
        raise ValueError(f"display_min/display_max must satisfy 0 <= min < max within {limit}; got {lo}, {hi}")
    if gamma <= 0:
        raise ValueError("gamma must be positive.")
    no_adjustment = not high_bit and lo == 0 and hi == 255 and gamma == 1.0
    if image.mode in {"RGB", "RGBA"}:
        if lut != "gray":
            raise ValueError("A single-channel LUT cannot be applied to an RGB composite.")
        if no_adjustment:
            return image.convert("RGB")
        arr = np.asarray(image.convert("RGB"), dtype=float)
        arr = np.clip((arr - lo) / (hi - lo), 0, 1) ** (1.0 / gamma)
        return Image.fromarray(np.round(arr * 255).astype(np.uint8), "RGB")
    arr = np.asarray(image if high_bit else image.convert("L"), dtype=float)
    arr = np.clip((arr - lo) / (hi - lo), 0, 1) ** (1.0 / gamma)
    gray = np.round(arr * 255).astype(np.uint8)
    if lut == "gray":
        rgb = np.stack([gray, gray, gray], axis=-1)
    elif lut == "green":
        rgb = np.stack([np.zeros_like(gray), gray, np.zeros_like(gray)], axis=-1)
    elif lut == "magenta":
        rgb = np.stack([gray, np.zeros_like(gray), gray], axis=-1)
    elif lut == "cyan":
        rgb = np.stack([np.zeros_like(gray), gray, gray], axis=-1)
    else:
        raise ValueError("lut must be gray, green, magenta, or cyan.")
    return Image.fromarray(rgb, "RGB")


def find_font(size: int) -> tuple[ImageFont.ImageFont, str]:
    candidates = [
        Path("C:/Windows/Fonts/arial.ttf"),
        Path("/usr/share/fonts/truetype/msttcorefonts/Arial.ttf"),
        Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for path in candidates:
        if path.is_file():
            return ImageFont.truetype(str(path), size=size), str(path)
    return ImageFont.load_default(), "Pillow default bitmap font"


def contrast_color(image: Image.Image, box: tuple[int, int, int, int]) -> str:
    patch = np.asarray(image.crop(box).convert("L"), dtype=float)
    return "white" if float(np.mean(patch)) < 128 else "black"


def draw_scale_bar(image: Image.Image, um_per_pixel: float, bar_um: float,
                   label_bar: bool = True) -> tuple[Image.Image, dict]:
    out = image.copy().convert("RGB")
    length_px = int(round(bar_um / um_per_pixel))
    margin = max(12, int(round(min(out.size) * 0.035)))
    thickness = max(4, int(round(out.height * 0.012)))
    if length_px <= 0 or length_px > out.width - 2 * margin:
        raise ValueError(
            f"Scale bar {bar_um} um equals {length_px} px and does not fit the {out.width}-px canvas."
        )
    x1 = out.width - margin
    x0 = x1 - length_px
    y1 = out.height - margin
    y0 = y1 - thickness
    sample_box = (max(0, x0 - 6), max(0, y0 - 28), min(out.width, x1 + 6), min(out.height, y1 + 6))
    color = contrast_color(out, sample_box)
    draw = ImageDraw.Draw(out)
    draw.rectangle((x0, y0, x1, y1), fill=color)
    font_size = max(18, int(round(out.height * 0.070)))
    font, font_path = find_font(font_size)
    label = f"{bar_um:g} µm"
    label_box = None
    if label_bar:
        bounds = draw.textbbox((0, 0), label, font=font)
        text_w = bounds[2] - bounds[0]
        text_h = bounds[3] - bounds[1]
        tx = (x0 + x1 - text_w) / 2
        ty = max(margin, y0 - text_h - 7)
        draw.text((tx, ty), label, font=font, fill=color)
        label_box = [tx, ty, tx + text_w, ty + text_h]
    return out, {
        "scale_bar_um": float(bar_um), "scale_bar_pixels": int(length_px),
        "scale_bar_box": [x0, y0, x1, y1], "scale_bar_color": color,
        "scale_bar_label": label if label_bar else None,
        "scale_bar_label_box": label_box, "font_size_pixels": font_size,
        "scale_bar_label_alignment": "centered_over_scale_bar",
        "font_file": Path(font_path).name if Path(font_path).suffix else font_path,
    }


def draw_optional_label(image: Image.Image, text: str) -> tuple[Image.Image, dict | None]:
    text = str(clean_scalar(text, "")).strip()
    if not text:
        return image, None
    out = image.copy()
    draw = ImageDraw.Draw(out)
    font_size = max(14, int(round(out.height * 0.050)))
    font, font_path = find_font(font_size)
    margin = max(12, int(round(min(out.size) * 0.035)))
    bounds = draw.textbbox((0, 0), text, font=font)
    w, h = bounds[2] - bounds[0], bounds[3] - bounds[1]
    sample = (margin - 4, margin - 4, min(out.width, margin + w + 4), min(out.height, margin + h + 4))
    color = contrast_color(out, sample)
    draw.text((margin, margin), text, font=font, fill=color)
    return out, {"label": text, "label_box": [margin, margin, margin + w, margin + h],
                 "label_color": color, "font_size_pixels": font_size,
                 "font_file": Path(font_path).name if Path(font_path).suffix else font_path}


def write_editable_panel_svg(display_image: Image.Image, output: Path,
                             scale_bar: dict | None, label: dict | None,
                             panel_width_mm: float, panel_height_mm: float) -> None:
    """Embed the faithful raster while keeping bar and text as vector/live layers."""
    buffer = io.BytesIO()
    display_image.convert("RGB").save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    width, height = display_image.size
    elements = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'width="{panel_width_mm:.3f}mm" height="{panel_height_mm:.3f}mm" viewBox="0 0 {width} {height}">',
        '<g id="scientific-image">',
        f'<image id="display-raster" x="0" y="0" width="{width}" height="{height}" '
        f'href="data:image/png;base64,{encoded}"/>',
        '</g>',
        '<g id="editable-overlays" font-family="Arial, Helvetica, sans-serif">',
    ]
    if scale_bar:
        x0, y0, x1, y1 = scale_bar["scale_bar_box"]
        color = scale_bar["scale_bar_color"]
        elements.append(
            f'<rect id="scale-bar" x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" fill="{color}"/>'
        )
        if scale_bar.get("scale_bar_label_box") and scale_bar.get("scale_bar_label"):
            _, _, _, ty1 = scale_bar["scale_bar_label_box"]
            bar_center = (x0 + x1) / 2
            elements.append(
                f'<text id="scale-bar-label" x="{bar_center}" y="{ty1}" text-anchor="middle" '
                f'font-size="{scale_bar["font_size_pixels"]}px" fill="{color}">'
                f'{escape(scale_bar["scale_bar_label"])}</text>'
            )
    if label:
        x0, _, _, y1 = label["label_box"]
        elements.append(
            f'<text id="sample-label" x="{x0}" y="{y1}" font-size="{label["font_size_pixels"]}px" '
            f'fill="{label["label_color"]}">{escape(label["label"])}</text>'
        )
    elements.extend(['</g>', '</svg>'])
    output.write_text("\n".join(elements), encoding="utf-8")


def make_montage(files: list[Path], output: Path, columns: int = 2, gutter: int = 18) -> None:
    images = [Image.open(p).convert("RGB") for p in files]
    width = max(im.width for im in images)
    height = max(im.height for im in images)
    rows = math.ceil(len(images) / columns)
    canvas = Image.new("RGB", (columns * width + (columns - 1) * gutter,
                               rows * height + (rows - 1) * gutter), "white")
    for index, image in enumerate(images):
        row, column = divmod(index, columns)
        canvas.paste(image, (column * (width + gutter), row * (height + gutter)))
    canvas.save(output)


def standardize(manifest: Path, outdir: Path, target_width: int | None = None,
                target_height: int | None = None, scale_bar_um: float | None = None,
                label_scale_bar: bool = True, output_format: str = "png",
                panel_width_mm: float | None = None) -> list[dict]:
    raw = pd.read_csv(manifest)
    row_scale = "scale_bar_um" in raw and pd.to_numeric(raw["scale_bar_um"], errors="coerce").notna().any()
    df = validate_manifest(raw, manifest, require_scale=scale_bar_um is not None or row_scale)
    sizes = []
    modes = []
    for path in df["_source"]:
        with Image.open(path) as image:
            sizes.append(image.size)
            modes.append(image.mode)
    width = int(target_width or min(w for w, _ in sizes))
    height = int(target_height or min(h for _, h in sizes))
    physical_width_mm = float(panel_width_mm or (width / 300 * 25.4))
    if physical_width_mm <= 0:
        raise ValueError("panel_width_mm must be positive.")
    effective_dpi = width / (physical_width_mm / 25.4)
    if effective_dpi < 300 - 1e-6:
        raise ValueError(
            f"The requested {physical_width_mm:g} mm panel would provide only {effective_dpi:.1f} dpi. "
            "Use a smaller final panel or a higher-resolution source; pixels will not be invented."
        )
    physical_height_mm = physical_width_mm * height / width
    outdir.mkdir(parents=True, exist_ok=True)
    records = []
    outputs = []
    for index, row in df.iterrows():
        source = Path(row["_source"])
        before_hash = sha256(source)
        image = open_source(source)
        cropped, crop_box = center_crop(image, width, height)
        display = apply_display(cropped, row.get("display_min"), row.get("display_max"),
                                row.get("gamma", 1.0), row.get("lut", "gray"))
        preview = display.copy()
        bar_value = clean_scalar(row.get("scale_bar_um"), scale_bar_um)
        bar_audit = None
        if bar_value is not None:
            preview, bar_audit = draw_scale_bar(preview, float(row["um_per_pixel"]),
                                                float(bar_value), label_scale_bar)
        preview, label_audit = draw_optional_label(preview, row.get("label", ""))
        stem = str(row["output_name"])
        display_png = outdir / f"{stem}_display.png"
        preview_output = outdir / f"{stem}_preview.png"
        svg_output = outdir / f"{stem}.svg"
        display.save(display_png)
        preview.save(preview_output)
        write_editable_panel_svg(display, svg_output, bar_audit, label_audit,
                                 physical_width_mm, physical_height_mm)
        archival_output = None
        if output_format == "tiff":
            archival_output = outdir / f"{stem}_display.tif"
            display.save(archival_output)
        after_hash = sha256(source)
        if after_hash != before_hash:
            raise RuntimeError(f"Source file changed during processing: {source}")
        record = {
            "source": str(row["file"]), "source_sha256": before_hash, "source_mode": modes[index],
            "source_width": sizes[index][0], "source_height": sizes[index][1],
            "display_raster": display_png.name, "annotated_preview": preview_output.name,
            "editable_panel_svg": svg_output.name,
            "optional_archival_raster": archival_output.name if archival_output else None,
            "output_width": width, "output_height": height,
            "panel_width_mm": physical_width_mm, "panel_height_mm": physical_height_mm,
            "effective_raster_dpi_at_panel_size": effective_dpi,
            "crop_box_source_pixels": list(crop_box), "batch": str(row.get("batch", "batch_1")),
            "um_per_pixel": clean_scalar(row.get("um_per_pixel")),
            "display_min": float(clean_scalar(row.get("display_min"), 0.0)),
            "display_max": float(clean_scalar(row.get("display_max"), 255.0)),
            "gamma": float(clean_scalar(row.get("gamma"), 1.0)),
            "lut": str(clean_scalar(row.get("lut"), "gray")),
            "scale_bar": bar_audit, "optional_label": label_audit,
            "resampled": False, "raw_modified": False,
            "svg_editability": "Raster image content with editable vector scale bar and live text overlays.",
        }
        records.append(record)
        outputs.append(preview_output)
    pd.DataFrame(records).to_csv(outdir / "image_audit.csv", index=False)
    (outdir / "image_audit.json").write_text(
        json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    make_montage(outputs, outdir / "montage.png")
    return records


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("manifest")
    p.add_argument("--outdir", required=True)
    p.add_argument("--target-width", type=int)
    p.add_argument("--target-height", type=int)
    p.add_argument("--scale-bar-um", type=float)
    p.add_argument("--no-scale-bar-label", action="store_true")
    p.add_argument("--format", choices=["png", "tiff"], default="png")
    p.add_argument("--panel-width-mm", type=float,
                   help="Final SVG panel width; omitted means the largest width that preserves 300 dpi")
    return p


def main() -> None:
    args = parser().parse_args()
    records = standardize(Path(args.manifest), Path(args.outdir), args.target_width,
                          args.target_height, args.scale_bar_um, not args.no_scale_bar_label,
                          args.format, args.panel_width_mm)
    print(f"Standardized {len(records)} images in {Path(args.outdir).resolve()}")


if __name__ == "__main__":
    main()

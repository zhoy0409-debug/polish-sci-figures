"""Build a contact-sheet montage from figure images for cross-figure QA.

A single montage makes inconsistent fonts, panel sizes, color drift, and
label styles jump out at a glance -- far faster than opening each PNG alone.

Usage
-----
    python make_montage.py qa/final_montage.png final_figures/*.png
    python make_montage.py -c 3 --label out.png fig1.png fig2.png fig3.png

Requires: Pillow.
"""
from __future__ import annotations

import argparse
import math
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")


def build_montage(paths, out, cols=0, pad=16, bg=(255, 255, 255), label=False):
    imgs = [Image.open(p).convert("RGB") for p in paths]
    if not imgs:
        sys.exit("no input images")
    n = len(imgs)
    cols = cols or math.ceil(math.sqrt(n))
    rows = math.ceil(n / cols)

    cell_w = max(im.width for im in imgs)
    cell_h = max(im.height for im in imgs)
    lab_h = 22 if label else 0

    W = cols * cell_w + (cols + 1) * pad
    H = rows * (cell_h + lab_h) + (rows + 1) * pad
    sheet = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()

    for i, (im, p) in enumerate(zip(imgs, paths)):
        r, c = divmod(i, cols)
        x = pad + c * (cell_w + pad) + (cell_w - im.width) // 2
        y = pad + r * (cell_h + lab_h + pad)
        if label:
            draw.text((x, y), os.path.basename(p), fill=(0, 0, 0), font=font)
        sheet.paste(im, (x, y + lab_h))

    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    sheet.save(out)
    print(f"wrote {out}  ({cols}x{rows} grid, {n} figures)")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("output", help="output PNG path")
    ap.add_argument("inputs", nargs="+", help="input figure images")
    ap.add_argument("-c", "--cols", type=int, default=0, help="columns (default: sqrt)")
    ap.add_argument("--pad", type=int, default=16, help="padding px")
    ap.add_argument("--label", action="store_true", help="print filename over each cell")
    a = ap.parse_args(argv)
    build_montage(a.inputs, a.output, cols=a.cols, pad=a.pad, label=a.label)


if __name__ == "__main__":
    main()

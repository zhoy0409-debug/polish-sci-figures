"""Independent Pillow decoder for public QA exports; never modifies input files."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


def inspect(path):
    raw = Path(path).read_bytes()
    with Image.open(path) as image:
        image.load()
        dpi = image.info.get("dpi")
        return {
            "format": image.format,
            "mode": image.mode,
            "width": image.width,
            "height": image.height,
            "dpi": [float(value) for value in dpi] if dpi else None,
            "rawSha256": hashlib.sha256(raw).hexdigest(),
            "rgbaSha256": hashlib.sha256(image.convert("RGBA").tobytes()).hexdigest(),
            "frames": getattr(image, "n_frames", 1),
        }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+")
    args = parser.parse_args()
    print(json.dumps([inspect(file) for file in args.files]))

"""Create a labelled synthetic 48 MB, two-page uint16 TIFF for local WB QA."""
from pathlib import Path
import argparse
import hashlib
import json
import numpy as np
from PIL import Image, TiffImagePlugin

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    image = np.tile(np.linspace(52000, 60000, 4000, dtype=np.uint16), (3000, 1))
    for y in (1000, 2000):
        for lane in range(8):
            image[y:y + 45, 400 + lane * 400:600 + lane * 400] = 4000 + lane * 1000
    pages = [Image.fromarray(image), Image.fromarray(np.minimum(image.astype(np.uint32) + 1000, 65535).astype(np.uint16))]
    tags = TiffImagePlugin.ImageFileDirectory_v2()
    tags[270] = 'PUBLIC SYNTHETIC QA ONLY - NOT EXPERIMENTAL OBSERVATIONS'
    target = args.out / 'PUBLIC-SYNTHETIC-16bit-two-pages.tif'
    pages[0].save(target, save_all=True, append_images=pages[1:], compression='raw', tiffinfo=tags)
    report = {'author': 'a', 'purpose': 'SYNTHETIC engineering QA, not research observations or independent accuracy labels',
              'name': target.name, 'bytes': target.stat().st_size, 'width': 4000, 'height': 3000,
              'pages': 2, 'bits': 16, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
    (args.out / 'fixture.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report))

if __name__ == '__main__':
    main()

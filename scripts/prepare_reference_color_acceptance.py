"""Prepare transparent real-source display-colour acceptance cases.

Uses a published public-domain H&E image from the separately verified source
catalogue. The full image is retained as a gate case. An explicitly recorded
natural-field crop provides a stable near-white border for a positive UI case.
Only the reference files receive the documented mild linear-RGB display gains.
These selected engineering cases do not validate stain normalization accuracy.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def bias(image: Image.Image, gains: list[float]) -> Image.Image:
    rgb = np.asarray(image.convert('RGB'), dtype=np.float64) / 255
    linear = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
    linear = np.clip(linear * np.asarray(gains), 0, 1)
    srgb = np.where(linear <= .0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - .055)
    return Image.fromarray(np.rint(srgb * 255).clip(0, 255).astype('uint8'))


def build(source: Path, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image = image.convert('RGB')
        if image.size != (1280, 960):
            raise ValueError('This recorded H&E crop requires the verified 1280 × 960 engineering source')
        gains = [.97, .99, 1.01]
        roi = [0, 0, 1232, 960]
        shutil.copy2(source, out / 'he-full-source.png')
        bias(image, gains).save(out / 'he-full-reference.png')
        crop = image.crop(tuple(roi))
        crop.save(out / 'he-natural-field-crop.png')
        bias(crop, gains).save(out / 'he-crop-reference.png')
    source_record = next(item for item in json.loads((ROOT / 'scripts/fixtures/real-image-sources.json').read_text(encoding='utf8'))['sources'] if item['id'] == 'he')
    cases = [dict(id='full-real-source-background-gate', target='he-full-source.png', reference='he-full-reference.png', expected='observe-and-preserve-gate'),
             dict(id='real-natural-field-positive-engineering-case', target='he-natural-field-crop.png', reference='he-crop-reference.png', expected='eligible-background')]
    record = dict(schema='real-reference-colour-acceptance/1', source=source_record,
                  inputPngSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                  cropOriginalPixels=roi, referenceLinearRgbGains=gains,
                  referenceMethod='sRGB decode → documented global linear RGB gains → clamp → sRGB encode → nearest 8-bit value',
                  selection='Full source retained. Natural crop selected for stable border after the full image failed the existing strict eligibility rule; no threshold changed.',
                  limitation='Real-source controlled display-colour engineering acceptance; not stain normalization, scanner calibration or accuracy on independently sampled images.', cases=cases)
    record['files'] = {name: hashlib.sha256((out / name).read_bytes()).hexdigest() for case in cases for name in [case['target'], case['reference']]}
    (out / 'manifest.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(out / 'manifest.json')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / '.cache/round2-validation/engineering/he.png')
    parser.add_argument('--out', type=Path, default=ROOT / '.cache/round2-reference-matching/fixtures')
    args = parser.parse_args()
    build(args.source, args.out)

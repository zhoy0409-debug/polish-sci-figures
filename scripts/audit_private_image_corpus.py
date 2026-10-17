"""Read only an explicitly supplied directory; stage anonymous LOCAL QA copies.

The output is private, not a redistributable dataset or independent ground truth.
It records file-level identities and unknown labels; filenames never establish
modality, duplicate identity, experimental units or ROI truth. Do not commit any
output. No network calls. Copies are byte-for-byte and source files stay intact.
"""
from __future__ import annotations
import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
from PIL import Image, ImageDraw, ImageOps


def file_sha256(path):
    digest=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):
            digest.update(block)
    return digest.hexdigest()


def audit(source, out):
    source, out = Path(source).resolve(strict=True), Path(out).resolve()
    if not source.is_dir() or source == out or source in out.parents:
        raise ValueError('Output must be separate from the read-only source')
    out.mkdir(parents=True, exist_ok=True)
    raster_extensions = {'.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp'}
    records, mapping, thumbs = [], {}, []
    files = []
    for directory, folders, names in os.walk(source, followlinks=False):
        current = Path(directory)
        # Windows junctions can otherwise point beyond the authorized root.
        folders[:] = [name for name in folders if not (current/name).is_symlink() and
                      not getattr(current/name, 'is_junction', lambda: False)() and
                      source in (current/name).resolve().parents]
        for name in names:
            candidate = current/name
            if candidate.is_file() and source in candidate.resolve().parents:
                files.append(candidate)
    files.sort()
    for p in files:
        if p.suffix.lower() not in raster_extensions:
            continue
        identity = f'private-{len(records)+1:04d}'
        try:
            with Image.open(p) as image:
                w, h = image.size
                record = {'id': identity, 'sha256': file_sha256(p),
                          'bytes': p.stat().st_size, 'dimensions': [w, h], 'mode': image.mode,
                          'frames': getattr(image, 'n_frames', 1), 'modality': 'unverified',
                          'independentLabel': None}
                bits=getattr(image,'tag_v2',{}).get(258,(8,))
                if isinstance(bits,int):
                    bits=(bits,)
                high_depth=image.mode.startswith('I') or image.mode=='F' or max(bits)>8
                if w*h<=20_000_000 and high_depth and getattr(image,'n_frames',1)==1:
                    sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'skills/polish-sci-figures/scripts'))
                    import studio_duplicates as engine
                    # The audit is allowed to read a source beyond the screening
                    # file-size cap. Reuse the native-depth DISPLAY mapping,
                    # never Pillow's 16-bit -> RGB clipping. This is a contact
                    # sheet only, not evidence that the full file is eligible.
                    thumbnail,_,mapping_info,_,_=engine._high_depth_preview(p.read_bytes(),image,engine._engine())
                    record['thumbnailMapping']=mapping_info['previewMapping']
                    thumbnail.thumbnail((180,135))
                elif w*h<=20_000_000 and getattr(image,'n_frames',1)==1:
                    thumbnail = ImageOps.exif_transpose(image).convert('RGB')
                    thumbnail.thumbnail((180, 135))
                else:
                    thumbnail = Image.new('RGB',(180,135),'#cccccc')
                    record['contactPreviewUnavailable']='beyond_20_megapixel_bound_or_multiframe'
                cell = Image.new('RGB', (190, 160), 'white')
                cell.paste(thumbnail, ((190-thumbnail.width)//2, 20))
                ImageDraw.Draw(cell).text((4, 3), identity, fill='black')
                thumbs.append(cell)
                # A small, deterministic first set for real browser work. Exact
                # source bytes are preserved, including depth and metadata.
                if len(records) < 16 and p.stat().st_size <= 12_000_000 and w*h <= 20_000_000:
                    name = identity+p.suffix.lower()
                    shutil.copyfile(p, out/name)
                    record['localCopy'] = name
                records.append(record)
                mapping[identity] = str(p)
        except (OSError, ValueError):
            records.append({'id': identity, 'readable': False, 'modality': 'unverified', 'independentLabel': None})
            mapping[identity] = str(p)
    for start in range(0, len(thumbs), 36):
        batch = thumbs[start:start+36]
        sheet = Image.new('RGB', (6*190, ((len(batch)+5)//6)*160), '#dddddd')
        for i, cell in enumerate(batch):
            sheet.paste(cell, ((i%6)*190, (i//6)*160))
        sheet.save(out/f'contact-{start//36+1:02d}.jpg')
    extensions = dict(Counter(p.suffix.lower() for p in files))
    result = {'schema': 'private-image-audit/1', 'status': 'unlabelled', 'files': len(files),
              'extensions': extensions, 'images': records,
              'independentBlindValidation': 'not_established',
              'privacy': 'local_only_no_distribution',
              'note': 'No duplicate or ROI truth was inferred from filename, appearance or algorithm output.'}
    (out/'inventory.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    (out/'private-path-map.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'files': len(files), 'images': len(records), 'extensions': extensions,
                      'independentBlindValidation': 'not_established'}))


def verify(source, out):
    """Re-read only the authorized source root; print no file names or paths."""
    source, out = Path(source).resolve(strict=True), Path(out).resolve(strict=True)
    inventory = json.loads((out/'inventory.json').read_text(encoding='utf-8'))
    mapping = json.loads((out/'private-path-map.json').read_text(encoding='utf-8'))
    changed, checked = [], 0
    for record in inventory['images']:
        if 'sha256' not in record:
            continue
        path = Path(mapping[record['id']]).resolve(strict=True)
        if source not in path.parents:
            raise ValueError('Refusing a source path outside the explicitly supplied root')
        checked += 1
        if file_sha256(path) != record['sha256']:
            changed.append(record['id'])
    result = {'schema':'private-source-integrity/1', 'status':'PASS' if not changed else 'FAIL',
              'checked':checked, 'changedAnonymousIds':changed}
    (out/'source-integrity.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result))
    return not changed


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--verify', action='store_true', help='Verify the original source bytes against the previous local inventory')
    args = parser.parse_args()
    if args.verify:
        raise SystemExit(0 if verify(args.source, args.out) else 1)
    audit(args.source, args.out)

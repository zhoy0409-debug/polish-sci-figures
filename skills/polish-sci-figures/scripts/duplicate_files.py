"""Local file intake and portable evidence reports for image screening."""
from __future__ import annotations

import base64
import csv
import html
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET


class _NoDoctype(ET.TreeBuilder):
    def doctype(self, name, pubid, system):
        raise ValueError('SVG document types and XML entities are not accepted')


def collect_files(paths):
    """Read raster files and embedded raster layers in SVG; never follow URLs."""
    from PIL import Image, ImageOps
    images, warnings = [], []
    from collections import Counter
    name_counts = Counter(Path(p).name for p in paths)

    def add(label, data):
        if len(images) >= 60:
            raise ValueError('Choose at most 60 raster images, including TIFF frames and SVG layers')
        images.append({'id': f'image-{len(images)+1}', 'label': label, 'data': data})
        if sum(len(x['data']) for x in images) > 40_000_000:
            raise ValueError('Image check limit: 40 MB encoded; use a smaller batch')

    def frame_data(im):
        if im.width * im.height > 20_000_000:
            raise ValueError('Image check limit: 20 million pixels per image')
        stream = io.BytesIO()
        # TIFF preserves native high-bit microscopy intensities across frames.
        ImageOps.exif_transpose(im).save(stream, format='TIFF')
        if stream.tell() > 12_000_000:
            raise ValueError('Image check limit: 12 MB per decoded image')
        return 'data:image/tiff;base64,' + base64.b64encode(stream.getvalue()).decode('ascii')

    for value in paths:
        path = Path(value)
        label_name = path.name if name_counts[path.name] == 1 else str(path)
        if len(label_name) > 270:
            label_name = '…' + label_name[-269:]
        if not path.is_file():
            raise ValueError(f'Input file does not exist: {path}')
        if path.stat().st_size > 30_000_000:
            raise ValueError(f'{path.name}: file limit 30 MB')
        if path.suffix.lower() == '.svg':
            raw = path.read_bytes()
            if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
                raise ValueError(f'{path.name}: XML entities are not accepted')
            try:
                root = ET.fromstring(raw, parser=ET.XMLParser(target=_NoDoctype()))
            except ET.ParseError as exc:
                raise ValueError(f'{path.name}: invalid SVG: {exc}') from None
            found = 0
            # Definitions are not separate panels. Expand local uses once per
            # visible occurrence, with a cycle/depth guard.
            ids = {node.get('id'): node for node in root.iter() if node.get('id')}
            stack = [(root, (), 0)]
            visited = 0
            if any(n.tag.rsplit('}', 1)[-1] == 'style' for n in root.iter()):
                warnings.append(f'{path.name}: stylesheet visibility is not evaluated by the CLI; use the editor to check the rendered selection')
            while stack:
                node, refs, depth = stack.pop()
                visited += 1
                if visited > 100000 or depth > 128:
                    raise ValueError(f'{path.name}: SVG is too complex; choose a simpler panel or use separate raster files')
                tag = node.tag.rsplit('}', 1)[-1]
                if tag in {'defs', 'clipPath', 'mask', 'pattern', 'metadata'}:
                    continue
                style = node.get('style', '').replace(' ', '').lower()
                properties = dict(item.split(':', 1) for item in style.split(';') if ':' in item)
                hidden = properties.get('display', node.get('display')) == 'none' or properties.get('visibility', node.get('visibility')) in {'hidden', 'collapse'}
                opacity = properties.get('opacity', node.get('opacity', '1'))
                try:
                    hidden = hidden or float(opacity) <= 0
                except ValueError:
                    pass
                if hidden:
                    warnings.append(f'{path.name}: hidden layer skipped')
                    continue
                if tag == 'use':
                    href = node.get('href') or node.get('{http://www.w3.org/1999/xlink}href', '')
                    key = href[1:] if href.startswith('#') else None
                    if key in ids and key not in refs and len(refs) < 16:
                        stack.append((ids[key], (*refs, key), depth + 1))
                    continue
                if tag == 'image':
                    data = node.get('href') or node.get('{http://www.w3.org/1999/xlink}href', '')
                    found += 1
                    label = f'{label_name} · image {found}'
                    if data.startswith('data:image/') and ';base64,' in data and not data.startswith('data:image/svg'):
                        add(label, data)
                    else:
                        warnings.append(f'{label}: external or non-raster image skipped; embed a PNG/JPEG/TIFF image first')
                    continue
                stack.extend((child, refs, depth + 1) for child in reversed(node))
            if not found:
                warnings.append(f'{path.name}: no embedded raster layers; vector text and paths were not compared')
        elif path.suffix.lower() in {'.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.bmp'}:
            with Image.open(path) as im:
                if im.width * im.height > 20_000_000:
                    raise ValueError(f'{path.name}: image limit 20 million pixels')
                frames = getattr(im, 'n_frames', 1)
                if frames == 1 and path.stat().st_size > 12_000_000:
                    raise ValueError(f'{path.name}: single-image limit 12 MB; use lossless compression or check a smaller source')
                bits = getattr(im, 'tag_v2', {}).get(258, (8,))
                if isinstance(bits, int): bits = (bits,)
                if frames > 1 and max(bits) > 8 and (getattr(im, 'tag_v2', {}).get(277, 1) > 1 or not (im.mode.startswith('I') or im.mode == 'F')):
                    raise ValueError(f'{path.name}: preserve native multichannel high-bit TIFF frames by exporting each frame as a 16-bit TIFF/PNG before checking')
                if frames + len(images) > 60:
                    raise ValueError(f'{path.name}: batch exceeds 60 raster images including frames')
                if frames == 1 and path.stat().st_size <= 12_000_000:
                    mime = Image.MIME.get(im.format, 'image/png')
                    add(label_name, 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode('ascii'))
                else:
                    for frame in range(frames):
                        im.seek(frame)
                        bits = getattr(im, 'tag_v2', {}).get(258, (8,))
                        if isinstance(bits, int): bits = (bits,)
                        if max(bits) > 8 and (getattr(im, 'tag_v2', {}).get(277, 1) > 1 or not (im.mode.startswith('I') or im.mode == 'F')):
                            raise ValueError(f'{path.name}: export multichannel high-bit TIFF frames individually at native depth before checking')
                        add(f'{label_name} · frame {frame+1}', frame_data(im))
        else:
            raise ValueError(f'{path.name}: use PNG, JPEG, TIFF, WebP, BMP or SVG with embedded images. For PDF, import it into Figure Studio first.')
    if len(images) < 2:
        raise ValueError('At least two raster images are required. ' + ' '.join(warnings))
    return images, warnings


def write_report(result, out):
    """Create a new report directory; preserve every input and existing report."""
    out = Path(out)
    out.mkdir(parents=True, exist_ok=False)
    (out / 'report.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    images = {item['id']: item for item in result['images']}
    with (out / 'matches.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.writer(stream)
        writer.writerow(['image_a', 'image_b', 'match_kind', 'verified_feature_points', 'coverage_a', 'coverage_b'])
        for match in result['matches']:
            # Spreadsheet formula characters in imported filenames stay literal.
            safe = lambda s: "'" + s if str(s).startswith(('=', '+', '-', '@', '\t', '\r')) else s
            writer.writerow([safe(images[match['a']]['label']), safe(images[match['b']]['label']), match['kind'],
                             match.get('inliers', 0), match.get('coverageA', 0), match.get('coverageB', 0)])
    cards = []
    for index, match in enumerate(result['matches'], 1):
        a, b = images[match['a']], images[match['b']]
        evidence = match.get('evidence')
        if evidence:
            raw = base64.b64decode(evidence.split(',', 1)[1], validate=True)
            (out / f'evidence-{index:03}.png').write_bytes(raw)
            visual = f'<img src="{evidence}" alt="Matching evidence / 匹配证据">'
        else:
            visual = ''.join(f'<img class="thumb" src="{x["thumbnail"]}" alt="{html.escape(x["label"], quote=True)}">' for x in (a, b))
        labels = {'exact': 'Identical pixels / 像素一致', 'transformed': 'Suspected transformed copy / 疑似变换重复', 'overlap': 'Suspected overlap / 疑似局部重叠'}
        cards.append(f'<article><h2>{html.escape(a["label"])} ↔ {html.escape(b["label"])}</h2><p>{labels.get(match["kind"], html.escape(match["kind"]))}</p>{visual}</article>')
    omitted = result.get('evidenceOmitted', 0)
    evidence_note = (f'Evidence preview limit reached; {omitted} matching pairs remain in the report without evidence images. '
                     'Check these pairs in a smaller batch to generate evidence. / '
                     f'证据预览达到上限，报告仍保留 {omitted} 组匹配记录，但未生成证据图；请缩小批次重新检查这些图片对以生成证据。')
    warning_text = ''.join('<li>' + html.escape(evidence_note if w == 'evidence_limit' else str(w)) + '</li>'
                           for w in result.get('warnings', []))
    note_labels = {
        'low_information': 'Low detail; only exact matching is reliable / 细节不足，仅可靠检查像素一致',
        'few_distinctive_features': 'Few distinctive features / 可区分特征较少，变换重复可能无法检出',
        'repetitive_texture': 'Repetitive texture; ambiguous matches suppressed / 重复纹理较多，已抑制模糊匹配',
        'high_bit_depth_preview': 'High-depth intensities mapped for preview; original pixels retained / 高位深强度仅为预览映射，原始像素保留',
    }
    inventory = ''
    for item in result['images']:
        notes = '; '.join(note_labels.get(w, str(w)) for w in item.get('warnings', []))
        mapping = item.get('intensityMapping')
        if mapping:
            notes += f' · {mapping["sourceDtype"]}: {mapping["minimum"]:g}–{mapping["maximum"]:g}'
        inventory += '<li>' + html.escape(item['label']) + f' · {item["width"]} × {item["height"]} px'
        inventory += ('<br><small>' + html.escape(notes) + '</small>' if notes else '') + '</li>'
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Image check · 图片查重</title>
<style>body{font:16px/1.6 system-ui,sans-serif;color:#23334a;background:#f3f5f8;margin:0 auto;padding:32px;max-width:1040px}h1{font-size:28px}h2{font-size:18px;overflow-wrap:anywhere}article{background:white;border:1px solid #dbe2ec;border-radius:14px;padding:22px;margin:24px 0}img{max-width:100%;height:auto}.thumb{max-width:46%;margin:1%}small{color:#586b82}</style>
<h1>Image duplicate check / 图片查重</h1><p>Suspected matches for source review. No match is not proof of uniqueness.<br>结果用于回查原图；未检出不代表一定没有重复。</p>'''
    page += f'<p>{len(images)} images / 张图片 · {len(cards)} pairs to review / 组待核对</p>'
    page += ''.join(cards) if cards else '<article>No suspected pair found in this batch.<br>本批图片未检出疑似重复。</article>'
    page += '<h2>Checked images / 已检查图片</h2><ul>' + inventory + '</ul>'
    if warning_text:
        page += '<h2>Notes / 提示</h2><ul>' + warning_text + '</ul>'
    page += '<p><small>Figure Studio · polish-sci-figures · Local screening / 本机筛查</small></p></html>'
    (out / 'report.html').write_text(page, encoding='utf-8')
    return out / 'report.html'


def run_cli(args):
    from studio_duplicates import scan_images
    out = Path(args.out)
    if out.exists():
        raise ValueError(f'Report folder already exists; choose a new path: {out}')
    images, warnings = collect_files(args.paths)
    result = scan_images(images)
    result['warnings'] = [*warnings, *result.get('warnings', [])]
    report = write_report(result, out)
    summary = {'report': str(report.resolve()), 'images': len(images), 'matches': len(result['matches']), 'warnings': result['warnings']}
    print(json.dumps(summary, ensure_ascii=False, indent=2) if args.json else
          f'Checked {len(images)} images; {len(result["matches"])} pairs to review. Report: {report.resolve()}')
    return 0

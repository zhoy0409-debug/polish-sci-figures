"""Explicit synthetic 10,000-mark PDF for actual installed import acceptance.

Reuses test_studio_pdf.chart_pdf(), which already exercises the real PDFium
converter. Appends simple native path/text operators with the same pypdf object
construction used in that test. This is object-complexity engineering QA, not
real observations, a claim about large file byte size, or detector accuracy.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LABEL = 'SYNTHETIC PDF 10000 MARKS'


def build(out):
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import DictionaryObject, NameObject, ArrayObject, DecodedStreamObject
    from test_studio_pdf import chart_pdf

    out = Path(out).resolve()
    if out.exists():
        raise ValueError('Never overwrite earlier fixture evidence')
    # Generate only after the explicit operator invocation; imports above do
    # not run the unit tests and this script has no browser/service operations.
    base = chart_pdf()
    writer = PdfWriter()
    writer.append(PdfReader(io.BytesIO(base)))
    page = writer.pages[0]
    resources = page['/Resources'].get_object()
    fonts = resources.get('/Font')
    if fonts is None:
        fonts = DictionaryObject()
        resources[NameObject('/Font')] = fonts
    fonts = fonts.get_object()
    require_name = NameObject('/QASyntheticFont')
    if require_name in fonts:
        raise ValueError('The controlled QA font name already exists')
    fonts[require_name] = writer._add_object(DictionaryObject({
        NameObject('/Type'): NameObject('/Font'),
        NameObject('/Subtype'): NameObject('/Type1'),
        NameObject('/BaseFont'): NameObject('/Helvetica'),
    }))
    commands = ['q 0.2 0.5 0.7 rg']
    for i in range(10000):
        x, y = 16 + (i % 100) * 2.5, 24 + (i // 100) * 1.45
        commands.append(f'{x:.2f} {y:.2f} 1.50 0.90 re f')
    commands += ['Q', f'BT /QASyntheticFont 9 Tf 0 0 0 rg 10 7 Td ({LABEL}) Tj ET']
    stream = DecodedStreamObject()
    stream.set_data(('\n'.join(commands) + '\n').encode('ascii'))
    old = page.get('/Contents')
    content = old.get_object() if old is not None else None
    contents = list(content) if isinstance(content, ArrayObject) else ([old] if old is not None else [])
    page[NameObject('/Contents')] = ArrayObject([*contents, writer._add_object(stream)])
    output = io.BytesIO()
    writer.write(output)
    pdf = output.getvalue()
    if not 0 < len(pdf) < 20000000:
        raise ValueError('Synthetic PDF must remain within the normal import limit')
    out.mkdir(parents=True)
    base_name, name = 'SYNTHETIC-base-chart.pdf', 'SYNTHETIC-large-pdf-10000-marks.pdf'
    (out / base_name).write_bytes(base)
    (out / name).write_bytes(pdf)
    sha = lambda data: hashlib.sha256(data).hexdigest()
    manifest = {
        'schema': 'studio-synthetic-large-pdf-fixture/1', 'synthetic': True,
        'file': name, 'sha256': sha(pdf), 'sizeBytes': len(pdf),
        'baseFile': base_name, 'baseSha256': sha(base), 'baseSizeBytes': len(base),
        'pageCount': 1, 'addedNativePathMarks': 10000, 'uniqueNativeText': LABEL,
        'generator': 'scripts/prepare_studio_large_pdf_qa.py',
        'generatorSha256': sha(Path(__file__).read_bytes()),
        'reusedFactory': 'scripts/test_studio_pdf.py:chart_pdf',
        'reusedFactorySourceSha256': sha((ROOT / 'scripts/test_studio_pdf.py').read_bytes()),
        'scope': 'Existing explicitly synthetic Matplotlib chart plus 10,000 native rectangular PDF marks and one labelled native text object. Object complexity only; not a large-file-byte-size benchmark, real research dataset, or independent scientific validation.',
    }
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')
    print(json.dumps(manifest))
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    build(parser.parse_args().out)

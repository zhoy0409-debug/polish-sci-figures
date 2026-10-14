#!/usr/bin/env python3
"""Build an isolated local-only browser prototype from pinned, already cached WASM assets.

No downloads, package installation, public deployment or source rewriting occur.
Serve the generated directory with a local static HTTP server for browser tests.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / '.cache/local-web-preview'
RUNTIME_CACHE = ROOT / '.cache/mobile-local-spike/node_modules/pyodide'
PACKAGES = ['numpy', 'scipy', 'pandas', 'matplotlib', 'pillow', 'opencv-python']
RUNTIME_FILES = ['pyodide.js', 'pyodide.mjs', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json', 'package.json']
WEB_FILES = ['local-engine.js', 'engine-worker.js', 'engine-bootstrap.py', 'offline.js', 'browser-status.js', 'browser-status.css', 'app.webmanifest', 'icon.svg']


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n', encoding='utf-8', newline='\n')


def package_closure(lock):
    needed = set()
    def add(name):
        if name in needed:
            return
        needed.add(name)
        for dependency in lock['packages'][name]['depends']:
            add(dependency)
    for name in PACKAGES:
        add(name)
    return sorted(needed)


def checked_output(output):
    resolved = output.resolve()
    cache = (ROOT / '.cache').resolve()
    if ROOT.resolve() not in cache.parents or cache not in resolved.parents or resolved == cache or resolved.name.startswith('.'):
        raise ValueError('Preview output must be a named generated directory below this repository .cache')
    return resolved


def build(output=DEFAULT_OUTPUT, runtime_cache=RUNTIME_CACHE):
    output = checked_output(Path(output))
    runtime_cache = Path(runtime_cache).resolve()
    package = json.loads((runtime_cache / 'package.json').read_text(encoding='utf-8'))
    if package.get('name') != 'pyodide' or package.get('version') != '0.29.3':
        raise ValueError('The tested official Pyodide 0.29.3 cache is required')
    lock = json.loads((runtime_cache / 'pyodide-lock.json').read_text(encoding='utf-8'))
    selected = package_closure(lock)
    # Validate the existing official lockfile hashes before touching generated output.
    for name in selected:
        entry = lock['packages'][name]
        source = runtime_cache / entry['file_name']
        if source.parent != runtime_cache or sha256(source.read_bytes()) != entry['sha256']:
            raise ValueError(f'Cached package checksum mismatch: {name}')
    marker = output / '.local-web-preview'
    if output.exists():
        if not marker.is_file():
            raise ValueError('Refusing to replace a directory without the local web preview marker')
        shutil.rmtree(output)
    output.mkdir(parents=True)
    marker.write_text('Generated local Figure Studio browser prototype\n', encoding='utf-8')
    runtime = output / 'runtime'
    runtime.mkdir()
    origins = {}
    for name in RUNTIME_FILES:
        shutil.copyfile(runtime_cache / name, runtime / name)
        origins['runtime/' + name] = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/' + name
    for name in selected:
        entry = lock['packages'][name]
        shutil.copyfile(runtime_cache / entry['file_name'], runtime / entry['file_name'])
        origins['runtime/' + entry['file_name']] = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/' + entry['file_name']
    for name in WEB_FILES:
        shutil.copyfile(ROOT / 'web' / name, output / name)
    python_sources = []
    for skill in ['polish-sci-figures', 'make-sci-data-figures', 'standardize-sci-images']:
        for source in sorted((ROOT / 'skills' / skill / 'scripts').glob('*.py')):
            relative = source.relative_to(ROOT).as_posix()
            dest = output / 'python' / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, dest)
            python_sources.append({'path': 'python/' + relative, 'destination': '/suite/' + relative})
    relative = 'skills/make-sci-data-figures/assets/palettes.json'
    dest = output / 'python' / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / relative, dest)
    python_sources.append({'path': 'python/' + relative, 'destination': '/suite/' + relative})
    licenses = output / 'licenses'
    shutil.copytree(ROOT / 'web/licenses', licenses)
    shutil.copyfile(ROOT / 'LICENSE', licenses / 'Figure-Studio-LICENSE')
    for name in selected:
        entry = lock['packages'][name]
        with zipfile.ZipFile(runtime_cache / entry['file_name']) as archive:
            for info in archive.infolist():
                path = PurePosixPath(info.filename)
                if info.is_dir() or path.is_absolute() or '..' in path.parts:
                    continue
                if not any(word in path.name.lower() for word in ('license', 'licence', 'copying', 'notice', 'copyright')):
                    continue
                target = licenses / name / Path(*path.parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(info))
    write_json(output / 'THIRD-PARTY-NOTICES.json', {
        'runtime': {'name': 'Pyodide', 'version': '0.29.3', 'license': 'MPL-2.0', 'source': 'https://github.com/pyodide/pyodide/tree/0.29.3'},
        'python': {'version': '3.13.2', 'source': 'https://github.com/python/cpython/tree/v3.13.2'},
        'packages': {name: {'version': lock['packages'][name]['version'], 'file': lock['packages'][name]['file_name'], 'sha256': lock['packages'][name]['sha256']} for name in selected},
        'notice': 'Original license texts are under licenses/ and retained inside their wheels. Public asset copies only; no research data included.',
    })
    sys.path.insert(0, str(ROOT / 'desktop'))
    from build_starter import build as build_starter
    page = build_starter(output / 'starter.html')
    html = page.read_text(encoding='utf-8')
    html = html.replace("script-src 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self'; manifest-src 'self'")
    html = html.replace("connect-src 'none'", "connect-src 'self'").replace("connect-src https://www.ebi.ac.uk", "connect-src 'self' https://www.ebi.ac.uk")
    html = html.replace("img-src data: blob:", "img-src 'self' data: blob:")
    config = {'mode': 'browser', 'prototype': True, 'endpoint': '/api/render', 'reflowEndpoint': '/api/reflow', 'analyzeEndpoint': '/api/analyze', 'splitFacetsEndpoint': '/api/split-facets', 'pdfEndpoint': '/api/import-pdf', 'duplicateEndpoint': '/api/image-duplicates', 'imageLinksEndpoint': '/api/image-links'}
    html = html.replace("style-src 'unsafe-inline'", "style-src 'self' 'unsafe-inline'")
    injected = '<meta name="theme-color" content="#345a87"><link rel="manifest" href="./app.webmanifest"><link rel="stylesheet" href="./browser-status.css">' + '<script id="local-engine" type="application/json">' + json.dumps(config) + '</script><script src="./local-engine.js"></script><script src="./offline.js"></script><script src="./browser-status.js"></script>'
    html = html.replace('</head>', injected + '</head>', 1)
    page.write_text(html, encoding='utf-8', newline='\n')
    shutil.copyfile(page, output / 'index.html')
    def inventory(excluded=()):
        entries = []
        for path in sorted(output.rglob('*')):
            if not path.is_file():
                continue
            relative = path.relative_to(output).as_posix()
            if relative.startswith('.') or relative in excluded:
                continue
            raw = path.read_bytes()
            item = {'path': relative, 'bytes': len(raw), 'sha256': sha256(raw)}
            if relative in origins:
                item['origin'] = origins[relative]
            entries.append(item)
        return entries
    engine = {'schema': 'figure-studio-browser-engine/1', 'prototype': True, 'runtime': {'version': '0.29.3', 'packages': PACKAGES}, 'pythonSources': python_sources, 'files': inventory(('starter.html', 'index.html')), 'limits': {'workers': 1, 'waitingOperations': 2, 'duplicateImages': 60, 'encodedImageBytes': 40000000, 'completedReportsRetained': 2, 'reportRetentionSeconds': 900}, 'unavailable': ['editable_pdf_import'], 'researchDataTransport': 'worker-postMessage-only'}
    write_json(output / 'engine-manifest.json', engine)
    offline_files = inventory()
    sw_source = (ROOT / 'web/service-worker.js').read_text(encoding='utf-8')
    version = sha256((json.dumps(offline_files, sort_keys=True) + sw_source).encode())[:20]
    (output / 'service-worker.js').write_text(sw_source.replace('__STUDIO_CACHE_VERSION__', version), encoding='utf-8', newline='\n')
    write_json(output / 'offline-manifest.json', {'schema': 'figure-studio-offline/1', 'version': version, 'files': offline_files})
    complete = inventory()
    (output / 'SHA256SUMS.txt').write_text(''.join(item['sha256'] + '  ' + item['path'] + '\n' for item in complete), encoding='utf-8', newline='\n')
    return {'output': str(output), 'version': version, 'files': len(complete), 'bytes': sum(item['bytes'] for item in complete), 'packages': len(selected), 'pythonSources': len(python_sources)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--runtime-cache', type=Path, default=RUNTIME_CACHE)
    args = parser.parse_args()
    print(json.dumps(build(args.out, args.runtime_cache), ensure_ascii=False, indent=2))

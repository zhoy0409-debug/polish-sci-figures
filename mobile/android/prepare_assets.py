#!/usr/bin/env python3
"""Rebuild and stage only verified public browser assets into the Android APK."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import runpy
import shutil

ROOT = Path(__file__).resolve().parents[2]
ANDROID = Path(__file__).resolve().parent
SOURCE = ROOT / '.cache/local-web-preview'
ASSETS = ANDROID / 'app/src/main/assets'
OUTPUT = ASSETS / 'www'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verified_files(source):
    source = Path(source).resolve()
    result = []
    seen = set()
    for line in (source / 'SHA256SUMS.txt').read_text(encoding='utf-8').splitlines():
        checksum, relative = line.split('  ', 1)
        path = PurePosixPath(relative)
        if len(checksum) != 64 or any(ch not in '0123456789abcdef' for ch in checksum) or path.is_absolute() or '..' in path.parts or '\\' in relative or relative.startswith('.') or relative in seen:
            raise ValueError('Invalid public asset manifest entry')
        item = (source / relative).resolve()
        if source not in item.parents or not item.is_file() or digest(item) != checksum:
            raise ValueError('Public asset checksum mismatch: ' + relative)
        seen.add(relative)
        result.append((relative, item))
    if not {'starter.html', 'index.html', 'engine-manifest.json', 'local-engine.js', 'offline.js'}.issubset(seen):
        raise ValueError('Incomplete browser bundle')
    return result


def stage(source=SOURCE, output=OUTPUT, allowed_root=ASSETS):
    files = verified_files(source)
    output = Path(output).resolve()
    allowed_root = Path(allowed_root).resolve()
    if output.parent != allowed_root or output.name != 'www' or ROOT.resolve() not in allowed_root.parents:
        raise ValueError('Android assets must be a generated www directory inside this repository')
    marker = output / '.android-local-bundle'
    if output.exists():
        if not marker.is_file():
            raise ValueError('Refusing to replace an unmarked directory')
        shutil.rmtree(output)
    output.mkdir(parents=True)
    marker.write_text('Generated public Android development assets; no research projects\n', encoding='utf-8')
    for relative, source_file in files:
        target = output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_file, target)
    shutil.copyfile(ANDROID / 'bridge/native-bridge.js', output / 'native-bridge.js')
    license_dir = output / 'native-licenses'
    shutil.copytree(ANDROID / 'licenses', license_dir)
    for name in ('starter.html', 'index.html'):
        page = output / name
        html = page.read_text(encoding='utf-8')
        anchor = '<script id="local-engine"'
        if html.count(anchor) != 1:
            raise ValueError('Expected one browser engine configuration')
        html = html.replace(anchor, '<script src="./native-bridge.js"></script>' + anchor, 1)
        page.write_text(html, encoding='utf-8', newline='\n')
    # SW installation is disabled by bundledAssets. Its old public manifest is not used.
    entries = []
    for item in sorted(output.rglob('*')):
        if item.is_file() and not item.name.startswith('.'):
            entries.append({'path':item.relative_to(output).as_posix(), 'bytes':item.stat().st_size, 'sha256':digest(item)})
    manifest = {'schema':'figure-studio-android-bundle/1', 'developmentPreview':True,
                'origin':'https://appassets.androidplatform.net/assets/www/',
                'files':entries, 'researchDataTransport':'on-device-worker-only', 'internetPermission':False}
    (output / 'native-bundle-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    return {'output':str(output), 'files':len(entries), 'bytes':sum(item['bytes'] for item in entries)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-rebuild', action='store_true', help='Use an already freshly built, checksum-verified public preview')
    args = parser.parse_args()
    if not args.no_rebuild:
        runpy.run_path(str(ROOT / 'scripts/build_local_web_preview.py'))['build']()
    print(json.dumps(stage(), indent=2))

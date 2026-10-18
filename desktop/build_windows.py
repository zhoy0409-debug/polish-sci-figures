"""Build a self-contained Windows app, portable ZIP and per-user installer.

Build tooling only. Never invoked on the end user's computer.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata as metadata
import json
import os
from pathlib import Path
import py_compile
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / '.cache' / 'desktop-build'
STAGE = WORK / 'suite'
DIST = ROOT / 'dist' / 'desktop'
APP = DIST / 'Figure Studio'
VERSION = '0.1.24'
SUITE_VERSION = 'v1.4.24'
PACKAGES = ('numpy', 'scipy', 'pandas', 'matplotlib', 'openpyxl', 'Pillow', 'pypdfium2', 'pypdf', 'opencv-python-headless',
            'contourpy', 'cycler', 'fonttools', 'kiwisolver', 'packaging',
            'python-dateutil', 'pytz', 'tzdata', 'six', 'et_xmlfile', 'pyparsing', 'PyYAML',
            'pyinstaller', 'pyinstaller-hooks-contrib')


def run(args, logfile=None):
    print('Running:', ' '.join(map(str, args)), flush=True)
    if logfile is None:
        subprocess.run(list(map(str, args)), cwd=ROOT, check=True)
    else:
        with logfile.open('w', encoding='utf-8') as log:
            result = subprocess.run(list(map(str, args)), cwd=ROOT,
                                    stdout=log, stderr=subprocess.STDOUT)
        if result.returncode:
            print(logfile.read_text(encoding='utf-8', errors='replace')[-8000:])
            result.check_returncode()
        print(f'Completed; build log: {logfile}', flush=True)


def clean_build_dir(path):
    # Only generated artifacts beneath the known build workspace may be reset.
    resolved = path.resolve()
    if WORK.resolve() not in resolved.parents:
        raise ValueError(f'Not a generated build directory: {resolved}')
    if resolved.exists():
        shutil.rmtree(resolved)
    resolved.mkdir(parents=True)


def copy_suite():
    clean_build_dir(STAGE)
    sys.path.insert(0, str(ROOT / 'scripts'))
    from build_release import SKILL_NAMES, ROOT_FILES, SUPPORT_FILES, archive_bytes, include_file
    included = {*ROOT_FILES, *SUPPORT_FILES}
    included.update(source.relative_to(ROOT).as_posix()
                    for skill in SKILL_NAMES
                    for source in (ROOT / 'skills' / skill).rglob('*')
                    if source.is_file() and include_file(source))
    for name in (*ROOT_FILES, *SUPPORT_FILES):
        target = STAGE / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(archive_bytes(ROOT / name, included, SUITE_VERSION))
    for name in SKILL_NAMES:
        for source in (ROOT / 'skills' / name).rglob('*'):
            if source.is_file() and include_file(source):
                dest = STAGE / source.relative_to(ROOT)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, dest)
    resources = STAGE / 'desktop' / 'resources'
    resources.mkdir(parents=True, exist_ok=True)
    for name in ('starter.html', 'figure-studio.ico'):
        shutil.copy2(ROOT / 'desktop' / 'resources' / name, resources / name)
    for name in ('QUICKSTART.zh-CN.md', 'QUICKSTART.en.md'):
        source = ROOT / 'desktop' / name
        if source.exists():
            shutil.copy2(source, STAGE / name)
    # Ship runtime bytecode in the same directories, preserving __file__-based
    # resource lookups. This is packaging, not DRM or a change of license.
    for source in STAGE.rglob('*.py'):
        py_compile.compile(str(source), cfile=str(source.with_suffix('.pyc')),
                           dfile='suite/' + source.relative_to(STAGE).as_posix(),
                           doraise=True, optimize=0,
                           invalidation_mode=py_compile.PycInvalidationMode.UNCHECKED_HASH)
        source.unlink()


def notices():
    target = STAGE / 'THIRD-PARTY-LICENSES'
    target.mkdir()
    versions = {}
    for name in PACKAGES:
        dist = metadata.distribution(name)
        versions[name] = dist.version
        dest = target / name
        dest.mkdir()
        (dest / 'PACKAGE.txt').write_text(
            f'{dist.metadata["Name"]} {dist.version}\n'
            f'License: {dist.metadata.get("License-Expression") or dist.metadata.get("License") or "See included license files"}\n'
            f'Home: {dist.metadata.get("Home-page", "")}\n', encoding='utf-8')
        for entry in dist.files or []:
            parts = str(entry).lower()
            if not any(word in parts for word in ('license', 'licence', 'copying', 'notice')):
                continue
            source = Path(dist.locate_file(entry))
            if not source.is_file():
                continue
            # Preserve filenames/subdirectories while removing any ../ wheel prefix.
            relative = Path(*[p for p in Path(entry).parts if p not in ('.', '..')])
            out = dest / relative
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, out)
    runtime = Path(sys.base_prefix)
    pylicense = runtime / 'LICENSE.txt'
    shutil.copy2(pylicense, target / 'Python-LICENSE.txt')
    for source in (runtime / 'tcl').rglob('*'):
        if source.is_file() and any(x in source.name.lower() for x in ('license', 'licence')):
            dest = target / 'Tcl-Tk' / source.relative_to(runtime / 'tcl')
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)
    versions['Python'] = sys.version.split()[0]
    manifest = {'application': 'polish-sci-figures Figure Studio', 'version': VERSION,
                'platform': 'windows-x86_64', 'runtime': versions,
                'projectLicense': 'MIT', 'requiresSystemPython': False,
                'requiresCodex': False,
                'officialProject': 'https://github.com/zhoy0409-debug/polish-sci-figures',
                'officialDownloads': 'https://github.com/zhoy0409-debug/polish-sci-figures/releases',
                'distribution': 'official-companion', 'activationRequired': False}
    (STAGE / 'build-info.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    (STAGE / 'THIRD-PARTY-NOTICES.txt').write_text(
        'Figure Studio bundles CPython and scientific Python libraries.\n'
        'Their original license notices are in THIRD-PARTY-LICENSES.\n'
        'The PyInstaller bootloader distribution exception applies; see its COPYING.txt.\n'
        'Project source: https://github.com/zhoy0409-debug/polish-sci-figures\n'
        'Microsoft Visual C++ runtime components are redistributable components of CPython.\n', encoding='utf-8')


def branding():
    from PIL import Image, ImageDraw
    resources = ROOT / 'desktop' / 'resources'
    resources.mkdir(exist_ok=True)
    im = Image.new('RGBA', (256, 256))
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((4, 4, 252, 252), radius=54, fill='#F8FAFE')
    draw.line((54, 55, 54, 204, 213, 204), fill='#263A52', width=10)
    draw.rounded_rectangle((78, 127, 108, 185), radius=5, fill='#487AAD')
    draw.rounded_rectangle((124, 80, 154, 185), radius=5, fill='#CB617A')
    draw.rounded_rectangle((170, 105, 200, 185), radius=5, fill='#A9BED6')
    im.save(resources / 'figure-studio.ico', sizes=[(x, x) for x in (16, 24, 32, 48, 64, 128, 256)])
    version = tuple(int(v) for v in VERSION.split('.')) + (0,)
    (resources / 'version-info.txt').write_text(f'''VSVersionInfo(
ffi=FixedFileInfo(filevers={version!r}, prodvers={version!r}, mask=0x3f,
flags=0x0, OS=0x40004, fileType=0x1, subtype=0x0, date=(0, 0)),
kids=[StringFileInfo([StringTable('040904B0', [
StringStruct('CompanyName', 'Wenting Zhou'),
StringStruct('FileDescription', 'polish-sci-figures — Figure Studio'),
StringStruct('FileVersion', '{VERSION}'),
StringStruct('InternalName', 'Figure Studio'),
StringStruct('LegalCopyright', 'Copyright (c) 2026 Wenting Zhou'),
StringStruct('OriginalFilename', 'Figure Studio.exe'),
StringStruct('ProductName', 'polish-sci-figures Figure Studio'),
StringStruct('ProductVersion', '{VERSION}')])]),
VarFileInfo([VarStruct('Translation', [1033, 1200])])])
''', encoding='utf-8')


def package(compiler):
    for name in ('LICENSE', 'THIRD-PARTY-NOTICES.txt', 'build-info.json',
                 'QUICKSTART.zh-CN.md', 'QUICKSTART.en.md'):
        if (STAGE / name).exists():
            shutil.copy2(STAGE / name, APP / name)
    shutil.copytree(STAGE / 'THIRD-PARTY-LICENSES', APP / 'THIRD-PARTY-LICENSES', dirs_exist_ok=True)
    # Refresh data-only renderers/resources after a UI fix without refreezing Python.
    target_suite = (APP / '_internal' / 'suite').resolve()
    if APP.resolve() not in target_suite.parents:
        raise ValueError('Invalid packaged resource directory')
    # Remove only this generated resource directory so old plaintext modules
    # cannot survive a resources-only rebuild from an earlier package.
    if target_suite.exists():
        shutil.rmtree(target_suite)
    shutil.copytree(STAGE, target_suite)
    run([compiler, f'/DAppVersion={VERSION}', f'/DBuildRoot={APP}',
         f'/DOutputRoot={DIST}', ROOT / 'desktop' / 'FigureStudio.iss'], WORK / 'installer-build.log')
    archive = DIST / f'polish-sci-figures-Studio-{VERSION}-Portable-x64.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as handle:
        for source in sorted(APP.rglob('*')):
            if source.is_file():
                handle.write(source, Path('Figure Studio') / source.relative_to(APP))
    files = [archive, DIST / f'polish-sci-figures-Studio-{VERSION}-Setup-x64.exe']
    checksums = '\n'.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name for p in files) + '\n'
    (DIST / 'SHA256SUMS.txt').write_text(checksums, encoding='ascii')
    print(checksums, flush=True)


def main():
    global DIST, APP
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--outdir', type=Path, default=DIST,
                        help='Output directory for the frozen app and installers')
    parser.add_argument('--iscc', type=Path, default=ROOT / '.cache/build-tools/inno/ISCC.exe')
    parser.add_argument('--skip-freeze', action='store_true')
    parser.add_argument('--stage-only', action='store_true')
    args = parser.parse_args()
    DIST = args.outdir.resolve()
    APP = DIST / 'Figure Studio'
    if sys.platform != 'win32' or sys.maxsize <= 2**32:
        raise SystemExit('Build on Windows using 64-bit CPython.')
    WORK.mkdir(parents=True, exist_ok=True)
    DIST.mkdir(parents=True, exist_ok=True)
    run([sys.executable, ROOT / 'desktop/build_starter.py'])
    branding()
    copy_suite()
    notices()
    if args.stage_only:
        return
    if not args.skip_freeze:
        run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean',
             '--distpath', DIST, '--workpath', WORK / 'pyinstaller',
             ROOT / 'desktop/FigureStudio.spec'], WORK / 'freeze-build.log')
    if not (APP / 'Figure Studio.exe').exists():
        raise SystemExit('Missing frozen app. Build without --skip-freeze first.')
    if not args.iscc.is_file():
        raise SystemExit('Install Inno Setup and pass --iscc path/to/ISCC.exe.')
    package(args.iscc)


if __name__ == '__main__':
    main()

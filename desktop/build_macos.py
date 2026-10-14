"""Build a native, ad-hoc-signed macOS preview; never upload or publish it.

Requires macOS, native CPython 3.12 with working Tk, and requirements-build.txt.
The preview has no Developer ID signature or notarization. Build each architecture
on its native runner. Frozen HTTP/Tk tests must pass before a ZIP is produced.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import importlib.metadata as metadata
import json
import os
from pathlib import Path
import platform
import py_compile
import shutil
import subprocess
import sys
import sysconfig
import time

ROOT = Path(__file__).resolve().parents[1]
VERSION = '0.1.9'
SUITE_VERSION = 'v1.4.9'
ARCHITECTURES = ('arm64', 'x86_64')
RUNTIME_PACKAGES = ('numpy', 'scipy', 'pandas', 'matplotlib', 'openpyxl', 'Pillow',
                    'pypdfium2', 'pypdf', 'opencv-python-headless', 'pyinstaller',
                    'pyinstaller-hooks-contrib')


def native_arch(requested=None):
    actual = platform.machine()
    if sys.platform != 'darwin' or actual not in ARCHITECTURES:
        raise RuntimeError('Build this preview on a native macOS arm64 or x86_64 runner.')
    if requested and requested != actual:
        raise RuntimeError(f'Requested {requested}, but Python is running as {actual}. Use a native runner.')
    if sys.version_info[:2] != (3, 12):
        raise RuntimeError('The preview build requires CPython 3.12 with matching Tcl/Tk.')
    return actual


def progress(message):
    stamp = datetime.now(timezone.utc).strftime('%H:%M:%SZ')
    print(f'[macOS build {stamp}] {message}', flush=True)


@contextmanager
def phase(name):
    started = time.monotonic()
    progress(f'START {name}')
    try:
        yield
    except BaseException:
        progress(f'FAILED {name} after {time.monotonic() - started:.1f}s')
        raise
    else:
        progress(f'END {name} after {time.monotonic() - started:.1f}s')


def log_tail(path):
    # Read only the end when a command fails; a long build log remains on disk.
    with Path(path).open('rb') as handle:
        handle.seek(0, os.SEEK_END)
        handle.seek(max(0, handle.tell() - 48000))
        return handle.read().decode('utf-8', errors='replace')[-12000:]


def run(args, *, log=None, env=None, timeout=900):
    command = list(map(str, args))
    options = dict(cwd=ROOT, env=env, stderr=subprocess.STDOUT,
                   text=True, errors='replace', timeout=timeout)
    if log:
        log = Path(log)
        log.parent.mkdir(parents=True, exist_ok=True)
        progress(f'Command log: {log}')
        try:
            # Redirect the child directly to its file, so output survives even
            # if it times out before subprocess.run returns.
            with log.open('wb') as handle:
                result = subprocess.run(command, stdout=handle, **options)
        except subprocess.TimeoutExpired:
            progress(f'Command timed out after {timeout}s; partial log retained: {log}')
            print(log_tail(log), flush=True)
            raise
        if result.returncode:
            print(log_tail(log), flush=True)
            result.check_returncode()
        return log.read_text(encoding='utf-8', errors='replace').strip()
    result = subprocess.run(command, stdout=subprocess.PIPE, **options)
    if result.returncode:
        print(result.stdout[-12000:], flush=True)
        result.check_returncode()
    return result.stdout.strip()


def reset_generated(path, boundary):
    path, boundary = Path(path).resolve(), Path(boundary).resolve()
    if path == boundary or boundary not in path.parents:
        raise ValueError(f'Not an isolated generated directory: {path}')
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True)


def repo_build_path(path):
    resolved = Path(path).resolve()
    if ROOT.resolve() not in resolved.parents:
        raise ValueError(f'Build output escapes the repository: {resolved}')
    return resolved


def preflight():
    versions = {name: metadata.version(name) for name in RUNTIME_PACKAGES}
    try:
        import tkinter as tk
        window = tk.Tk()
        try:
            window.withdraw()
            window.update_idletasks()
            versions['Tcl'] = str(window.tk.call('info', 'patchlevel'))
            versions['Tk'] = str(window.tk.call('package', 'provide', 'Tk'))
            libraries = [Path(window.tk.call('info', 'library')),
                         Path(window.tk.eval('set tk_library'))]
        finally:
            window.destroy()
    except Exception as error:
        raise RuntimeError('Tk preflight failed. Use matching native python@3.12 and '
                           'python-tk@3.12, then rerun; a headless Tcl import is insufficient.') from error
    versions['Python'] = platform.python_version()
    return versions, libraries


def branding(resources):
    """Reuse the existing application's bar-chart icon geometry at native 1024px."""
    from PIL import Image, ImageDraw
    resources.mkdir(parents=True, exist_ok=True)
    image = Image.new('RGBA', (1024, 1024))
    draw = ImageDraw.Draw(image)
    scale = lambda box: tuple(value * 4 for value in box)
    # Same coordinates, colors and shapes as build_windows.branding(); no new mark.
    draw.rounded_rectangle(scale((4, 4, 252, 252)), radius=216, fill='#F8FAFE')
    draw.line(scale((54, 55, 54, 204, 213, 204)), fill='#263A52', width=40)
    for box, color in [((78, 127, 108, 185), '#487AAD'),
                       ((124, 80, 154, 185), '#CB617A'),
                       ((170, 105, 200, 185), '#A9BED6')]:
        draw.rounded_rectangle(scale(box), radius=20, fill=color)
    image.save(resources / 'figure-studio.icns', format='ICNS')
    image.resize((256, 256), Image.Resampling.LANCZOS).save(resources / 'figure-studio.png')


def copy_suite(stage):
    sys.path.insert(0, str(ROOT / 'scripts'))
    from build_release import release_files, archive_bytes
    files = list(release_files())
    included = {path.relative_to(ROOT).as_posix() for path in files}
    for source in files:
        target = stage / source.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(archive_bytes(source, included, SUITE_VERSION))
    resources = stage / 'desktop' / 'resources'
    branding(resources)
    # Generate directly in the isolated Mac stage, never in desktop/resources.
    run([sys.executable, ROOT / 'desktop/build_starter.py', '--out', resources / 'starter.html'])
    for source in stage.rglob('*.py'):
        py_compile.compile(str(source), cfile=str(source.with_suffix('.pyc')),
                           dfile='suite/' + source.relative_to(stage).as_posix(), doraise=True,
                           invalidation_mode=py_compile.PycInvalidationMode.UNCHECKED_HASH)
        source.unlink()


def find_runtime_licenses(base, stdlib, libraries):
    python_candidates = [Path(base) / 'LICENSE.txt', Path(stdlib) / 'LICENSE.txt',
                         Path(base) / 'Resources' / 'LICENSE.txt']
    python_license = next((path for path in python_candidates if path.is_file()), None)
    if python_license is None:
        raise RuntimeError('The CPython license was not found in the build runtime.')
    tk_licenses = set()
    for library in libraries:
        folders = [Path(library), *list(Path(library).parents)[:4]]
        found = set()
        for folder in folders:
            for name in ('LICENSE', 'LICENSE.txt', 'license.terms', 'COPYING', 'copyright'):
                candidate = folder / name
                if candidate.is_file() and candidate.resolve() != python_license.resolve():
                    found.add(candidate)
            if found:
                break  # The nearest package notices belong to this Tcl/Tk runtime.
        if not found:
            raise RuntimeError(f'Could not collect Tcl/Tk license for {library}.')
        tk_licenses.update(found)
    return python_license, sorted(tk_licenses)


def homebrew_notices(target):
    """Keep notices for Homebrew native dependencies, not just Python wheels."""
    brew = shutil.which('brew')
    if not brew:
        return {'packages': [], 'excluded': {}}
    formulas = {'python@3.12', 'python-tk@3.12'}
    for formula in tuple(formulas):
        formulas.update(run([brew, 'deps', '--formula', formula]).splitlines())
    collected = []
    excluded = {}
    for formula in sorted(formulas):
        if formula == 'ca-certificates':
            # This is Homebrew's certificate data, not an embedded native library.
            # Our spec copies suite files and PyInstaller runtime dependencies;
            # it does not copy Homebrew's share/ca-certificates directory.
            reason = 'Data-only Homebrew certificate store; not included in the app bundle.'
            excluded[formula] = reason
            print(f'Native notice scope: skip {formula}: {reason}', flush=True)
            continue
        prefix = Path(run([brew, '--prefix', formula])).resolve()
        candidates = list(prefix.glob('*'))
        for folder in (prefix / 'share/doc', prefix / 'share/licenses'):
            if folder.is_dir():
                candidates.extend(folder.rglob('*'))
        notices = [path for path in candidates if path.is_file() and
                   any(word in path.name.lower() for word in ('license', 'licence', 'copying', 'notice', 'copyright'))]
        dest = target / 'Homebrew' / formula.replace('/', '_')
        if not notices and formula == 'sqlite':
            # SQLite's public-domain dedication is not shipped as a LICENSE file
            # by this formula. Preserve its provenance rather than skip its notice.
            dest.mkdir(parents=True, exist_ok=True)
            (dest / 'PUBLIC-DOMAIN.txt').write_text(
                'SQLite is dedicated to the public domain by its authors.\n'
                'Upstream copyright statement: https://sqlite.org/copyright.html\n'
                'This notice records the bundled Homebrew SQLite runtime.\n', encoding='utf-8')
        elif not notices:
            raise RuntimeError(f'Native Homebrew license notices were not found for {formula}.')
        for path in notices:
            out = dest / path.relative_to(prefix)
            out.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, out)
        receipt = prefix / 'INSTALL_RECEIPT.json'
        if receipt.is_file():
            shutil.copy2(receipt, dest / 'INSTALL_RECEIPT.json')
        collected.append(formula)
    return {'packages': collected, 'excluded': excluded}


def notices(stage, versions, libraries, architecture):
    target = stage / 'THIRD-PARTY-LICENSES'
    target.mkdir()
    # Include the installed distributions' notices, including native transitive deps.
    for distribution in metadata.distributions():
        name = distribution.metadata.get('Name', 'package')
        safe_name = ''.join(c if c.isalnum() or c in '-_.' else '_' for c in name).strip('.') or 'package'
        dest = target / safe_name
        dest.mkdir(exist_ok=True)
        (dest / 'PACKAGE.txt').write_text(f'{name} {distribution.version}\n', encoding='utf-8')
        for entry in distribution.files or []:
            if not any(word in str(entry).lower() for word in ('license', 'licence', 'copying', 'notice')):
                continue
            source = Path(distribution.locate_file(entry))
            if source.is_file():
                relative = Path(*[part for part in Path(entry).parts if part not in ('.', '..', '/')])
                out = dest / relative
                if dest.resolve() not in out.resolve().parents:
                    raise ValueError(f'Invalid package notice path: {entry}')
                out.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, out)
    python_license, tk_licenses = find_runtime_licenses(sys.base_prefix, sysconfig.get_path('stdlib'), libraries)
    shutil.copy2(python_license, target / 'Python-LICENSE.txt')
    for index, source in enumerate(tk_licenses):
        shutil.copy2(source, target / f'Tcl-Tk-{index + 1}-{source.name}')
    native_notices = homebrew_notices(target)
    manifest = {'application': 'polish-sci-figures Figure Studio', 'version': VERSION,
                'suiteVersion': SUITE_VERSION, 'platform': f'macos-{architecture}',
                'runtime': versions, 'requiresSystemPython': False, 'requiresCodex': False,
                'nativeNoticePackages': native_notices['packages'],
                'nativeNoticeExclusions': native_notices['excluded'],
                'compute': 'local-loopback-only', 'distribution': 'ci-preview',
                'signing': 'ad-hoc only; no Developer ID', 'notarized': False,
                'minimumPreviewOS': '15.0', 'interactiveMacValidation': 'not performed by this build',
                'officialProject': 'https://github.com/zhoy0409-debug/polish-sci-figures'}
    (stage / 'build-info.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    (stage / 'THIRD-PARTY-NOTICES.txt').write_text(
        'Bundled CPython, Tcl/Tk and scientific-library licenses: THIRD-PARTY-LICENSES.\n'
        'The PyInstaller bootloader distribution exception applies.\n', encoding='utf-8')


def preview_readme(architecture):
    return f'''Figure Studio {VERSION} — macOS {architecture} preview

Internal CI preview; not Developer ID signed or notarized. No claim of Finder,
Gatekeeper, Safari or Chrome interaction testing is made by the build self-test.
Keep the complete .app bundle. Its bundled runtime computes on this Mac and
opens the editor in the default browser; no system Python, Codex or API key is
required. Quit the launcher to stop the local service. No hosted data service
is used. A downloaded preview may be blocked by macOS security checks.

Application files: ~/Library/Application Support/Figure Studio
Projects/autosaves: browser storage for the preserved localhost origin.
Download project backups before upgrades; browser storage is not a backup.
Preview build target: macOS 15, {architecture}. Other systems are unverified.

Figure Studio {VERSION} — macOS {architecture} 预览

仅用于 CI 内部审查，未使用 Developer ID 签名，未经 Apple 公证。
构建自检不代表已完成 Finder、Gatekeeper、Safari 或 Chrome 的交互测试。
请保留完整 .app。程序自带运行环境，在这台 Mac 本机计算，并在默认浏览器
打开编辑器；无需另装 Python、打开 Codex 或提供 API 密钥，不使用云端数据服务。
退出启动窗口会关闭本机服务。下载的预览可能被 macOS 安全检查阻止。
程序文件位于 ~/Library/Application Support/Figure Studio；工程自动保存位于
固定本机地址对应的浏览器存储。升级前请下载工程备份。
本预览构建目标为 macOS 15、{architecture}，其他系统尚未验证。
'''


def load_rpaths(binary, architecture, executable):
    """Expand this binary's LC_RPATH entries without relying on the build host."""
    result = []
    need_path = False
    for line in run(['/usr/bin/otool', '-arch', architecture, '-l', binary]).splitlines():
        text = line.strip()
        if text == 'cmd LC_RPATH':
            need_path = True
        elif need_path and text.startswith('path '):
            path = text[5:].split(' (offset ', 1)[0]
            if path.startswith('@loader_path'):
                path = str(binary.parent) + path[len('@loader_path'):]
            elif path.startswith('@executable_path'):
                path = str(executable.parent) + path[len('@executable_path'):]
            result.append(Path(path))
            need_path = False
    return result


def dependency_is_bundled(location, binary, app, executable, rpaths):
    if location.startswith(('/usr/lib/', '/System/Library/')):
        return True
    if location.startswith('@loader_path/'):
        paths = [binary.parent / location[len('@loader_path/'):]]
    elif location.startswith('@executable_path/'):
        paths = [executable.parent / location[len('@executable_path/'):]]
    elif location.startswith('@rpath/'):
        paths = [folder / location[len('@rpath/'):] for folder in rpaths]
    else:
        return False
    for path in paths:
        resolved = path.resolve()
        if resolved.is_file() and app.resolve() in resolved.parents:
            return True
    return False


def audit_bundle(app, architecture):
    """Check native types, dependency locations, and the bundle's ad-hoc signature.

    The static check uses each binary's and the main executable's LC_RPATH. An
    unusual inherited loader chain may require a later native CI adjustment;
    an unresolved reference never silently passes this preview gate.
    """
    checked = []
    executable = app / 'Contents/MacOS/Figure Studio'
    main_rpaths = load_rpaths(executable, architecture, executable)
    for path in sorted(app.rglob('*')):
        if path.is_symlink() or not path.is_file():
            continue
        with path.open('rb') as handle:
            magic = handle.read(4)
        if magic not in (b'\xcf\xfa\xed\xfe', b'\xce\xfa\xed\xfe', b'\xfe\xed\xfa\xcf',
                         b'\xca\xfe\xba\xbe', b'\xbe\xba\xfe\xca', b'\xca\xfe\xba\xbf'):
            continue
        architectures = run(['/usr/bin/lipo', '-archs', path]).split()
        if architecture not in architectures:
            raise RuntimeError(f'Wrong native architecture in {path}: {architectures}')
        own_ids = run(['/usr/bin/otool', '-arch', architecture, '-D', path]).splitlines()[1:]
        rpaths = load_rpaths(path, architecture, executable) + main_rpaths
        for dependency in run(['/usr/bin/otool', '-arch', architecture, '-L', path]).splitlines()[1:]:
            location = dependency.strip().split(' (', 1)[0]
            if location in own_ids:
                continue
            if not dependency_is_bundled(location, path, app, executable, rpaths):
                raise RuntimeError(f'Unbundled native dependency in {path}: {location}')
        checked.append(str(path.relative_to(app)))
        if len(checked) % 25 == 0:
            progress(f'Native audit: {len(checked)} binaries checked; latest {checked[-1]}')
    if not checked:
        raise RuntimeError('No Mach-O binaries found in the app bundle.')
    progress(f'Native audit: {len(checked)} binaries checked; verifying bundle signature')
    run(['/usr/bin/codesign', '--verify', '--deep', '--strict', app])
    return checked


def frozen_proof(output):
    report = output / 'self-test.json'
    if not report.is_file():
        raise RuntimeError('Frozen self-test did not write its result.')
    value = json.loads(report.read_text(encoding='utf-8'))
    if value.get('passed') is not True or value.get('frozen') is not True:
        raise RuntimeError('The bundled self-test did not confirm a passing frozen runtime.')
    return value


def build(architecture):
    work = repo_build_path(ROOT / '.cache' / f'desktop-macos-{architecture}')
    stage = work / 'suite'
    dist = repo_build_path(ROOT / 'dist' / 'macos' / architecture)
    work.mkdir(parents=True, exist_ok=True)
    reset_generated(stage, work)
    reset_generated(dist, ROOT / 'dist' / 'macos')
    with phase('Native runtime preflight'):
        versions, libraries = preflight()
    with phase('Stage suite and starter'):
        copy_suite(stage)
    with phase('Collect runtime licenses'):
        notices(stage, versions, libraries, architecture)
    (stage / 'MACOS-PREVIEW.txt').write_text(preview_readme(architecture), encoding='utf-8')
    env = dict(os.environ, FIGURE_STUDIO_MAC_ARCH=architecture,
               FIGURE_STUDIO_MAC_STAGE=str(stage), FIGURE_STUDIO_MAC_VERSION=VERSION)
    with phase('Freeze application with PyInstaller'):
        run([sys.executable, '-m', 'PyInstaller', '--noconfirm', '--clean',
             '--distpath', dist, '--workpath', work / 'pyinstaller',
             ROOT / 'desktop/FigureStudio-macos.spec'], log=work / 'freeze.log', env=env, timeout=1800)
    app = dist / 'Figure Studio.app'
    with phase('Audit native libraries and signature'):
        checked = audit_bundle(app, architecture)
    report = {'architecture': architecture, 'binariesChecked': checked, 'runtime': versions,
              'signing': 'ad-hoc only', 'notarized': False}
    (work / 'native-audit.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    clean_env = {key: value for key, value in os.environ.items()
                 if not key.startswith(('PYTHON', 'DYLD_', 'TCL_', 'TK_'))}
    clean_env['PATH'] = '/usr/bin:/bin:/usr/sbin:/sbin'
    reset_generated(work / 'self-test-data', work)
    reset_generated(work / 'self-test-output', work)
    with phase('Frozen local self-test'):
        run([app / 'Contents/MacOS/Figure Studio', '--self-test', '--data-dir', work / 'self-test-data',
             '--output-dir', work / 'self-test-output'], log=work / 'frozen-self-test.log', env=clean_env)
        frozen_proof(work / 'self-test-output')
    archive = dist / f'polish-sci-figures-Studio-{VERSION}-macOS-{architecture}-Preview.zip'
    with phase('Archive application and calculate checksum'):
        run(['/usr/bin/ditto', '-c', '-k', '--sequesterRsrc', '--keepParent', app, archive])
        with archive.open('rb') as handle:
            digest = hashlib.file_digest(handle, 'sha256').hexdigest()
    (dist / 'SHA256SUMS.txt').write_text(f'{digest}  {archive.name}\n', encoding='ascii')
    (dist / 'MACOS-PREVIEW.txt').write_text(preview_readme(architecture), encoding='utf-8')
    print(archive, flush=True)
    return archive


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--arch', choices=ARCHITECTURES)
    args = parser.parse_args()
    build(native_arch(args.arch))


if __name__ == '__main__':
    main()

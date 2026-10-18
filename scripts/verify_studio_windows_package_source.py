"""Read-only final Windows package/source verification; never imports app code.

Only the new explicit JSON output is written. Packaged bytecode is unmarshalled
and compared as code objects, not reserialized marshal bytes (reference flags
can make equal code objects serialize differently). No install or EXE launch.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import marshal
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import zipfile


ROOT = Path(__file__).resolve().parents[1]
BACKEND_PREFIX = 'skills/polish-sci-figures/scripts/'
NOT_PACKAGED_BACKEND_TESTS = frozenset({
    'test_check_source_portability.py', 'test_figure_studio.py',
    'test_figure_text_qa.py', 'test_font_policy.py',
})


def digest(data):
    return hashlib.sha256(data).hexdigest()


def stream_digest(handle):
    hash_value = hashlib.sha256()
    size = 0
    while block := handle.read(1024 * 1024):
        hash_value.update(block)
        size += len(block)
    return hash_value.hexdigest(), size


def file_record(path):
    with path.open('rb') as handle:
        sha, size = stream_digest(handle)
    return {'name': path.name, 'sha256': sha, 'sizeBytes': size}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def manifest_hash(records):
    return digest(json.dumps(records, sort_keys=True, separators=(',', ':')).encode())


def source_stage_identity(source_stage):
    require(isinstance(source_stage, str) and re.fullmatch(r'source[0-9]{1,3}', source_stage), 'Expected a bounded source-stage label such as source16')
    return source_stage.replace('source', 'STAGE', 1) + '_RUNTIME_AND_PORTABLE_MATCH'


def application_build_identity(build, expected_version):
    """Reject a stale or foreign app even when its resource tree is complete."""
    require(isinstance(expected_version, str) and re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', expected_version),
            'Expected the explicit current Windows build version')
    require(isinstance(build, dict) and build.get('version') == expected_version
            and build.get('platform') == 'windows-x86_64', 'Unexpected application build identity')


def approved_ui_freeze(freeze_bytes, expected_freeze_sha256, expected_ui_assets):
    """Bind a possibly expanded UI set to an explicitly approved exact freeze."""
    require(isinstance(expected_freeze_sha256, str) and re.fullmatch(r'[0-9a-f]{64}', expected_freeze_sha256),
            'An explicitly approved freeze SHA-256 is required')
    require(digest(freeze_bytes) == expected_freeze_sha256, 'Freeze bytes differ from the explicitly approved SHA-256')
    require(type(expected_ui_assets) is int and 1 <= expected_ui_assets <= 512,
            'An explicitly approved bounded UI asset count is required')
    freeze = json.loads(freeze_bytes.decode('utf-8'))
    require(isinstance(freeze.get('assets'), dict) and len(freeze['assets']) == expected_ui_assets,
            'UI asset count differs from the explicitly approved exact count')
    names = set()
    for relative, sha in freeze['assets'].items():
        require(isinstance(relative, str), 'Invalid frozen UI asset name')
        name = PurePosixPath(relative)
        require(not name.is_absolute() and '..' not in name.parts and ':' not in relative and '\\' not in relative
                and '\0' not in relative and str(name) == relative and relative,
                'Invalid frozen UI asset relative path')
        require(relative.casefold() not in names, 'Duplicate case-insensitive frozen UI asset path')
        require(isinstance(sha, str) and re.fullmatch(r'[0-9a-f]{64}', sha), 'Invalid frozen UI asset SHA-256')
        names.add(relative.casefold())
    return freeze


def backend_package_boundary(frozen_backend, compiled_by_source, release_included):
    """Distinguish the 27-source freeze from the 23-module release boundary."""
    require(len(frozen_backend) == 27, 'The source freeze must contain 27 backend sources')
    tests = {name for name in frozen_backend if name.startswith('test_')}
    require(tests == NOT_PACKAGED_BACKEND_TESTS, 'Unexpected non-packaged backend test-source boundary')
    production = set(frozen_backend) - tests
    require(len(production) == 23, 'Expected 23 production backend sources')
    files, not_packaged = [], []
    for name, expected_sha in sorted(frozen_backend.items()):
        relative = BACKEND_PREFIX + name
        if name in production:
            require(relative in release_included, 'Production backend source is absent from the release allowlist: ' + name)
            item = compiled_by_source.get(relative)
            require(item is not None and item['sourceSha256'] == expected_sha and item['compiledCodeEqual'] is True,
                    'Frozen production backend code is missing or differs: ' + name)
            files.append({'file': name, 'sha256': expected_sha, 'packaged': True, 'compiledCodeObjectVerified': True})
        else:
            require(relative not in release_included and relative not in compiled_by_source,
                    'A declared non-packaged test backend source was unexpectedly packaged: ' + name)
            not_packaged.append({'file': name, 'sha256': expected_sha})
            files.append({'file': name, 'sha256': expected_sha, 'packaged': False, 'compiledCodeObjectVerified': False})
    return {'status': 'PASS', 'count': 27, 'packagedProductionCount': 23,
            'allPackagedProductionCodeObjectsVerified': True, 'notPackagedTests': not_packaged,
            'notPackagedTestReason': 'The release builder excludes these four test_*.py sources. Their current source hashes are checked against the freeze, but no packaged code-object claim is made for them.',
            'files': files}


def verify(package, freeze_path, preflight_path, expected_doc_snapshots=(), *, source_stage='source09',
           expected_freeze_sha256=None, expected_ui_assets=None):
    status = source_stage_identity(source_stage)
    freeze_bytes = freeze_path.read_bytes()
    freeze = approved_ui_freeze(freeze_bytes, expected_freeze_sha256, expected_ui_assets)
    from PyInstaller.archive.readers import CArchiveReader

    app = package / 'Figure Studio'
    suite = app / '_internal' / 'suite'
    frozen_backend = freeze['backend']
    require(len(frozen_backend) == 27, 'The source freeze must contain 27 backend modules')
    backend_root = ROOT / 'skills/polish-sci-figures/scripts'
    for name, expected_sha in sorted(frozen_backend.items()):
        require(Path(name).name == name and name.endswith('.py'), 'Invalid backend relative name')
        require(digest((backend_root / name).read_bytes()) == expected_sha, 'Current backend differs from source freeze: ' + name)
    preflight = json.loads(preflight_path.read_text(encoding='utf-8'))
    sums_path = package / 'SHA256SUMS.txt'
    expected = {}
    for line in sums_path.read_text(encoding='utf-8').splitlines():
        sha, name = line.split(maxsplit=1)
        name = name.lstrip('*')
        require(Path(name).name == name and len(sha) == 64, 'Invalid checksum entry')
        require(name not in expected, 'Duplicate checksum entry')
        expected[name] = sha
    require(len(expected) == 2, 'Expected exactly Setup and Portable checksums')
    artifacts = [file_record(package / name) for name in sorted(expected)]
    for item in artifacts:
        require(item['sha256'] == expected[item['name']], 'Artifact checksum mismatch: ' + item['name'])
    portable = next(package / item['name'] for item in artifacts if item['name'].endswith('-Portable-x64.zip'))
    require(any(item['name'].endswith('-Setup-x64.exe') for item in artifacts), 'Setup artifact missing')

    assets = []
    asset_root = suite / 'skills/polish-sci-figures/assets/figure-studio'
    for relative, sha in sorted(freeze['assets'].items()):
        name = PurePosixPath(relative)
        require(not name.is_absolute() and '..' not in name.parts, 'Invalid asset relative path')
        actual = digest((asset_root / relative).read_bytes())
        require(actual == sha, 'Frozen UI asset differs: ' + relative)
        assets.append({'file': relative, 'sha256': actual})
    require({p.relative_to(asset_root).as_posix() for p in asset_root.rglob('*') if p.is_file()} == set(freeze['assets']), 'Packaged UI asset file set differs from freeze')

    compiled, third_party = [], []
    for path in sorted(suite.rglob('*.pyc')):
        relative = path.relative_to(suite).as_posix()
        source_relative = Path(relative).with_suffix('.py').as_posix()
        source = ROOT / source_relative
        if not source.is_file():
            require(relative.startswith('THIRD-PARTY-LICENSES/'), 'Unmapped non-third-party bytecode: ' + relative)
            third_party.append(relative)
            continue
        raw = path.read_bytes()
        require(raw[:4] == importlib.util.MAGIC_NUMBER, 'Python bytecode version differs: ' + relative)
        actual = marshal.loads(raw[16:])
        current = compile(source.read_bytes(), actual.co_filename, 'exec', dont_inherit=True, optimize=0)
        require(actual == current, 'Packaged code object differs from current source: ' + source_relative)
        compiled.append({'file': relative, 'sourceFile': source_relative, 'sourceSha256': digest(source.read_bytes()), 'bytecodeSha256': digest(raw), 'compiledCodeEqual': True})
    dynamic = 'skills/polish-sci-figures/scripts/studio_render_statistics.pyc'
    require(any(item['file'] == dynamic for item in compiled), 'New dynamic render-statistics module is not packaged')
    compiled_by_source = {item['sourceFile']: item for item in compiled}

    # Independently derive the suite allowlist from the actual release builder.
    # Source docs may be rewritten for release links, so compare their canonical
    # archive_bytes output rather than incorrectly requiring raw Markdown bytes.
    sys.path.insert(0, str(ROOT / 'scripts'))
    import build_release
    included = {path.relative_to(ROOT).as_posix() for path in build_release.release_files()}
    source_backend = {**backend_package_boundary(frozen_backend, compiled_by_source, included), 'currentSourcesMatchFreeze': True}
    allow = set()
    data_count = 0
    document_snapshots = []
    for relative in sorted(included):
        source = ROOT / relative
        destination = Path(relative).with_suffix('.pyc').as_posix() if source.suffix == '.py' else relative
        allow.add(destination)
        require((suite / destination).is_file(), 'Release suite file missing: ' + destination)
        if source.suffix != '.py':
            packaged_bytes = (suite / destination).read_bytes()
            current_bytes = build_release.archive_bytes(source, included, build_release.VERSION)
            if packaged_bytes != current_bytes:
                require(relative in expected_doc_snapshots and relative.startswith('docs/') and relative.endswith('.md'), 'Release data differs from current source: ' + relative)
                document_snapshots.append({'file': relative, 'packagedSha256': digest(packaged_bytes), 'packagedSizeBytes': len(packaged_bytes), 'currentCanonicalReleaseSha256': digest(current_bytes), 'currentCanonicalReleaseSizeBytes': len(current_bytes), 'status': 'DOCUMENT_SNAPSHOT_DIFFERENCE', 'reason': 'Explicitly allowed build-time documentation snapshot; the current external report was updated after packaging. This is not runtime source parity.'})
            else:
                data_count += 1
    for name in ('starter.html', 'figure-studio.ico'):
        relative = 'desktop/resources/' + name
        allow.add(relative)
        require((suite / relative).read_bytes() == (ROOT / relative).read_bytes(), 'Desktop resource differs: ' + relative)
    for name in ('QUICKSTART.en.md', 'QUICKSTART.zh-CN.md'):
        allow.add(name)
        require((suite / name).read_bytes() == (ROOT / 'desktop' / name).read_bytes(), 'Root quickstart differs: ' + name)
    generated = {'build-info.json', 'THIRD-PARTY-NOTICES.txt'}
    unexpected = [path.relative_to(suite).as_posix() for path in suite.rglob('*') if path.is_file() and path.relative_to(suite).as_posix() not in allow | generated and not path.relative_to(suite).as_posix().startswith('THIRD-PARTY-LICENSES/')]
    require(not unexpected, 'Unexpected suite file outside release allowlist: ' + ', '.join(unexpected))

    executable = app / 'Figure Studio.exe'
    executable_record = file_record(executable)
    archive = CArchiveReader(str(executable))
    pyz = archive.open_embedded_archive('PYZ.pyz')
    natives = []
    for module in ('windows_updater', 'figure_studio_app'):
        actual = pyz.extract(module) if module in pyz.toc else marshal.loads(archive.extract(module))
        source = ROOT / 'desktop' / (module + '.py')
        current = compile(source.read_bytes(), actual.co_filename, 'exec', dont_inherit=True, optimize=0)
        require(actual == current, 'Native executable module differs from source: ' + module)
        prior = next(item for item in preflight['checks'] if item['module'] == module)
        require(prior['compiledCodeEqual'] and prior['currentSourceSha256'] == digest(source.read_bytes()), 'Native preflight source mismatch: ' + module)
        natives.append({'module': module, 'sourceFile': 'desktop/' + module + '.py', 'sourceSha256': digest(source.read_bytes()), 'compiledCodeEqual': True})
    require(preflight['frozenExecutableSha256'] == executable_record['sha256'], 'Final executable differs from the source-verified native freeze')

    # Hash every application file and every streamed ZIP member independently.
    # No extraction occurs; reject ambiguous paths, duplicate names and symlinks.
    tree = {}
    for path in sorted(app.rglob('*')):
        require(not path.is_symlink(), 'Application tree contains a symbolic link')
        if path.is_file():
            relative = path.relative_to(app).as_posix()
            with path.open('rb') as handle:
                sha, size = stream_digest(handle)
            tree[relative] = {'sha256': sha, 'sizeBytes': size}
    zip_records = {}
    with zipfile.ZipFile(portable) as zipped:
        for item in zipped.infolist():
            relative = PurePosixPath(item.filename)
            require('\\' not in item.filename and ':' not in item.filename and not relative.is_absolute() and '..' not in relative.parts and relative.parts and relative.parts[0] == 'Figure Studio', 'Unsafe ZIP path')
            require(not stat.S_ISLNK(item.external_attr >> 16), 'ZIP symbolic links are not supported')
            if item.is_dir():
                continue
            relative = PurePosixPath(*relative.parts[1:]).as_posix()
            require(relative not in zip_records and relative not in ('.', ''), 'Duplicate or empty ZIP member')
            require(not any(part.casefold() in {'.cache', '.git', '.codex', '.agents'} for part in PurePosixPath(relative).parts), 'Private development/cache path in ZIP')
            with zipped.open(item) as handle:
                sha, size = stream_digest(handle)
            require(size == item.file_size, 'ZIP member length mismatch')
            zip_records[relative] = {'sha256': sha, 'sizeBytes': size}
    require(zip_records == tree, 'ZIP/application tree file-set or streamed-content mismatch')
    build = json.loads((app / 'build-info.json').read_text(encoding='utf-8'))
    sys.path.insert(0, str(ROOT / 'desktop'))
    import build_windows
    application_build_identity(build, build_windows.VERSION)

    return {
        'schema': 'figure-studio-windows-package-source-match/1', 'status': status,
        'sourceStage': source_stage, 'finalAcceptance': False,
        'acceptanceStage': source_stage + ' package/source evidence; installation and final product acceptance are separate and not asserted by this read-only report.',
        'applicationVersion': build['version'], 'suiteVersion': build_release.VERSION,
        'verification': 'Read-only offline artifact verification. No install, extraction, app execution, registry changes or browser.',
        'artifacts': artifacts, 'checksumsFileSha256': digest(sums_path.read_bytes()),
        'sourceFreezeManifestSha256': digest(freeze_path.read_bytes()), 'sourceFreezeHtmlSha256': freeze['htmlSha256'],
        'freezeApproval': {'approvedManifestSha256': expected_freeze_sha256, 'approvedUiAssetCount': expected_ui_assets,
                           'freezeBytesExact': True, 'assetCountExact': True},
        'sourceBackend': source_backend,
        'uiAssets': {'status': 'PASS', 'count': len(assets), 'fileSetExact': True, 'files': assets},
        'suiteCodeObjects': {'status': 'PASS', 'mappedModules': len(compiled), 'unmappedThirdPartyLicenseBytecode': third_party, 'newRenderStatisticsModuleVerified': True, 'comparison': 'marshal.loads(actual PYC payload) == compile(current source bytes, actual.co_filename, exec, dont_inherit=True, optimize=0); never marshal.dumps byte equality', 'files': compiled},
        'suiteData': {'status': 'MATCH_EXCEPT_EXPLICIT_DOCUMENT_SNAPSHOT' if document_snapshots else 'PASS', 'releaseDataFilesMatched': data_count, 'documentSnapshotDifferences': document_snapshots, 'desktopResourcesMatched': 2, 'rootQuickstartsMatched': 2, 'unexpectedNonThirdPartyFiles': 0, 'allowlist': 'Current build_release.release_files plus desktop starter/icon, root quickstart copies and generated build metadata/notices; dependency notices remain under THIRD-PARTY-LICENSES.'},
        'nativeExecutable': {**executable_record, 'status': 'PASS', 'preflightExecutableExact': True, 'preflightEvidenceSha256': digest(preflight_path.read_bytes()), 'modules': natives},
        'portableTree': {'status': 'PASS', 'applicationFiles': len(tree), 'streamedZipFiles': len(zip_records), 'fileSetExact': True, 'allSizesExact': True, 'allStreamSha256Exact': True, 'canonicalRelativeManifestSha256': manifest_hash(tree), 'unsafePaths': 0, 'symlinks': 0, 'developmentCachePaths': 0},
        'scope': 'Setup/Portable hash and size, the explicitly approved exact frozen UI asset set, all mapped suite code objects, canonical release-data allowlist, two actual native executable modules and every portable file. This does not substitute for installation, frozen self-test, update transport, or real editor acceptance.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--freeze', type=Path, required=True)
    parser.add_argument('--expected-freeze-sha256', required=True, help='Explicitly approved SHA-256 of the complete source freeze manifest bytes.')
    parser.add_argument('--expected-ui-assets', type=int, required=True, help='Explicitly approved exact UI asset count; never a minimum or inferred historical count.')
    parser.add_argument('--preflight', type=Path, required=True)
    parser.add_argument('--source-stage', default='source09', help='Explicit bounded evidence label, e.g. source16; does not imply installation acceptance.')
    parser.add_argument('--expected-doc-snapshot', action='append', default=[], help='Explicit relative docs/*.md build-time snapshot permitted to differ; both hashes are reported.')
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    require(not args.out.exists(), 'Refusing to overwrite a verification report')
    result = verify(args.package, args.freeze, args.preflight, args.expected_doc_snapshot, source_stage=args.source_stage,
                    expected_freeze_sha256=args.expected_freeze_sha256, expected_ui_assets=args.expected_ui_assets)
    # Whitelist output above intentionally omits local source/packaging paths.
    text = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    require('C:\\' not in text and 'C:/' not in text and '\\Users\\' not in text, 'Unsafe machine path in public output')
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(text, encoding='utf-8')
    print(json.dumps({'status': result['status'], 'assets': result['uiAssets']['count'], 'modules': result['suiteCodeObjects']['mappedModules'], 'portableFiles': result['portableTree']['applicationFiles'], 'artifacts': result['artifacts']}, ensure_ascii=False))


if __name__ == '__main__':
    main()

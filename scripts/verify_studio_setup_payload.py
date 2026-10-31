"""Compare an offline-extracted Setup payload with the pinned Portable archive.

Never runs an installer, app or extractor. Only a new JSON report is written.
Extraction must be performed separately; this checks the resulting {app} tree.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import zipfile

from verify_studio_windows_package_source import (
    file_record, manifest_hash, require, stream_digest,
)


def regular_path(path):
    info = path.lstat()
    require(not stat.S_ISLNK(info.st_mode)
            and not (getattr(info, 'st_file_attributes', 0)
                     & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0)),
            'Symlink or reparse point in extracted payload')
    return info


def extracted_inventory(root):
    require(stat.S_ISDIR(regular_path(root).st_mode), 'Expected an extracted application directory')
    records = {}
    folded = set()
    for directory, folders, files in os.walk(root, followlinks=False):
        for name in folders:
            regular_path(Path(directory) / name)
        for name in files:
            path = Path(directory) / name
            require(stat.S_ISREG(regular_path(path).st_mode), 'Non-regular extracted payload file')
            relative = path.relative_to(root).as_posix()
            require(relative.casefold() not in folded, 'Duplicate case-insensitive extracted path')
            folded.add(relative.casefold())
            records[relative] = path
    require(records, 'Empty extracted application payload')
    return records


def portable_inventory(archive):
    records = {}
    folded = set()
    for item in archive.infolist():
        # ZipInfo normalizes backslashes on Windows and truncates at NUL.
        # Inspect the original member string before trusting normalized paths.
        name = item.orig_filename
        path = PurePosixPath(name)
        require(not path.is_absolute() and '..' not in path.parts and ':' not in name
                and '\\' not in name and '\0' not in name
                and path.parts and path.parts[0] == 'Figure Studio'
                and name.rstrip('/') == str(path), 'Unsafe Portable member path')
        require(not stat.S_ISLNK(item.external_attr >> 16), 'Symlink in Portable archive')
        if item.is_dir():
            continue
        require(len(path.parts) > 1, 'Invalid Portable application root')
        relative = PurePosixPath(*path.parts[1:]).as_posix()
        require(relative.casefold() not in folded, 'Duplicate case-insensitive Portable member')
        require(not item.flag_bits & 1, 'Encrypted Portable member')
        folded.add(relative.casefold())
        records[relative] = item
    require(records, 'Empty Portable application payload')
    return records


def verify(setup, portable, extracted_app, expected_setup_sha256, expected_portable_sha256):
    artifacts = []
    for path, expected in ((setup, expected_setup_sha256), (portable, expected_portable_sha256)):
        require(isinstance(expected, str) and re.fullmatch(r'[0-9a-f]{64}', expected),
                'Explicit artifact SHA-256 required')
        require(stat.S_ISREG(regular_path(path).st_mode), 'Expected a regular artifact')
        item = file_record(path)
        require(item['sha256'] == expected, 'Artifact checksum mismatch: ' + path.name)
        artifacts.append(item)
    actual = extracted_inventory(extracted_app)
    records = []
    with zipfile.ZipFile(portable) as archive:
        expected = portable_inventory(archive)
        require(actual.keys() == expected.keys(), 'Setup/Portable application file sets differ')
        for relative, item in sorted(expected.items()):
            record = file_record(actual[relative])
            require(record['sizeBytes'] == item.file_size, 'Setup/Portable file size differs: ' + relative)
            with archive.open(item) as handle:
                sha, size = stream_digest(handle)
            require(size == record['sizeBytes'] and sha == record['sha256'],
                    'Setup/Portable file bytes differ: ' + relative)
            records.append({'file': relative, 'sizeBytes': size, 'sha256': sha})
    return {
        'schema': 'figure-studio-setup-payload-match/1', 'author': 'a',
        'createdUtc': datetime.now(timezone.utc).isoformat(),
        'status': 'SETUP_PAYLOAD_AND_PORTABLE_MATCH', 'artifacts': artifacts,
        'applicationFiles': len(records), 'fileSetExact': True,
        'allSizesExact': True, 'allStreamSha256Exact': True,
        'canonicalRelativeManifestSha256': manifest_hash(records),
        'unsafePaths': 0, 'symlinksOrReparsePoints': 0,
        'finalAcceptance': False,
        'scope': 'Offline-extracted Setup application payload versus every pinned Portable file. '
                 'No installation, app execution, browser, registry changes, native IME, '
                 'native performance or real update acceptance. Extractor provenance is recorded separately.',
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--setup', type=Path, required=True)
    parser.add_argument('--portable', type=Path, required=True)
    parser.add_argument('--extracted-app', type=Path, required=True)
    parser.add_argument('--expected-setup-sha256', required=True)
    parser.add_argument('--expected-portable-sha256', required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    require(not args.out.exists(), 'Refusing to overwrite a verification report')
    result = verify(args.setup, args.portable, args.extracted_app,
                    args.expected_setup_sha256, args.expected_portable_sha256)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open('x', encoding='utf-8') as handle:
        handle.write(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': result['status'], 'applicationFiles': result['applicationFiles']}))


if __name__ == '__main__':
    main()

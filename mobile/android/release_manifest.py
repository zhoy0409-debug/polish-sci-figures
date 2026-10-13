"""Record public APK identity after a successful apksigner verification.

This script never accesses signing keys. CI supplies fresh public reports for
the same final APK, and the version is checked against the Gradle source.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re


def manifest(apk: Path, signature: str, badging: str, gradle: str, *, repository: str, run_id: str, commit: str):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Invalid source repository')
    if not re.fullmatch(r'[1-9][0-9]*', run_id) or not re.fullmatch(r'[a-f0-9]{40}', commit):
        raise ValueError('A real Actions run and full commit SHA are required')
    identity = re.search(r"^package: name='([^']+)' versionCode='([0-9]+)' versionName='([^']+)'", badging, re.M)
    version_name = re.search(r"\bversionName\s+'([^']+)'", gradle)
    version_code = re.search(r'\bversionCode\s+([0-9]+)\b', gradle)
    if not identity or not version_name or not version_code:
        raise ValueError('APK identity or expected Gradle version is missing')
    app_id, code, name = identity.groups()
    if app_id != 'org.polishscifigures.studio.preview.debug' or name != version_name[1] or code != version_code[1]:
        raise ValueError('APK package/version differs from the requested development preview')
    certificates = re.findall(r'^Signer #[0-9]+ certificate SHA-256 digest: ([a-fA-F0-9]{64})\s*$', signature, re.M)
    verified = re.search(r'^Verified using v2 scheme[^\r\n]*: true\s*$', signature, re.M)
    if not re.search(r'^Verifies\s*$', signature, re.M) or not verified or len(certificates) != 1:
        raise ValueError('A verified APK v2 signature with one signer is required')
    with apk.open('rb') as handle:
        digest = hashlib.file_digest(handle, 'sha256').hexdigest()
    return {
        'schema': 'figure-studio-android-distribution/1',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'distribution': 'development-preview',
        'file': apk.name, 'bytes': apk.stat().st_size, 'sha256': digest,
        'applicationId': app_id, 'versionName': name, 'versionCode': int(code),
        'signature': {'verifiedBy': 'Android SDK apksigner', 'apkSignatureV2Verified': True,
                      'certificateSha256': certificates[0].lower(), 'keyManagement': 'ephemeral-ci-debug-key'},
        'upgrade': {'matchingCertificateRequired': True, 'inPlaceUpgradeGuaranteed': False,
                    'backupProjectBeforeUninstall': True},
        'source': {'repository': repository, 'commit': commit, 'runId': int(run_id),
                   'runUrl': f'https://github.com/{repository}/actions/runs/{run_id}'},
        'validationScope': 'Emulator tests and public artifact verification; not physical-device or store certification',
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apk', type=Path, required=True)
    parser.add_argument('--signature-report', type=Path, required=True)
    parser.add_argument('--badging-report', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = manifest(args.apk, args.signature_report.read_text(encoding='utf-8'),
                      args.badging_report.read_text(encoding='utf-8'),
                      (Path(__file__).parent / 'app/build.gradle').read_text(encoding='utf-8'),
                      repository=os.environ['GITHUB_REPOSITORY'], run_id=os.environ['GITHUB_RUN_ID'], commit=os.environ['GITHUB_SHA'])
    args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))

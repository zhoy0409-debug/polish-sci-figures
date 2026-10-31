"""Tiny controlled payloads exercise the offline verifier, never an installer."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile

from verify_studio_setup_payload import verify


class SetupPayloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.setup = self.root / 'Setup.exe'
        self.setup.write_bytes(b'Clearly synthetic; not an executable')
        self.portable = self.root / 'Portable.zip'
        self.app = self.root / 'extracted' / '{app}'
        self.app.mkdir(parents=True)
        self.files = {'Figure Studio.exe': b'Clearly synthetic program bytes',
                      '_internal/suite/labels-\u6807\u7b7e.txt': b'public fixture'}
        for name, data in self.files.items():
            path = self.app / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        self.write_zip()

    def write_zip(self, names=None):
        with zipfile.ZipFile(self.portable, 'w') as archive:
            for name, data in (names if names is not None else
                               [('Figure Studio/' + n, b) for n, b in self.files.items()]):
                item = zipfile.ZipInfo()
                item.filename = name  # Preserve malformed raw names on Windows.
                archive.writestr(item, data)

    def hashes(self):
        return [hashlib.sha256(p.read_bytes()).hexdigest() for p in (self.setup, self.portable)]

    def check(self):
        return verify(self.setup, self.portable, self.app, *self.hashes())

    def test_exact_bytes_with_nested_and_unicode_paths_pass_without_absolute_paths(self):
        result = self.check()
        self.assertEqual(result['applicationFiles'], 2)
        self.assertTrue(result['allStreamSha256Exact'])
        self.assertFalse(result['finalAcceptance'])
        self.assertNotIn(str(self.root), json.dumps(result))

    def test_same_size_wrong_bytes_fail(self):
        path = self.app / 'Figure Studio.exe'
        path.write_bytes(b'X' * path.stat().st_size)
        with self.assertRaisesRegex(ValueError, 'file bytes differ'):
            self.check()

    def test_missing_and_extra_members_fail(self):
        path = self.app / 'Figure Studio.exe'
        path.unlink()
        with self.assertRaisesRegex(ValueError, 'file sets differ'):
            self.check()
        path.write_bytes(self.files['Figure Studio.exe'])
        (self.app / 'unexpected.txt').write_bytes(b'not allowed')
        with self.assertRaisesRegex(ValueError, 'file sets differ'):
            self.check()

    def test_wrong_pinned_artifacts_fail_before_payload_validation(self):
        for i in range(2):
            hashes = self.hashes()
            hashes[i] = '0' * 64
            with self.subTest(artifact=i), self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                verify(self.setup, self.portable, self.app, *hashes)

    def test_unsafe_and_case_duplicate_zip_members_fail(self):
        for name in ('../outside.txt', 'Figure Studio/../outside.txt', 'Other/file.txt',
                     'Figure Studio/C:/file.txt', 'Figure Studio/back\\slash.txt'):
            self.write_zip([(name, b'x')])
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'Unsafe Portable'):
                self.check()
        self.write_zip([('Figure Studio/A.txt', b'a'), ('Figure Studio/a.txt', b'a')])
        with self.assertRaisesRegex(ValueError, 'Duplicate case-insensitive'):
            self.check()

    def test_zip_symlink_is_rejected(self):
        item = zipfile.ZipInfo('Figure Studio/link')
        item.create_system = 3
        item.external_attr = 0o120777 << 16
        with zipfile.ZipFile(self.portable, 'w') as archive:
            archive.writestr(item, b'../../outside')
        with self.assertRaisesRegex(ValueError, 'Symlink in Portable'):
            self.check()

    def test_cli_writes_new_report_and_refuses_to_overwrite_it(self):
        report = self.root / 'report.json'
        hashes = self.hashes()
        cmd = [sys.executable, str(Path(__file__).with_name('verify_studio_setup_payload.py')),
               '--setup', str(self.setup), '--portable', str(self.portable),
               '--extracted-app', str(self.app), '--expected-setup-sha256', hashes[0],
               '--expected-portable-sha256', hashes[1], '--out', str(report)]
        first = subprocess.run(cmd, capture_output=True)
        self.assertEqual(first.returncode, 0, first.stderr)
        before = report.read_bytes()
        second = subprocess.run(cmd, capture_output=True)
        self.assertNotEqual(second.returncode, 0)
        self.assertIn(b'Refusing to overwrite', second.stderr)
        self.assertEqual(report.read_bytes(), before)


if __name__ == '__main__':
    unittest.main(verbosity=2)

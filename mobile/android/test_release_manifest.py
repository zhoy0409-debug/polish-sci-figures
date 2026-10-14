import hashlib
from pathlib import Path
import tempfile
import unittest

from release_manifest import manifest


class ManifestTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[2] / '.cache')
        self.apk = Path(self.temp.name) / 'test.apk'
        self.apk.write_bytes(b'Synthetic metadata test fixture; not a real APK')
        self.signature = 'Verifies\nVerified using v2 scheme (APK Signature Scheme v2): true\nSigner #1 certificate SHA-256 digest: ' + 'a' * 64 + '\n'
        self.badging = "package: name='org.polishscifigures.studio.preview.debug' versionCode='3' versionName='0.1.7-local-preview' platformBuildVersionName='15'\n"
        self.gradle = "versionCode 3\nversionName '0.1.7-local-preview'"

    def tearDown(self):
        self.temp.cleanup()

    def build(self, **changes):
        values = dict(apk=self.apk, signature=self.signature, badging=self.badging, gradle=self.gradle,
                      repository='zhoy0409-debug/polish-sci-figures', run_id='1234', commit='f' * 40)
        values.update(changes)
        return manifest(**values)

    def test_versions_public_certificate_and_digest(self):
        result = self.build()
        self.assertEqual(result['sha256'], hashlib.sha256(self.apk.read_bytes()).hexdigest())
        self.assertEqual(result['versionName'], '0.1.7-local-preview')
        self.assertEqual(result['versionCode'], 3)
        self.assertEqual(result['signature']['certificateSha256'], 'a' * 64)
        self.assertFalse(result['upgrade']['inPlaceUpgradeGuaranteed'])

    def test_wrong_version_or_package_is_rejected(self):
        for badging in [self.badging.replace("versionCode='3'", "versionCode='1'"),
                        self.badging.replace('0.1.7', '0.1.6'), self.badging.replace('.preview.debug', '.other')]:
            with self.assertRaises(ValueError): self.build(badging=badging)

    def test_missing_failed_or_ambiguous_signature_is_rejected(self):
        for signature in ['', self.signature.replace(': true', ': false'), self.signature.replace('Verifies\n', ''),
                          self.signature + 'Signer #2 certificate SHA-256 digest: ' + 'b' * 64]:
            with self.assertRaises(ValueError): self.build(signature=signature)

    def test_source_must_be_real_ci_identifiers(self):
        for changes in [dict(repository='https://evil.invalid'), dict(run_id='local'), dict(commit='short')]:
            with self.assertRaises(ValueError): self.build(**changes)


if __name__ == '__main__': unittest.main()

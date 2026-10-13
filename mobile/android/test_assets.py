import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('android_assets', BASE / 'prepare_assets.py')
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


class AssetsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=assets.ROOT / '.cache')
        self.root = Path(self.temp.name)
        self.source = self.root / 'source'; self.source.mkdir()
        files = {'starter.html':'<head><script id="local-engine"></script></head>', 'index.html':'<head><script id="local-engine"></script></head>', 'engine-manifest.json':'{}', 'local-engine.js':'', 'offline.js':''}
        checks = []
        for name, value in files.items():
            raw = value.encode(); (self.source / name).write_bytes(raw)
            checks.append(hashlib.sha256(raw).hexdigest() + '  ' + name)
        (self.source / 'SHA256SUMS.txt').write_text('\n'.join(checks), encoding='utf-8')
        self.allowed = self.root / 'assets'
    def tearDown(self):
        self.temp.cleanup()
    def test_only_verified_public_files_and_early_bridge(self):
        (self.source / 'private-project.json').write_text('do not package')
        assets.stage(self.source, self.allowed / 'www', self.allowed)
        self.assertFalse((self.allowed / 'www/private-project.json').exists())
        html = (self.allowed / 'www/starter.html').read_text()
        self.assertLess(html.index('native-bridge.js'), html.index('local-engine'))
        manifest = json.loads((self.allowed / 'www/native-bundle-manifest.json').read_text())
        for item in manifest['files']:
            self.assertEqual(assets.digest(self.allowed / 'www' / item['path']), item['sha256'])
    def test_checksum_tampering_rejected(self):
        (self.source / 'offline.js').write_text('tampered')
        with self.assertRaisesRegex(ValueError, 'checksum'):
            assets.stage(self.source, self.allowed / 'www', self.allowed)
    def test_path_escape_and_unmarked_output_rejected(self):
        with self.assertRaisesRegex(ValueError, 'inside'):
            assets.stage(self.source, self.root / 'other', self.allowed)
        (self.allowed / 'www').mkdir(parents=True)
        with self.assertRaisesRegex(ValueError, 'unmarked'):
            assets.stage(self.source, self.allowed / 'www', self.allowed)
    def test_manifest_path_traversal_rejected(self):
        (self.source / 'SHA256SUMS.txt').write_text('0' * 64 + '  ../private.json')
        with self.assertRaises(ValueError):
            assets.verified_files(self.source)


if __name__ == '__main__': unittest.main()

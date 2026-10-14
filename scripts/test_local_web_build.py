"""Check actual public bundle checksums and destructive-build boundaries."""
from __future__ import annotations
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('local_web_builder', ROOT / 'scripts/build_local_web_preview.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class LocalWebBuild(unittest.TestCase):
    def test_public_bundle_hashes_and_mounts(self):
        output = ROOT / '.cache/local-web-preview'
        manifest = json.loads((output / 'engine-manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['runtime']['version'], '0.29.3')
        files = {entry['path']: entry for entry in manifest['files']}
        for name, entry in files.items():
            path = (output / name).resolve()
            self.assertIn(output.resolve(), path.parents)
            raw = path.read_bytes()
            self.assertEqual(len(raw), entry['bytes'], name)
            self.assertEqual(builder.sha256(raw), entry['sha256'], name)
        for source in manifest['pythonSources']:
            self.assertIn(source['path'], files)
            self.assertTrue(source['destination'].startswith('/suite/skills/'))
            self.assertNotIn('..', source['destination'])
        self.assertTrue(any(s['destination'].endswith('/studio_image_links.py') for s in manifest['pythonSources']))
        self.assertIn('"imageLinksEndpoint": "/api/image-links"', (output/'index.html').read_text(encoding='utf-8'))
        self.assertIn('licenses/Pyodide-0.29.3-LICENSE', files)
        self.assertIn('licenses/Python-3.13.2-LICENSE', files)
        self.assertIn('licenses/OpenBLAS-0.3.26-LICENSE', files)
        offline = json.loads((output / 'offline-manifest.json').read_text(encoding='utf-8'))
        self.assertGreater(len(offline['files']), len(files))
        self.assertTrue(all(not item['path'].startswith(('http:', 'https:', '/')) for item in offline['files']))

    def test_output_cannot_escape_generated_cache(self):
        for path in [ROOT, ROOT / '.cache', ROOT.parent, ROOT / '.cache/../skills', ROOT / '.cache/.hidden']:
            with self.assertRaises(ValueError, msg=str(path)):
                builder.checked_output(path)

    def test_unmarked_directory_is_never_removed(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache', prefix='local-web-protected-') as folder:
            target = Path(folder)
            source = target / 'user-project.json'
            source.write_text('{"untouched": true}', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'without the local web preview marker'):
                builder.build(target)
            self.assertEqual(source.read_text(encoding='utf-8'), '{"untouched": true}')

    def test_modified_cached_wheel_rejected_before_output_changes(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache', prefix='local-web-bad-cache-') as folder:
            cache = Path(folder)
            (cache / 'package.json').write_text(json.dumps({'name': 'pyodide', 'version': '0.29.3'}))
            (cache / 'bad.whl').write_bytes(b'changed data')
            entry = {'depends': [], 'file_name': 'bad.whl', 'sha256': '0' * 64}
            (cache / 'pyodide-lock.json').write_text(json.dumps({'packages': {name: entry for name in builder.PACKAGES}}))
            output = cache / 'output'
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                builder.build(output, cache)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()

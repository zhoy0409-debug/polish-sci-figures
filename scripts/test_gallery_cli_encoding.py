"""Exercise the real CLI under GBK pipes, plus palette argument forwarding."""
from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / 'skills/make-sci-data-figures/scripts/gallery_cli.py'


class GalleryCliTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_root = ROOT / '.cache/gallery-cli-tests'
        cls.temp_root.mkdir(parents=True, exist_ok=True)

    def run_cli(self, *args):
        env = dict(os.environ, PYTHONUTF8='0', PYTHONIOENCODING='gbk')
        result = subprocess.run([sys.executable, str(CLI), *map(str, args)],
                                cwd=ROOT, env=env, capture_output=True, timeout=60)
        # Decode strictly: replacing unsupported symbols would hide this failure.
        return result.returncode, result.stdout.decode('utf-8'), result.stderr.decode('utf-8')

    def test_bilingual_list_survives_gbk_default(self):
        status, stdout, stderr = self.run_cli('--list')
        self.assertEqual(status, 0, stderr)
        payload = json.loads(stdout)
        self.assertIn('compare_raincloud', payload)
        self.assertEqual(payload['compare_raincloud']['zh'], '半小提琴、箱线与原始点')
        self.assertIn('₂', stdout)
        self.assertNotIn('UnicodeEncodeError', stderr)

    def test_argparse_error_survives_gbk_default(self):
        status, _, stderr = self.run_cli('--view', '不存在的图形₂')
        self.assertEqual(status, 2)
        self.assertIn('不存在的图形₂', stderr)
        self.assertNotIn('UnicodeEncodeError', stderr)

    def test_unknown_palette_reuses_registry_validation(self):
        with tempfile.TemporaryDirectory(dir=self.temp_root) as directory:
            root = Path(directory)
            source = root / 'data.csv'
            source.write_text('x,y\n1,2\n', encoding='utf-8')
            status, _, stderr = self.run_cli('--view', 'compare_raincloud',
                '--input', source, '--out', root / 'output', '--palette', '不存在₂')
            self.assertEqual(status, 2)
            self.assertIn("Unknown palette '不存在₂'", stderr)
            self.assertNotIn('Traceback', stderr)
            self.assertFalse((root / 'output').exists())

    def test_palette_forwarding_preserves_default(self):
        calls = []
        fake = types.ModuleType('gallery_registry')
        fake.CONTRACTS = {'example': ('示例', 'Example', 'distribution', 'value', 'value')}
        fake.NOTES = {'example': ('示例', 'Example')}
        fake.generate = lambda *args, **kwargs: calls.append((args, kwargs)) or []
        spec = importlib.util.spec_from_file_location('gallery_cli_encoding_test', CLI)
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {'gallery_registry': fake}), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            spec.loader.exec_module(module)
            with tempfile.TemporaryDirectory(dir=self.temp_root) as directory:
                base = [str(CLI), '--view', 'example', '--input', 'data.csv', '--out', str(Path(directory) / 'output')]
                with patch.object(sys, 'argv', base):
                    module.main()
                with patch.object(sys, 'argv', [*base, '--palette', 'grayscale']):
                    module.main()
        self.assertEqual([call[1]['palette'] for call in calls], ['zhoy_muted', 'grayscale'])
        self.assertEqual([call[1]['font'] for call in calls], ['Arial', 'Arial'])

    def test_named_palette_changes_color_without_changing_plot_geometry(self):
        with tempfile.TemporaryDirectory(dir=self.temp_root) as directory:
            root = Path(directory)
            source = root / 'synthetic.csv'
            # Explicit synthetic supplied results exercise plotting, not inference.
            source.write_text('group,unit,value,reference,p,method\n'
                'A,A1,1,A,1,synthetic supplied comparison\n'
                'A,A2,2,A,1,synthetic supplied comparison\n'
                'A,A3,3,A,1,synthetic supplied comparison\n'
                'B,B1,2,A,0.04,synthetic supplied comparison\n'
                'B,B2,3,A,0.04,synthetic supplied comparison\n'
                'B,B3,4,A,0.04,synthetic supplied comparison\n', encoding='utf-8')
            outputs = []
            for folder, extra in [('default', []), ('custom', ['--palette', 'journal_blue_red'])]:
                destination = root / folder
                status, _, stderr = self.run_cli('--view', 'compare_bracket_p',
                    '--input', source, '--out', destination, '--font', 'DejaVu Sans', *extra)
                self.assertEqual(status, 0, stderr)
                outputs.append((destination / 'compare_bracket_p.svg').read_text(encoding='utf-8'))
            for color in ['#3f6da3', '#c95770']:
                self.assertIn(color, outputs[0])
            for color in ['#2e6f9e', '#c4473a']:
                self.assertIn(color, outputs[1])
            geometry = lambda svg: [(node.tag, node.get('d'), node.get('x'), node.get('y'),
                ''.join(node.itertext()) if node.tag.endswith('text') else None)
                for node in ET.fromstring(svg).iter() if node.tag.rsplit('}', 1)[-1] in {'path', 'text', 'use'}]
            self.assertEqual(geometry(outputs[0]), geometry(outputs[1]))
            recipe = json.loads((root / 'custom/figure_recipe.json').read_text(encoding='utf-8'))
            self.assertEqual(recipe['palette'], 'journal_blue_red')


if __name__ == '__main__':
    unittest.main()

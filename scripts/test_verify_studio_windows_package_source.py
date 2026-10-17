"""Pure QA contract tests; no package, EXE, registry or browser is accessed.

Controlled compiled-record maps test the verifier's release-boundary logic.
They do not substitute for actual artifact code-object comparisons.
"""
from pathlib import Path
import copy
import hashlib
import unittest

from verify_studio_windows_package_source import (
    BACKEND_PREFIX, NOT_PACKAGED_BACKEND_TESTS, backend_package_boundary,
    source_stage_identity,
)


ROOT = Path(__file__).resolve().parents[1]


class BackendPackageBoundaryTests(unittest.TestCase):
    def setUp(self):
        folder = ROOT / 'skills/polish-sci-figures/scripts'
        self.freeze = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.glob('*.py')}
        self.production = set(self.freeze) - NOT_PACKAGED_BACKEND_TESTS
        self.allow = {BACKEND_PREFIX + name for name in self.production}
        self.compiled = {BACKEND_PREFIX + name: {'sourceSha256': self.freeze[name], 'compiledCodeEqual': True}
                         for name in self.production}
        self.dynamic = BACKEND_PREFIX + 'studio_render_statistics.py'

    def test_all_sources_and_only_production_objects_are_distinguished(self):
        result = backend_package_boundary(self.freeze, self.compiled, self.allow)
        self.assertEqual(result['count'], 27)
        self.assertEqual(result['packagedProductionCount'], 23)
        self.assertEqual(len(result['notPackagedTests']), 4)
        self.assertEqual({v['file'] for v in result['notPackagedTests']}, NOT_PACKAGED_BACKEND_TESTS)
        self.assertEqual(len(result['files']), 27)
        self.assertEqual(sum(v['packaged'] for v in result['files']), 23)
        self.assertEqual({v['file']: v['sha256'] for v in result['files']}, self.freeze)
        self.assertTrue(all(v['compiledCodeObjectVerified'] is v['packaged'] for v in result['files']))
        self.assertNotIn('allPackagedCodeObjectsVerified', result)

    def test_missing_dynamic_production_module_is_rejected(self):
        del self.compiled[self.dynamic]
        with self.assertRaisesRegex(ValueError, 'production backend code'):
            backend_package_boundary(self.freeze, self.compiled, self.allow)

    def test_wrong_production_source_hash_is_rejected(self):
        self.compiled[self.dynamic]['sourceSha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'production backend code'):
            backend_package_boundary(self.freeze, self.compiled, self.allow)

    def test_unverified_production_code_object_is_rejected(self):
        self.compiled[self.dynamic]['compiledCodeEqual'] = False
        with self.assertRaisesRegex(ValueError, 'production backend code'):
            backend_package_boundary(self.freeze, self.compiled, self.allow)

    def test_missing_production_release_member_is_rejected(self):
        self.allow.remove(self.dynamic)
        with self.assertRaisesRegex(ValueError, 'release allowlist'):
            backend_package_boundary(self.freeze, self.compiled, self.allow)

    def test_declared_non_packaged_test_object_is_rejected(self):
        name = 'test_figure_studio.py'
        self.compiled[BACKEND_PREFIX + name] = {'sourceSha256': self.freeze[name], 'compiledCodeEqual': True}
        with self.assertRaisesRegex(ValueError, 'unexpectedly packaged'):
            backend_package_boundary(self.freeze, self.compiled, self.allow)

    def test_declared_non_packaged_test_allowlisting_is_rejected(self):
        self.allow.add(BACKEND_PREFIX + 'test_figure_studio.py')
        with self.assertRaisesRegex(ValueError, 'unexpectedly packaged'):
            backend_package_boundary(self.freeze, self.compiled, self.allow)

    def test_unreviewed_test_exclusion_is_rejected(self):
        value = copy.copy(self.freeze)
        value['test_new_unreviewed.py'] = value.pop('test_font_policy.py')
        with self.assertRaisesRegex(ValueError, 'test-source boundary'):
            backend_package_boundary(value, self.compiled, self.allow)

    def test_incomplete_freeze_is_rejected(self):
        value = copy.copy(self.freeze)
        value.pop('test_font_policy.py')
        with self.assertRaisesRegex(ValueError, '27 backend sources'):
            backend_package_boundary(value, self.compiled, self.allow)

    def test_old_stage_identity_and_bounded_new_stage(self):
        self.assertEqual(source_stage_identity('source09'), 'STAGE09_RUNTIME_AND_PORTABLE_MATCH')
        self.assertEqual(source_stage_identity('source17'), 'STAGE17_RUNTIME_AND_PORTABLE_MATCH')
        for invalid in (None, 'source17/../../private', 'source17 final', 'source1000', 'https://token'):
            with self.subTest(value=invalid), self.assertRaises(ValueError):
                source_stage_identity(invalid)


if __name__ == '__main__':
    unittest.main(verbosity=2)

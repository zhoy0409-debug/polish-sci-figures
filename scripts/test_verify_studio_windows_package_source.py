"""Pure QA contract tests; no package, EXE, registry or browser is accessed.

Controlled compiled-record maps test the verifier's release-boundary logic.
They do not substitute for actual artifact code-object comparisons.
"""
from pathlib import Path
import copy
import hashlib
import json
import unittest

from verify_studio_windows_package_source import (
    BACKEND_PREFIX, NOT_PACKAGED_BACKEND_TESTS, backend_package_boundary,
    source_stage_identity, approved_ui_freeze, application_build_identity,
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
        self.assertEqual(result['count'], 28)
        self.assertEqual(result['packagedProductionCount'], 24)
        self.assertEqual(len(result['notPackagedTests']), 4)
        self.assertEqual({v['file'] for v in result['notPackagedTests']}, NOT_PACKAGED_BACKEND_TESTS)
        self.assertEqual(len(result['files']), 28)
        self.assertEqual(sum(v['packaged'] for v in result['files']), 24)
        self.assertEqual({v['file']: v['sha256'] for v in result['files']}, self.freeze)
        self.assertTrue(all(v['compiledCodeObjectVerified'] is v['packaged'] for v in result['files']))
        self.assertNotIn('allPackagedCodeObjectsVerified', result)

    def test_missing_dynamic_production_module_is_rejected(self):
        del self.compiled[self.dynamic]
        with self.assertRaisesRegex(ValueError, 'production backend code'):
            backend_package_boundary(self.freeze, self.compiled, self.allow)

    def test_native_tiff_backend_is_required_and_verified(self):
        relative = BACKEND_PREFIX + 'studio_tiff.py'
        self.assertIn('studio_tiff.py', self.freeze)
        self.assertIn(relative, self.allow)
        del self.compiled[relative]
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
        with self.assertRaisesRegex(ValueError, '28 backend sources'):
            backend_package_boundary(value, self.compiled, self.allow)

    def test_old_stage_identity_and_bounded_new_stage(self):
        self.assertEqual(source_stage_identity('source09'), 'STAGE09_RUNTIME_AND_PORTABLE_MATCH')
        self.assertEqual(source_stage_identity('source17'), 'STAGE17_RUNTIME_AND_PORTABLE_MATCH')
        for invalid in (None, 'source17/../../private', 'source17 final', 'source1000', 'https://token'):
            with self.subTest(value=invalid), self.assertRaises(ValueError):
                source_stage_identity(invalid)


class ApprovedUiFreezeTests(unittest.TestCase):
    def manifest(self, count):
        value = {'assets': {f'asset-{i}.js': hashlib.sha256(str(i).encode()).hexdigest() for i in range(count)}}
        raw = json.dumps(value).encode()
        return value, raw, hashlib.sha256(raw).hexdigest()

    def test_old_and_expanded_ui_counts_need_their_own_exact_approval(self):
        for count in (78, 79, 80, 82):
            with self.subTest(count=count):
                value, raw, sha = self.manifest(count)
                self.assertEqual(approved_ui_freeze(raw, sha, count), value)

    def test_asset_count_is_exact_not_a_minimum(self):
        _, raw, sha = self.manifest(79)
        for count in (78, 80):
            with self.subTest(count=count), self.assertRaisesRegex(ValueError, 'exact count'):
                approved_ui_freeze(raw, sha, count)

    def test_missing_wrong_or_changed_manifest_hash_is_rejected(self):
        _, raw, sha = self.manifest(78)
        for wrong in (None, '0' * 64, 'not-a-hash'):
            with self.subTest(sha=wrong), self.assertRaises(ValueError):
                approved_ui_freeze(raw, wrong, 78)
        with self.assertRaisesRegex(ValueError, 'Freeze bytes differ'):
            approved_ui_freeze(raw + b'\n', sha, 78)

    def test_no_implicit_or_boolean_count_approval(self):
        _, raw, sha = self.manifest(78)
        for wrong in (None, True, '78', 0, 513):
            with self.subTest(count=wrong), self.assertRaises(ValueError):
                approved_ui_freeze(raw, sha, wrong)

    def test_invalid_or_case_duplicate_relative_names_are_rejected(self):
        for keys in ({'../private.js': '0' * 64}, {'C:/private.js': '0' * 64},
                     {'nested\\bad.js': '0' * 64}, {'A.js': '0' * 64, 'a.js': '0' * 64}):
            raw = json.dumps({'assets': keys}).encode()
            with self.subTest(keys=list(keys)), self.assertRaises(ValueError):
                approved_ui_freeze(raw, hashlib.sha256(raw).hexdigest(), len(keys))


class ApplicationBuildIdentityTests(unittest.TestCase):
    def test_current_version_is_required_without_retaining_an_old_release_constant(self):
        application_build_identity({'version': '0.1.23', 'platform': 'windows-x86_64'}, '0.1.23')
        with self.assertRaisesRegex(ValueError, 'build identity'):
            application_build_identity({'version': '0.1.22', 'platform': 'windows-x86_64'}, '0.1.23')
        # The version input follows the actual build module; a future bump must
        # still reject the previous app, rather than disable the identity check.
        with self.assertRaisesRegex(ValueError, 'build identity'):
            application_build_identity({'version': '0.1.23', 'platform': 'windows-x86_64'}, '0.1.24')

    def test_wrong_platform_missing_identity_or_invalid_expected_version_is_rejected(self):
        for build in ({'version': '0.1.23', 'platform': 'macos-arm64'},
                      {'version': '0.1.23'}, {}, None):
            with self.subTest(build=build), self.assertRaisesRegex(ValueError, 'build identity'):
                application_build_identity(build, '0.1.23')
        for version in (None, '', 'v0.1.23', '0.1.23/../private'):
            with self.subTest(version=version), self.assertRaisesRegex(ValueError, 'current Windows build version'):
                application_build_identity({'version': '0.1.23', 'platform': 'windows-x86_64'}, version)


if __name__ == '__main__':
    unittest.main(verbosity=2)

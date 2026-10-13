"""Portable unit checks for the macOS build; not a native Mac runtime test."""
from __future__ import annotations

from pathlib import Path
import json
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'desktop'))
import build_macos as build
import figure_studio_app as app


class MacPreviewTests(unittest.TestCase):
    def setUp(self):
        cache = ROOT / '.cache' / 'desktop-macos-tests'
        cache.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=cache)
        self.root = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def test_native_build_guard(self):
        with mock.patch.object(build.sys, 'platform', 'win32'):
            with self.assertRaisesRegex(RuntimeError, 'native macOS'):
                build.native_arch('arm64')
        with mock.patch.object(build.sys, 'platform', 'darwin'), mock.patch.object(build.platform, 'machine', return_value='arm64'), mock.patch.object(build.sys, 'version_info', (3, 12, 15)):
            self.assertEqual(build.native_arch('arm64'), 'arm64')
            with self.assertRaisesRegex(RuntimeError, 'running as arm64'):
                build.native_arch('x86_64')

    def test_reset_is_confined_to_generated_child(self):
        stage = self.root / 'stage'
        stage.mkdir()
        (stage / 'old').write_text('old')
        build.reset_generated(stage, self.root)
        self.assertFalse((stage / 'old').exists())
        for unsafe in (self.root, self.root.parent):
            with self.assertRaises(ValueError):
                build.reset_generated(unsafe, self.root)

    def test_build_paths_must_resolve_inside_repository(self):
        repository = self.root / 'repository'
        repository.mkdir()
        with mock.patch.object(build, 'ROOT', repository):
            self.assertEqual(build.repo_build_path(repository / '.cache/mac'), repository / '.cache/mac')
            with self.assertRaisesRegex(ValueError, 'escapes the repository'):
                build.repo_build_path(self.root / 'other')
            try:
                (repository / '.cache').symlink_to(self.root, target_is_directory=True)
            except OSError:
                return  # Creating symlinks needs additional privileges on Windows.
            with self.assertRaisesRegex(ValueError, 'escapes the repository'):
                build.repo_build_path(repository / '.cache/mac')

    def test_relative_native_dependencies_exist_within_bundle(self):
        bundle = self.root / 'app'
        executable = bundle / 'Contents/MacOS/Figure Studio'
        binary = bundle / 'Contents/Frameworks/module.so'
        library = binary.with_name('native.dylib')
        library.parent.mkdir(parents=True)
        library.write_bytes(b'native')
        for location in ('@loader_path/native.dylib', '@rpath/native.dylib', '@executable_path/../Frameworks/native.dylib'):
            self.assertTrue(build.dependency_is_bundled(location, binary, bundle, executable, [library.parent]))
        self.assertFalse(build.dependency_is_bundled('@rpath/missing.dylib', binary, bundle, executable, [library.parent]))
        self.assertFalse(build.dependency_is_bundled('@loader_path/../../../outside.dylib', binary, bundle, executable, []))
        with mock.patch.object(build, 'run', return_value='cmd LC_RPATH\npath @loader_path (offset 12)\ncmd LC_RPATH\npath @executable_path/../Frameworks (offset 12)'):
            self.assertEqual(build.load_rpaths(binary, 'arm64', executable), [binary.parent, executable.parent / '../Frameworks'])

    def test_self_test_gate_requires_success_from_frozen_runtime(self):
        with self.assertRaisesRegex(RuntimeError, 'did not write'):
            build.frozen_proof(self.root)
        for report in ({'passed': False, 'frozen': True}, {'passed': True, 'frozen': False}, {}):
            (self.root / 'self-test.json').write_text(json.dumps(report))
            with self.assertRaisesRegex(RuntimeError, 'passing frozen runtime'):
                build.frozen_proof(self.root)
        (self.root / 'self-test.json').write_text(json.dumps({'passed': True, 'frozen': True}))
        self.assertTrue(build.frozen_proof(self.root)['passed'])

    def test_brand_resources_are_generated_in_isolated_stage(self):
        from PIL import Image
        resources = self.root / 'icons'
        build.branding(resources)
        with Image.open(resources / 'figure-studio.icns') as icon:
            self.assertEqual(icon.size, (1024, 1024))
        with Image.open(resources / 'figure-studio.png') as icon:
            self.assertEqual(icon.size, (256, 256))
        self.assertFalse((resources / 'version-info.txt').exists())

    def test_native_audit_blocks_external_library_and_wrong_arch(self):
        bundle = self.root / 'app'
        bundle.mkdir()
        binary = bundle / 'test.dylib'
        binary.write_bytes(b'\xcf\xfa\xed\xfe' + b'\0' * 16)
        def commands(args):
            if args[0].endswith('lipo'):
                return 'arm64'
            if '-D' in args:
                return 'test.dylib:\n@rpath/test.dylib'
            if '-L' in args:
                return 'test.dylib:\n\t@rpath/test.dylib (version 1)\n\t/usr/lib/libSystem.B.dylib (version 1)'
            return ''
        with mock.patch.object(build, 'run', side_effect=commands):
            self.assertEqual(build.audit_bundle(bundle, 'arm64'), ['test.dylib'])
            with self.assertRaisesRegex(RuntimeError, 'Wrong native architecture'):
                build.audit_bundle(bundle, 'x86_64')
        with mock.patch.object(build, 'run', side_effect=lambda args: commands(args).replace('/usr/lib/libSystem.B.dylib', '/opt/homebrew/lib/unbundled.dylib')):
            with self.assertRaisesRegex(RuntimeError, 'Unbundled native dependency'):
                build.audit_bundle(bundle, 'arm64')

    def test_license_collection_requires_python_and_tk(self):
        (self.root / 'LICENSE.txt').write_text('Python')
        library = self.root / 'tk/lib/tk9.0'
        library.mkdir(parents=True)
        (self.root / 'tk/license.terms').write_text('Tk')
        python_license, tk_licenses = build.find_runtime_licenses(self.root, self.root / 'stdlib', [library])
        self.assertEqual(python_license, self.root / 'LICENSE.txt')
        self.assertIn(self.root / 'tk/license.terms', tk_licenses)
        (self.root / 'tk/license.terms').unlink()
        with self.assertRaisesRegex(RuntimeError, 'Tcl/Tk license'):
            build.find_runtime_licenses(self.root, self.root / 'stdlib', [library])
        with self.assertRaisesRegex(RuntimeError, 'CPython license'):
            build.find_runtime_licenses(self.root / 'absent', self.root / 'absent', [library])

    def test_homebrew_dependencies_keep_their_native_notices(self):
        formulas = ('python@3.12', 'python-tk@3.12', 'openssl@3', 'sqlite')
        for name in formulas:
            folder = self.root / name
            folder.mkdir()
            if name != 'sqlite':
                (folder / 'LICENSE.txt').write_text(name)
            (folder / 'INSTALL_RECEIPT.json').write_text('{}')
        def brew(args):
            return 'openssl@3\nca-certificates\nsqlite' if 'deps' in args else str(self.root / args[-1])
        target = self.root / 'notices'
        with mock.patch.object(build.shutil, 'which', return_value='/brew'), mock.patch.object(build, 'run', side_effect=brew):
            result = build.homebrew_notices(target)
            self.assertEqual(result['packages'], sorted(formulas))
            self.assertIn('not included', result['excluded']['ca-certificates'])
            self.assertFalse((target / 'Homebrew/ca-certificates').exists())
            for name in formulas:
                notice = 'PUBLIC-DOMAIN.txt' if name == 'sqlite' else 'LICENSE.txt'
                self.assertTrue((target / 'Homebrew' / name / notice).is_file())
            self.assertIn('https://sqlite.org/copyright.html', (target / 'Homebrew/sqlite/PUBLIC-DOMAIN.txt').read_text())
            (self.root / 'openssl@3/LICENSE.txt').unlink()
            with self.assertRaisesRegex(RuntimeError, 'openssl@3'):
                build.homebrew_notices(target)

    def test_mac_path_ignores_windows_environment(self):
        with mock.patch.object(app.sys, 'platform', 'darwin'), mock.patch.object(app.Path, 'home', return_value=self.root), mock.patch.dict(app.os.environ, {'LOCALAPPDATA': str(self.root / 'windows')}):
            self.assertEqual(app.default_data_dir(), self.root / 'Library/Application Support/Figure Studio')

    def test_mac_icon_uses_png_and_retains_photo(self):
        icon = self.root / app.WINDOW_ICON.with_suffix('.png')
        icon.parent.mkdir(parents=True)
        icon.write_bytes(b'test photo passed to mock')
        window, photo = mock.Mock(), mock.Mock()
        with mock.patch.object(app.sys, 'platform', 'darwin'), mock.patch('tkinter.PhotoImage', return_value=photo) as loader:
            self.assertTrue(app.apply_window_icon(window, self.root))
            loader.assert_called_once_with(master=window, file=str(icon))
            window.iconphoto.assert_called_once_with(True, photo)
            window.iconbitmap.assert_not_called()
            self.assertIs(window._studio_icon, photo)


if __name__ == '__main__':
    unittest.main()

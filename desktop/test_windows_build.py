"""Build-process isolation only; this does not install or run a GUI."""
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from unittest.mock import Mock

import build_windows as build


class BuildEnvironmentTests(unittest.TestCase):
    def test_scoped_environment_does_not_change_user_settings(self):
        with patch.dict(os.environ, {'PYTHONPATH': 'unrelated-user-package-path',
                                     'PYTHONUSERBASE': 'user-setting'}):
            env = build.build_environment()
            self.assertNotIn('PYTHONPATH', env)
            self.assertEqual(env['PYTHONUTF8'], '1')
            self.assertEqual(env['PYTHONIOENCODING'], 'utf-8')
            self.assertEqual(env['PYTHONNOUSERSITE'], '1')
            self.assertEqual(Path(env['PYTHONUSERBASE']).parent, build.WORK)
            self.assertEqual(Path(env['PYINSTALLER_CONFIG_DIR']).parent, build.WORK)
            self.assertEqual(os.environ['PYTHONUSERBASE'], 'user-setting')
            self.assertEqual(os.environ['PYTHONPATH'], 'unrelated-user-package-path')

    def test_python_child_uses_utf8_without_changing_native_command(self):
        with patch.object(build.subprocess, 'run') as run:
            build.run([sys.executable, '-m', 'module'])
            self.assertEqual(run.call_args.args[0][:4], [sys.executable, '-X', 'utf8', '-m'])
            build.run(['ISCC.exe', 'installer.iss'])
            self.assertEqual(run.call_args.args[0], ['ISCC.exe', 'installer.iss'])

    def test_missing_native_module_fails_before_freezing(self):
        with patch.object(build, 'import_module', side_effect=ImportError('missing')):
            with self.assertRaisesRegex(SystemExit, 'complete CPython with Tcl/Tk'):
                build.verify_build_runtime()

    def test_importable_but_unusable_tcl_fails_before_freezing(self):
        module = Mock()
        module.Tcl.side_effect = RuntimeError('native files unavailable')
        with patch.object(build, 'import_module', return_value=module):
            with self.assertRaisesRegex(SystemExit, 'Tcl/Tk initialization failed'):
                build.verify_build_runtime()


if __name__ == '__main__':
    unittest.main()

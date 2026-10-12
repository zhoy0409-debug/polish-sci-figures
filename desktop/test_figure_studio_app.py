"""Launcher lifecycle and real HTTP authorization tests (no windows/browser)."""
from __future__ import annotations

import json
from pathlib import Path
import socket
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'desktop'))
import figure_studio_app as app


class LauncherTests(unittest.TestCase):
    def setUp(self):
        cache = ROOT / '.cache' / 'desktop-launcher-tests'
        cache.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=cache)
        self.root = Path(self.temporary.name)
        self.page = self.root / 'test.html'
        self.page.write_text('<html><head></head><body><script id="project" type="application/json">{}</script></body></html>', encoding='utf-8')
        self.services = []

    def tearDown(self):
        for service in reversed(self.services):
            service.close()
        self.temporary.cleanup()

    def start(self, data_dir=None):
        with mock.patch.object(app, 'prepare_workspace', return_value=self.page):
            service = app.start_service(data_dir or self.root / 'data', ROOT, preferred_port=0)
        if isinstance(service, app.RunningService):
            self.services.append(service)
        return service

    def test_packaged_resources_and_default_path(self):
        self.assertEqual(app.resource_root(), ROOT)
        with mock.patch.object(sys, 'frozen', True, create=True), mock.patch.object(sys, '_MEIPASS', str(self.root), create=True):
            self.assertEqual(app.resource_root(), self.root / 'suite')
        with mock.patch.dict(app.os.environ, {'LOCALAPPDATA': str(self.root)}):
            self.assertEqual(app.default_data_dir(), self.root / 'Figure Studio')

    def test_numeric_threads_default_and_explicit_configuration(self):
        before = dict(app.os.environ)
        with mock.patch.dict(app.os.environ, {'BENCHMARK_SENTINEL': 'untouched'}, clear=True):
            app.configure_numeric_threads()
            self.assertEqual({name: app.os.environ[name] for name in app.NUMERIC_THREAD_ENV},
                             {name: '1' for name in app.NUMERIC_THREAD_ENV})
            self.assertEqual(app.os.environ['BENCHMARK_SENTINEL'], 'untouched')
        with mock.patch.dict(app.os.environ, {'OPENBLAS_NUM_THREADS': '4',
                                             'OMP_NUM_THREADS': '2'}, clear=True):
            app.configure_numeric_threads()
            self.assertEqual(app.os.environ['OPENBLAS_NUM_THREADS'], '4')
            self.assertEqual(app.os.environ['OMP_NUM_THREADS'], '2')
            self.assertEqual(app.os.environ['MKL_NUM_THREADS'], '1')
            self.assertEqual(app.os.environ['NUMEXPR_NUM_THREADS'], '1')
        self.assertEqual(dict(app.os.environ), before)

    def test_official_brand_resources_and_explicit_project_action(self):
        window = mock.Mock()
        with mock.patch.object(app.webbrowser, 'open', return_value=True) as browser:
            self.assertTrue(app.apply_window_icon(window, ROOT))
            window.iconbitmap.assert_called_once_with(default=str(ROOT / app.WINDOW_ICON))
            browser.assert_not_called()
            app.open_official_project()
            browser.assert_called_once_with(
                'https://github.com/zhoy0409-debug/polish-sci-figures', new=2)
        self.assertEqual(app.WINDOW_TITLE, 'Figure Studio · polish-sci-figures')
        self.assertFalse(app.apply_window_icon(mock.Mock(), self.root / 'missing'))

    def test_workspace_updates_managed_shell_not_user_replacement(self):
        bundle = self.root / 'bundle'
        source = bundle / app.STARTER
        source.parent.mkdir(parents=True)
        source.write_bytes(self.page.read_bytes())
        data = self.root / 'workspace-data'
        page = app.prepare_workspace(data, bundle)
        self.assertEqual(page.read_bytes(), source.read_bytes())
        self.assertEqual(app.prepare_workspace(data, bundle), page)
        source.write_text(source.read_text() + '<!-- updated application shell -->', encoding='utf-8')
        app.prepare_workspace(data, bundle)
        self.assertEqual(page.read_bytes(), source.read_bytes())
        page.write_text('user-replaced-page', encoding='utf-8')
        app.prepare_workspace(data, bundle)
        self.assertEqual(page.read_text(), 'user-replaced-page')
        with self.assertRaises(app.LaunchError):
            app.prepare_workspace(data, self.root / 'missing')

    def test_os_lock_release_and_startup_failure_release(self):
        first = app.InstanceLock(self.root / 'lock')
        second = app.InstanceLock(self.root / 'lock')
        self.assertTrue(first.acquire())
        self.assertFalse(second.acquire())
        first.release()
        first.release()
        self.assertTrue(second.acquire())
        second.release()
        data = self.root / 'invalid-starter'
        with self.assertRaises(app.LaunchError):
            app.start_service(data, self.root / 'missing')
        retry = app.InstanceLock(data / 'instance.lock')
        self.assertTrue(retry.acquire())
        retry.release()

    def test_local_service_security_and_duplicate_start(self):
        data = self.root / 'data'
        first = self.start(data)
        self.assertEqual(first.server.server_address[0], '127.0.0.1')
        status, page = app.http_request(first.port)
        self.assertEqual(status, 200)
        self.assertIn(b'id="local-engine"', page)
        self.assertIn(first.server.token.encode(), page)
        record = app.read_json(data / 'instance.json')
        self.assertTrue(app.probe_instance(record))
        self.assertFalse(app.probe_instance({**record, 'instance_id': 'x' * 32}))
        self.assertEqual(app.http_request(first.port, '/api/desktop/health')[0], 403)
        self.assertEqual(app.http_request(first.port, '/', headers={'Host': 'evil.invalid'})[0], 403)
        self.assertEqual(app.http_request(first.port, '/api/analyze', {})[0], 403)
        self.assertEqual(app.http_request(first.port, '/api/render', {}, first.server.token,
                                         headers={'Origin': 'http://evil.invalid'})[0], 403)
        # The original Handler's schema validation remains in force.
        self.assertEqual(app.http_request(first.port, '/api/analyze', {}, first.server.token)[0], 422)
        second = self.start(data)
        self.assertIsInstance(second, app.ExistingInstance)
        self.assertEqual(second.url, first.url)
        self.assertTrue(first.thread.is_alive())
        first.close()
        self.assertFalse((data / 'instance.json').exists())
        self.assertFalse(app.probe_instance(record))

    def test_stable_origin_restart_and_conflict(self):
        data = self.root / 'data'
        first = self.start(data)
        port = first.port
        first.close()
        second = self.start(data)
        self.assertEqual(second.port, port)
        second.close()
        with socket.socket() as blocker:
            blocker.bind(('127.0.0.1', port))
            blocker.listen()
            with self.assertRaisesRegex(app.LaunchError, 'preserved'):
                self.start(data)
            self.assertEqual(app.read_json(data / 'settings.json')['port'], port)
        third = self.start(data)
        self.assertEqual(third.port, port)

    def test_corrupt_saved_origin_is_not_silently_replaced(self):
        data = self.root / 'data'
        data.mkdir()
        (data / 'settings.json').write_text('{broken-json', encoding='utf-8')
        with self.assertRaisesRegex(app.LaunchError, 'saved local port'):
            self.start(data)
        self.assertEqual((data / 'settings.json').read_text(), '{broken-json')


if __name__ == '__main__':
    unittest.main()

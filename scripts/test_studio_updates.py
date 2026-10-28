"""Update eligibility, offline cache and authenticated local transport regressions."""
import copy
import http.client
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/polish-sci-figures/scripts'))
import studio_updates as updates


def current(platform='windows', architecture='x86_64', channel='stable', version='0.1.6'):
    return {'currentVersion': version, 'suiteVersion': '1.4.6', 'platform': platform,
            'architecture': architecture, 'channel': channel}


def release(version='0.1.7', suffix='Setup-x64.exe', tag='v1.4.7', preview=False):
    name = f'polish-sci-figures-Studio-{version}-{suffix}'
    return {'draft': False, 'prerelease': preview, 'published_at': '2026-10-15T12:00:00Z',
            'tag_name': tag, 'html_url': updates.RELEASES_URL + '/tag/' + tag,
            'assets': [{'name': name, 'state': 'uploaded', 'size': 123456,
                        'browser_download_url': updates.RELEASES_URL + '/download/' + tag + '/' + name}]}


class UpdateTests(unittest.TestCase):
    def test_next_minor_windows_version_independent_of_suite_tag(self):
        target = release('0.2.0', tag='v1.5.0')
        result = updates.choose_release([target], current(version='0.1.26'))
        self.assertEqual(result['latestVersion'], '0.2.0')
        self.assertEqual(result['releaseTag'], 'v1.5.0')
        self.assertEqual(result['status'], 'update-available')
        self.assertEqual(updates.choose_release([target], current(version='0.2.0'))['status'], 'up-to-date')
        old = release('0.1.26', tag='v1.4.26')
        self.assertEqual(updates.choose_release([old], current(version='0.2.0'))['status'], 'up-to-date')

    def test_numeric_studio_version_independent_of_suite(self):
        result = updates.choose_release([release('0.1.9'), release('0.1.10')], current(version='0.1.9'))
        self.assertEqual(result['latestVersion'], '0.1.10')
        self.assertEqual(result['status'], 'update-available')
        self.assertEqual(updates.choose_release([release('0.1.6', tag='v9.8.7')], current())['status'], 'up-to-date')
        self.assertEqual(updates.choose_release([release('0.1.5')], current())['status'], 'up-to-date')
        for value in ('v0.1.6', '0.1', '0.1.6-rc1', '0.01.6', '0.1.100000', None):
            with self.assertRaises(ValueError): updates.version_tuple(value)

    def test_stable_does_not_offer_preview_or_draft(self):
        stable, preview, draft = release(), release('0.1.9', preview=True), release('0.1.10')
        draft['draft'] = True
        self.assertEqual(updates.choose_release([preview, draft, stable], current())['latestVersion'], '0.1.7')
        self.assertEqual(updates.choose_release([preview], current())['status'], 'unavailable')
        mac = release('0.1.9', 'macOS-arm64-Preview.zip', preview=False)
        self.assertEqual(updates.choose_release([mac], current('macos', 'arm64'))['status'], 'unavailable')

    def test_exact_platform_arch_and_real_installer(self):
        releases = [release('0.1.8', 'macOS-arm64-Preview.zip', preview=True), release('0.1.7', 'macOS-x86_64-Preview.zip', preview=True), release('0.1.9', 'Android-preview.apk', preview=True), release()]
        self.assertIn('-macOS-arm64-', updates.choose_release(releases, current('macos', 'arm64', 'preview'))['assetName'])
        self.assertEqual(updates.choose_release(releases, current('macos', 'x86_64', 'preview'))['latestVersion'], '0.1.7')
        self.assertEqual(updates.choose_release(releases, current('android', 'arm64', 'preview'))['latestVersion'], '0.1.9')
        self.assertEqual(updates.choose_release(releases, current('windows', 'arm64'))['status'], 'unavailable')
        self.assertEqual(updates.choose_release(releases, current('ios', 'arm64', 'preview'))['status'], 'unavailable')
        portable = release(suffix='Portable-x64.zip')
        self.assertEqual(updates.choose_release([portable], current())['status'], 'unavailable')

    def test_remote_and_ambiguous_urls_never_become_downloads(self):
        mutations = [lambda r: r.update(html_url='https://evil.invalid/releases'),
                     lambda r: r.update(tag_name='../escape'),
                     lambda r: r.update(published_at='not a date'),
                     lambda r: r['assets'][0].update(browser_download_url='https://github.com.evil.invalid/a'),
                     lambda r: r['assets'][0].update(browser_download_url=r['assets'][0]['browser_download_url']+'?redirect=evil'),
                     lambda r: r['assets'][0].update(browser_download_url=r['assets'][0]['browser_download_url'].replace('/v1.4.7/', '/other/')),
                     lambda r: r['assets'][0].update(state='new'), lambda r: r['assets'][0].update(size=True)]
        for mutate in mutations:
            data = release(); mutate(data)
            self.assertEqual(updates.choose_release([data], current())['status'], 'unavailable')

    def test_package_identity_uses_build_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root/'build-info.json').write_text(json.dumps({'version':'0.1.8','suiteVersion':'v1.4.8','platform':'macos-arm64','distribution':'ci-preview'}))
            result = updates.installation_info(root, system='Windows', machine='AMD64')
            self.assertEqual(result, current('macos','arm64','preview','0.1.8') | {'suiteVersion':'1.4.8'})

    def test_cache_24h_manual_refresh_and_restart(self):
        now, calls = [1000], []
        def fetch(): calls.append(True); return [release()]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'updates.json'
            checker = updates.UpdateChecker(current(), path, fetcher=fetch, clock=lambda:now[0])
            self.assertFalse(checker.check()['cached'])
            now[0] += 100
            self.assertTrue(checker.check()['cached']); self.assertEqual(len(calls),1)
            restored = updates.UpdateChecker(current(), path, fetcher=fetch, clock=lambda:now[0])
            self.assertTrue(restored.check()['cached']); self.assertEqual(len(calls),1)
            self.assertFalse(restored.check(refresh=True)['cached']); self.assertEqual(len(calls),2)
            now[0] += 86401
            restored.check(); self.assertEqual(len(calls),3)

    def test_offline_preserves_last_good_check_with_staleness(self):
        now = [1000]
        checker = updates.UpdateChecker(current(), fetcher=lambda:[release()], clock=lambda:now[0])
        good = checker.check()
        def unavailable(): raise OSError('/private/path should not reach UI')
        checker.fetcher = unavailable
        now[0] += 86401
        old = checker.check()
        self.assertTrue(old['stale']);self.assertTrue(old['cached']);self.assertEqual(old['checkedAt'],good['checkedAt'])
        self.assertEqual(old['status'],'update-available');self.assertEqual(old['reason'],'offline')
        self.assertNotIn('/private',json.dumps(old))
        cold = updates.UpdateChecker(current(), fetcher=unavailable)
        self.assertEqual(cold.check()['status'],'offline')
        self.assertEqual(cold.check()['status'],'offline')

    def test_forged_cache_url_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'updates.json';checker=updates.UpdateChecker(current(),path,fetcher=lambda:[release()]);checker.check()
            data=json.loads(path.read_text());data['offer']['downloadUrl']='https://evil.invalid/setup.exe';path.write_text(json.dumps(data))
            restored=updates.UpdateChecker(current(),path,fetcher=lambda:[])
            self.assertIsNone(restored.cached);self.assertEqual(restored.check()['status'],'unavailable')

    def test_duplicate_checks_do_not_block_or_launch_another_fetch(self):
        entered, leave = threading.Event(), threading.Event()
        def fetch(): entered.set();leave.wait(2);return [release()]
        checker=updates.UpdateChecker(current(),fetcher=fetch);worker=threading.Thread(target=checker.check);worker.start();self.assertTrue(entered.wait(1))
        self.assertEqual(checker.check(refresh=True)['reason'],'checking');leave.set();worker.join(3)
        self.assertFalse(worker.is_alive())

    def test_get_request_is_fixed_credential_free_and_bounded(self):
        raw=json.dumps([release()]).encode()
        class Response:
            status=200;headers={'Content-Length':str(len(raw))}
            def __init__(self):self.at=0
            def geturl(self):return updates.API_URL
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,n):chunk=raw[self.at:self.at+n];self.at+=len(chunk);return chunk
        class Opener:
            def open(self,request,timeout):
                self.outer.assertEqual(request.full_url,updates.API_URL)
                self.outer.assertEqual(request.method,'GET');self.outer.assertIsNone(request.data)
                self.outer.assertFalse(any(k.lower() in ('cookie','authorization') for k in request.headers))
                self.outer.assertEqual(timeout,5)
                return Response()
        opener=Opener();opener.outer=self
        with patch.object(updates,'build_opener',return_value=opener):self.assertEqual(len(updates.fetch_releases()),1)
        with self.assertRaises(ValueError):updates.NoRedirect().redirect_request(None,None,302,'',{},'https://evil.invalid')
        Response.headers={'Content-Length':'2000001'}
        with patch.object(updates,'build_opener',return_value=opener),self.assertRaises(ValueError):updates.fetch_releases()

    def test_local_endpoint_rejects_project_payload_and_cross_origin(self):
        from studio_server import Handler
        from http.server import ThreadingHTTPServer
        calls=[];server=ThreadingHTTPServer(('127.0.0.1',0),Handler);server.address=f'127.0.0.1:{server.server_port}';server.token='test-token'
        server.update_checker=updates.UpdateChecker(current(),fetcher=lambda:(calls.append(True) or [release()]))
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        def request(body,origin=None,token='test-token'):
            connection=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=3)
            connection.request('POST','/api/updates',json.dumps(body),{'Origin':origin or 'http://'+server.address,'X-Studio-Token':token,'Content-Type':'application/json'})
            response=connection.getresponse();data=json.loads(response.read());status=response.status;connection.close();return status,data
        try:
            self.assertEqual(request({'refresh':False},origin='https://evil.invalid')[0],403)
            self.assertEqual(request({'refresh':False},token='wrong')[0],403)
            for data in ({'project':{}},{'url':updates.API_URL},{'refresh':'yes'}):self.assertEqual(request(data)[0],422)
            self.assertEqual(calls,[])
            code,result=request({'refresh':False});self.assertEqual(code,200);self.assertEqual(result['status'],'update-available');self.assertEqual(len(calls),1)
        finally:server.shutdown();server.server_close();thread.join(2)


if __name__ == '__main__': unittest.main()

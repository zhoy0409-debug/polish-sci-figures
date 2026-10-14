"""Synthetic local download/install-handoff tests. Never executes an installer."""
import hashlib
import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import types
import unittest
from unittest import mock
from urllib.request import urlopen, Request

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'desktop'), str(ROOT / 'skills/polish-sci-figures/scripts')]
import windows_updater as update
import studio_updates


def offer(data=b'synthetic installer; do not execute'):
    name = 'polish-sci-figures-Studio-0.1.9-Setup-x64.exe'
    return dict(status='update-available', currentVersion='0.1.8', latestVersion='0.1.9', platform='windows', architecture='x86_64', channel='stable', releaseTag='v1.4.9', assetName=name, downloadUrl=update.RELEASES + '/download/v1.4.9/' + name, assetBytes=len(data), assetSha256=hashlib.sha256(data).hexdigest())


class Response(io.BytesIO):
    status = 200
    def __init__(self, data, length=None):
        super().__init__(data); self.headers = {'Content-Length': str(len(data) if length is None else length)}


class WindowsUpdateTests(unittest.TestCase):
    def setUp(self):
        cache = ROOT / '.cache' / 'windows-update-tests'; cache.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=cache); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_official_digest_and_exact_platform_are_required(self):
        value = offer(); self.assertEqual(update.checked_offer(value)['assetSha256'], value['assetSha256'])
        for changes in ({'assetSha256': None}, {'assetSha256': 'f'*63}, {'assetBytes': True}, {'stale': True}, {'downloadUrl': 'https://example.invalid/setup.exe'}, {'platform': 'macos'}, {'channel': 'preview'}, {'latestVersion': '0.1.8'}):
            with self.assertRaises((ValueError, TypeError)):
                update.checked_offer({**value, **changes})
        release = dict(draft=False, prerelease=False, tag_name='v1.4.9', html_url=update.RELEASES+'/tag/v1.4.9', published_at='2026-10-15T00:00:00Z', assets=[dict(name=value['assetName'], state='uploaded', size=value['assetBytes'], browser_download_url=value['downloadUrl'], digest='sha256:'+value['assetSha256'])])
        current = {key:value[key] for key in ('currentVersion','platform','architecture','channel')}
        checker = studio_updates.UpdateChecker(current, self.root/'check.json', fetcher=lambda:[release]); result=checker.check()
        self.assertEqual(result['assetSha256'],value['assetSha256'])
        restored=studio_updates.UpdateChecker(current,self.root/'check.json',fetcher=lambda:[]);self.assertEqual(restored.check()['assetSha256'],value['assetSha256'])

    def test_real_loopback_stream_verifies_bytes_hash_and_progress(self):
        data = b'MZ' + bytes(range(251))*3000; value=offer(data); progress=[]
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
            def log_message(self,*args): pass
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler); thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            target=self.root/'verified.exe'; requested=[]
            def opener(url):
                requested.append(url);return urlopen(f'http://127.0.0.1:{server.server_port}/fixture',timeout=3)
            update.download_asset(value,target,opener=opener,progress=progress.append)
            self.assertEqual(target.read_bytes(),data);self.assertEqual(requested,[value['downloadUrl']]);self.assertEqual(progress[-1],len(data));self.assertGreater(len(progress),1);update.verify_file(target,value)
        finally: server.shutdown();server.server_close();thread.join()

    def test_corrupt_truncated_oversize_cancelled_downloads_never_leave_executable(self):
        data=b'correct bytes';value=offer(data)
        for index,(body,length) in enumerate([(b'wrong bytes!!',len(data)),(data[:-1],len(data)),(data+b'extra',len(data)),(data,1)]):
            path=self.root/f'bad{index}.exe'
            with self.assertRaises(ValueError):update.download_asset(value,path,opener=lambda url:Response(body,length))
            self.assertFalse(path.exists());self.assertFalse(path.with_suffix('.partial').exists())
        stopped=threading.Event();stopped.set();path=self.root/'cancel.exe'
        with self.assertRaises(InterruptedError):update.download_asset(value,path,opener=lambda url:Response(data),cancelled=stopped)
        self.assertFalse(path.exists());self.assertFalse(path.with_suffix('.partial').exists())

    def test_download_redirects_are_https_bounded_github_asset_hosts_only(self):
        handler=update.AssetRedirect();request=Request(offer()['downloadUrl'])
        for url in ['http://release-assets.githubusercontent.com/x','https://example.com/x','https://github.com/another/project','https://user@release-assets.githubusercontent.com/x']:
            with self.assertRaises(ValueError):handler.redirect_request(request,None,302,'Found',{},url)
        allowed=handler.redirect_request(request,None,302,'Found',{},'https://release-assets.githubusercontent.com/x?signature=opaque');self.assertEqual(allowed._update_redirects,1)
        allowed._update_redirects=3
        with self.assertRaises(ValueError):handler.redirect_request(allowed,None,302,'Found',{},'https://release-assets.githubusercontent.com/x')

    def installation(self):
        program=self.root/'Program Files with spaces';program.mkdir();(program/'Figure Studio.exe').write_bytes(b'old launcher');(program/'unins000.exe').write_bytes(b'uninstaller');(program/'_internal').mkdir();(program/'_internal'/'library.dat').write_bytes(b'old library')
        research=self.root/'User projects';research.mkdir();(research/'private.json').write_bytes(b'unchanged research')
        return program,research

    def test_registered_install_does_not_confuse_portable_copy(self):
        program,_=self.installation()
        self.assertIsNone(update.registered_install(program/'Figure Studio.exe',frozen=False,registry_reader=lambda:str(program)))
        if sys.platform=='win32':
            self.assertEqual(update.registered_install(program/'Figure Studio.exe',frozen=True,registry_reader=lambda:str(program)),program.resolve())
            self.assertIsNone(update.registered_install(program/'Figure Studio.exe',frozen=True,registry_reader=lambda:str(self.root/'other')))

    def test_install_requires_second_action_and_started_helper_before_shutdown(self):
        program,research=self.installation();data=b'synthetic installer';value=offer(data);started=[];closed=[]
        def launch(command,**kwargs):
            started.append((command,kwargs));(Path(command[-1]).parent/'helper-ready.json').write_text('{"ready":true}');return types.SimpleNamespace(poll=lambda:None)
        controller=update.WindowsUpdater(types.SimpleNamespace(check=lambda **kwargs:value),self.root/'cache',program,on_install=lambda:closed.append(True),opener=lambda url:Response(data),launch=launch)
        controller.request('download');controller.worker.join(5);self.assertEqual(controller.snapshot()['status'],'ready');self.assertFalse(started);self.assertFalse(closed)
        controller.request('install');controller.worker.join(5);self.assertEqual(controller.snapshot()['status'],'installing');self.assertEqual(len(started),1);self.assertEqual(closed,[True]);self.assertEqual(started[0][0][1],'--apply-update');self.assertEqual((research/'private.json').read_bytes(),b'unchanged research')
        controller=update.WindowsUpdater(None,self.root/'portable-cache',None,on_install=lambda:None)
        with self.assertRaises(ValueError):controller.request('download')

    def handoff(self,program):
        job=self.root/('update-'+'a'*24);job.mkdir();backup=job/'rollback';files=update.backup_program(program,backup);value=offer();(job/value['assetName']).write_bytes(b'synthetic installer; do not execute')
        path=job/'handoff.json';path.write_text(json.dumps(dict(version=1,installDir=str(program),parentPid=123,offer=value,files=files,fileHashes={name:update.file_hash(backup/name) for name in files})));return path,backup

    def test_helper_waits_then_installs_and_restarts_without_shell_or_elevation_bypass(self):
        program,research=self.installation();path,backup=self.handoff(program);events=[]
        def run(command,**kwargs):
            events.append('install');self.assertEqual(command,update.installer_command(path.parent/offer()['assetName'],program));self.assertFalse(kwargs.get('shell',False));self.assertNotIn('/SUPPRESSMSGBOXES',command);self.assertNotIn('/FORCECLOSEAPPLICATIONS',command);return types.SimpleNamespace(returncode=0)
        outcome=update.apply_handoff(path,executable=backup/'Figure Studio.exe',registration=lambda *args,**kwargs:program,wait=lambda pid,exe:events.append('wait'),run=run,launch=lambda command,**kwargs:events.append(('restart',command)))
        self.assertEqual(outcome,'installed');self.assertEqual(events,['wait','install',('restart',[str(program/'Figure Studio.exe')])]);self.assertEqual((research/'private.json').read_bytes(),b'unchanged research')

    def test_cancel_or_failed_install_restores_old_files_and_restarts_old_program(self):
        program,research=self.installation();path,backup=self.handoff(program);restarted=[]
        def failed(command,**kwargs):
            (program/'Figure Studio.exe').write_bytes(b'partial new version');(program/'_internal'/'library.dat').write_bytes(b'partial library');(program/'_internal'/'new-shadow-module.pyc').write_bytes(b'new dependency');return types.SimpleNamespace(returncode=2)
        outcome=update.apply_handoff(path,executable=backup/'Figure Studio.exe',registration=lambda *args,**kwargs:program,wait=lambda *args:None,run=failed,launch=lambda command,**kwargs:restarted.append(command))
        self.assertEqual(outcome,'restored');self.assertEqual((program/'Figure Studio.exe').read_bytes(),b'old launcher');self.assertEqual((program/'_internal'/'library.dat').read_bytes(),b'old library');self.assertEqual(len(restarted),1);self.assertEqual((research/'private.json').read_bytes(),b'unchanged research')
        self.assertFalse((program/'_internal'/'new-shadow-module.pyc').exists(),'a rollback cannot leave a mixture of old and new dependencies')

    def test_failed_rollback_records_backup_and_opens_preserved_program(self):
        program,research=self.installation();path,backup=self.handoff(program);restarted=[]
        with mock.patch.object(update.shutil,'copy2',side_effect=PermissionError('Original folder is not writable')):
            outcome=update.apply_handoff(path,executable=backup/'Figure Studio.exe',registration=lambda *args,**kwargs:program,wait=lambda *args:None,run=lambda *args,**kwargs:types.SimpleNamespace(returncode=2),launch=lambda command,**kwargs:restarted.append(command))
        self.assertEqual(outcome,'rollback-failed');self.assertEqual(restarted,[[str(backup/'Figure Studio.exe')]])
        report=json.loads((path.parent/'result.json').read_text());self.assertEqual(report['status'],'rollback-failed');self.assertEqual(report['backupPath'],str(backup));self.assertIn('could not be fully restored',report['error']);self.assertEqual((research/'private.json').read_bytes(),b'unchanged research')

    @unittest.skipUnless(sys.platform == 'win32', 'Uses real Windows extended-path filesystem operations')
    def test_actual_long_paths_download_prepare_verify_and_exact_rollback(self):
        # Build fixtures with native extended paths independently of the helper
        # under test. This works even with LongPathsEnabled=0 (the reported bug).
        def native(path):
            return Path('\\\\?\\' + str(path))
        top = self.root / 'long-root'
        self.addCleanup(lambda: shutil.rmtree(native(top), ignore_errors=False) if native(top).exists() else None)
        deep = top
        for index in range(4):
            deep /= str(index) + '-' + 'nested-directory-' * 4
        program, cache = deep / 'program', deep / 'data' / 'cache'
        native(program / '_internal').mkdir(parents=True)
        for relative, content in [('Figure Studio.exe', b'old launcher'), ('unins000.exe', b'uninstaller'), ('_internal/library.dat', b'original library')]:
            native(program / relative).write_bytes(content)
        sentinel = deep / 'data' / 'project.json'
        native(sentinel.parent).mkdir(parents=True)
        native(sentinel).write_bytes(b'private research sentinel')
        self.assertGreater(len(str(program / '_internal/library.dat')), 320)
        self.assertEqual(update.canonical_path(native(program)), program)
        files = update.program_files(program)
        self.assertEqual({p.relative_to(program).as_posix() for p in files}, {'Figure Studio.exe', 'unins000.exe', '_internal/library.dat'})
        self.assertTrue(all(not str(p).startswith('\\\\?\\') for p in files))
        data = b'synthetic installer, never execute'
        value, closed, started = offer(data), [], []
        def launch_helper(command, **kwargs):
            started.append(command)
            native(Path(command[-1]).parent / 'helper-ready.json').write_text('{"ready":true}')
            return types.SimpleNamespace(poll=lambda: None)
        controller = update.WindowsUpdater(types.SimpleNamespace(check=lambda **kwargs: value), cache, program,
            on_install=lambda: closed.append(True), opener=lambda url: Response(data), launch=launch_helper)
        controller.request('download'); controller.worker.join(10)
        self.assertEqual(controller.snapshot()['status'], 'ready')
        controller.request('install'); controller.worker.join(10)
        self.assertEqual(controller.snapshot()['status'], 'installing')
        self.assertEqual(closed, [True]); self.assertEqual(len(started), 1)
        path, backup = controller.job / 'handoff.json', controller.job / 'rollback'
        manifest = json.loads(native(path).read_text())
        self.assertEqual(manifest['installDir'], str(program))
        self.assertTrue(all(not Path(name).is_absolute() for name in manifest['files']))
        for name, digest in manifest['fileHashes'].items():
            self.assertEqual(update.file_hash(backup / name), digest)
        def failed_install(command, **kwargs):
            native(program / '_internal/library.dat').write_bytes(b'partial new version')
            native(program / '_internal/new-dependency.pyc').write_bytes(b'new dependency')
            return types.SimpleNamespace(returncode=2)
        restarted = []
        outcome = update.apply_handoff(path, executable=backup / 'Figure Studio.exe',
            registration=lambda *args, **kwargs: program, wait=lambda *args: None,
            run=failed_install, launch=lambda command, **kwargs: restarted.append(command))
        self.assertEqual(outcome, 'restored')
        self.assertEqual(native(program / '_internal/library.dat').read_bytes(), b'original library')
        self.assertFalse(native(program / '_internal/new-dependency.pyc').exists())
        self.assertEqual(json.loads(native(controller.job / 'result.json').read_text()), {'status': 'restored'})
        self.assertEqual(restarted, [[str(program / 'Figure Studio.exe')]])
        self.assertEqual(native(sentinel).read_bytes(), b'private research sentinel')

    def test_prepare_failure_records_local_stage_without_closing_editor(self):
        program, _ = self.installation(); data = b'synthetic installer'; closed, launched = [], []
        controller = update.WindowsUpdater(types.SimpleNamespace(check=lambda **kwargs: offer(data)), self.root / 'cache', program,
            on_install=lambda: closed.append(True), opener=lambda url: Response(data), launch=lambda *a, **k: launched.append(a))
        controller.request('download'); controller.worker.join(5)
        failure = PermissionError(13, 'Synthetic backup access failure')
        failure.winerror = 5
        with mock.patch.object(update.shutil, 'copy2', side_effect=failure):
            controller.request('install'); controller.worker.join(5)
        self.assertEqual(controller.snapshot()['error'], 'prepare-failed')
        self.assertEqual(controller.snapshot()['errorStage'], 'backup-program')
        diagnostic = json.loads((controller.job / 'prepare-error.json').read_text())
        self.assertEqual(diagnostic['stage'], 'backup-program'); self.assertEqual(diagnostic['type'], 'PermissionError')
        self.assertEqual(diagnostic['winerror'], 5); self.assertIn('Synthetic backup access failure', diagnostic['message'])
        self.assertEqual(set(diagnostic), {'stage', 'type', 'message', 'errno', 'winerror'})
        self.assertFalse((controller.job / 'handoff.json').exists()); self.assertEqual(closed, []); self.assertEqual(launched, [])

    def test_backup_byte_corruption_blocks_installation_before_old_editor_closes(self):
        program,_=self.installation();path,backup=self.handoff(program);(backup/'_internal'/'library.dat').write_bytes(b'corrupted backup');calls=[]
        with self.assertRaises(ValueError):update.apply_handoff(path,executable=backup/'Figure Studio.exe',registration=lambda *args,**kwargs:program,wait=lambda *a:calls.append('wait'),run=lambda *a,**k:calls.append('run'),launch=lambda *a,**k:calls.append('launch'))
        self.assertEqual(calls,[]);self.assertFalse((path.parent/'helper-ready.json').exists())

    def test_tampered_installer_never_reaches_process_launch(self):
        program,_=self.installation();path,backup=self.handoff(program);(path.parent/offer()['assetName']).write_bytes(b'tampered');calls=[]
        with self.assertRaises(ValueError):update.apply_handoff(path,executable=backup/'Figure Studio.exe',registration=lambda *args,**kwargs:program,wait=lambda *a:calls.append('wait'),run=lambda *a,**k:calls.append('run'),launch=lambda *a,**k:calls.append('launch'))
        self.assertEqual(calls,[]);self.assertFalse((path.parent/'helper-ready.json').exists())

    def test_authenticated_endpoint_accepts_only_actions_and_no_client_paths(self):
        from studio_server import Handler
        calls=[];page=self.root/'index.html';page.write_text('<html><head></head></html>')
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler);server.address=f'127.0.0.1:{server.server_port}';server.token='test-token';server.page=page
        server.windows_updater=types.SimpleNamespace(request=lambda action:(calls.append(action) or {'status':'idle','supported':True}),snapshot=lambda:{'supported':True})
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        def post(payload,authorized=True):
            connection=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=3);headers={'Origin':'http://'+server.address,'Content-Type':'application/json','X-Studio-Token':'test-token' if authorized else 'wrong'}
            try:
                if authorized:
                    connection.request('POST','/api/update-install',json.dumps(payload),headers)
                else:
                    # Authorization rejects before reading a body. Avoid a
                    # client body-write/reset race by sending only headers.
                    connection.putrequest('POST','/api/update-install')
                    for key,value in headers.items():connection.putheader(key,value)
                    connection.putheader('Content-Length','0');connection.endheaders()
                response=connection.getresponse();return response.status,json.loads(response.read())
            finally:connection.close()
        try:
            self.assertEqual(post({'action':'status'})[0],200);self.assertEqual(calls,['status'])
            self.assertEqual(post({'action':'download','url':'https://example.invalid'})[0],422);self.assertEqual(calls,['status'])
            self.assertEqual(post({'action':'install'},False)[0],403);self.assertEqual(calls,['status'])
        finally:server.shutdown();server.server_close();thread.join()


if __name__=='__main__':unittest.main()

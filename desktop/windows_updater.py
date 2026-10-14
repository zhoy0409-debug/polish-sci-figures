"""Explicit per-user Windows updates, with bounded downloads and file rollback.

This module never accepts a client URL, destination path, PID or command. Only
the authenticated local controller may start download/install actions. Research
files and the persistent browser origin live outside the program directory.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

RELEASES = 'https://github.com/zhoy0409-debug/polish-sci-figures/releases'
UNINSTALL_KEY = r'Software\Microsoft\Windows\CurrentVersion\Uninstall\{51D78749-35EE-43BB-BA21-F79D6A1D5094}_is1'
MAX_BYTES = 2_000_000_000
CHUNK = 262_144


def logical_path(path):
    """Keep identities/manifests as ordinary paths, never device-path aliases."""
    value = os.fspath(path)
    if os.name == 'nt':
        if value.startswith('\\\\?\\UNC\\'):
            value = '\\\\' + value[8:]
        elif value.startswith('\\\\?\\'):
            value = value[4:]
    return Path(value)


def filesystem_path(path):
    """Use long-path Win32 I/O without changing the machine's registry policy."""
    path = logical_path(path)
    if os.name != 'nt':
        return path
    value = os.path.abspath(path)
    return Path('\\\\?\\UNC\\' + value[2:] if value.startswith('\\\\') else '\\\\?\\' + value)


def canonical_path(path):
    return logical_path(filesystem_path(path).resolve())


def linked_path(path):
    path = filesystem_path(path)
    try:
        # st_file_attributes covers junctions on Python 3.10 as well as the
        # newer Path.is_junction API. Never traverse Windows reparse points.
        return path.is_symlink() or bool(getattr(path.lstat(), 'st_file_attributes', 0) & 0x400)
    except FileNotFoundError:
        return False


def registered_install(executable=None, *, frozen=None, registry_reader=None):
    if os.name != 'nt' or not (getattr(sys, 'frozen', False) if frozen is None else frozen):
        return None
    executable = canonical_path(executable or sys.executable)
    if executable.name.lower() != 'figure studio.exe':
        return None
    def read():
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY, 0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY) as key:
            return winreg.QueryValueEx(key, 'Inno Setup: App Path')[0]
    try:
        registered = Path((registry_reader or read)())
        if linked_path(registered):
            return None
        directory = canonical_path(registered)
        if directory != executable.parent or not filesystem_path(directory / 'unins000.exe').is_file():
            return None
        return directory
    except (OSError, TypeError, ValueError):
        return None


def checked_offer(value):
    from studio_updates import version_tuple
    if not isinstance(value, dict) or value.get('status') != 'update-available' or value.get('stale') is True or value.get('platform') != 'windows' or value.get('architecture') != 'x86_64' or value.get('channel') != 'stable':
        raise ValueError('No current verified Windows update is available')
    if version_tuple(value['latestVersion']) <= version_tuple(value['currentVersion']):
        raise ValueError('The update is not newer')
    tag = value.get('releaseTag', '')
    if not isinstance(tag, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,99}', tag):
        raise ValueError('Invalid release identity')
    name = 'polish-sci-figures-Studio-' + value['latestVersion'] + '-Setup-x64.exe'
    expected = RELEASES + '/download/' + tag + '/' + name
    if value.get('assetName') != name or value.get('downloadUrl') != expected:
        raise ValueError('The installer does not match the official release')
    if type(value.get('assetBytes')) is not int or not 0 < value['assetBytes'] <= MAX_BYTES or not isinstance(value.get('assetSha256'), str) or not re.fullmatch(r'[0-9a-f]{64}', value['assetSha256']):
        raise ValueError('The official release has no usable SHA256 and size')
    return {key: value[key] for key in ('latestVersion', 'assetName', 'downloadUrl', 'assetBytes', 'assetSha256')}


class AssetRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, newurl):
        url = urlsplit(newurl)
        if url.scheme != 'https' or url.hostname not in ('release-assets.githubusercontent.com', 'objects.githubusercontent.com') or url.port not in (None, 443) or url.username or url.password or getattr(request, '_update_redirects', 0) >= 3:
            raise ValueError('Unexpected installer redirect')
        result = super().redirect_request(request, response, code, message, headers, newurl)
        if result is not None:
            result._update_redirects = getattr(request, '_update_redirects', 0) + 1
        return result


def open_asset(url):
    return build_opener(AssetRedirect()).open(Request(url, headers={'User-Agent': 'Figure-Studio-Installer-Update', 'Accept-Encoding': 'identity'}, method='GET'), timeout=15)


def verify_file(path, offer):
    path = filesystem_path(path)
    if linked_path(path) or not path.is_file() or path.stat().st_size != offer['assetBytes']:
        raise ValueError('Installer size verification failed')
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(CHUNK), b''):
            digest.update(block)
    if digest.hexdigest() != offer['assetSha256']:
        raise ValueError('Installer SHA256 verification failed')


def file_hash(path):
    digest = hashlib.sha256()
    with filesystem_path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(CHUNK), b''):
            digest.update(block)
    return digest.hexdigest()


def download_asset(offer, destination, *, opener=open_asset, cancelled=None, progress=lambda n: None, clock=time.monotonic):
    target = filesystem_path(destination)
    part = target.with_suffix('.partial')
    started, digest, received = clock(), hashlib.sha256(), 0
    try:
        with opener(offer['downloadUrl']) as response, part.open('xb') as output:
            if response.status != 200:
                raise ValueError('Installer download failed')
            length = response.headers.get('Content-Length')
            if length is not None and (not length.isdigit() or int(length) != offer['assetBytes']):
                raise ValueError('Installer size verification failed')
            while True:
                if cancelled and cancelled.is_set():
                    raise InterruptedError('Download cancelled')
                if clock() - started > 1800:
                    raise TimeoutError('Installer download timed out')
                block = response.read(CHUNK)
                if not block:
                    break
                received += len(block)
                if received > offer['assetBytes']:
                    raise ValueError('Installer size verification failed')
                output.write(block); digest.update(block); progress(received)
            output.flush(); os.fsync(output.fileno())
        if received != offer['assetBytes'] or digest.hexdigest() != offer['assetSha256']:
            raise ValueError('Installer SHA256 or size verification failed')
        if cancelled and cancelled.is_set():
            raise InterruptedError('Download cancelled')
        os.replace(part, target)
    finally:
        part.unlink(missing_ok=True)


def program_files(directory):
    if linked_path(directory):
        raise ValueError('Program directory is a linked path')
    directory = canonical_path(directory)
    files = []
    def fail(error):
        raise error
    for base, folders, names in os.walk(filesystem_path(directory), followlinks=False, onerror=fail):
        for name in folders + names:
            path = logical_path(Path(base) / name)
            if linked_path(path) or not canonical_path(path).is_relative_to(directory):
                raise ValueError('Program directory contains a linked path')
        files.extend(logical_path(Path(base) / name) for name in names)
    return files


def backup_program(directory, backup):
    if linked_path(directory) or linked_path(backup):
        raise ValueError('Rollback paths contain a link')
    directory, backup = canonical_path(directory), canonical_path(backup)
    if backup.is_relative_to(directory) or directory.is_relative_to(backup):
        raise ValueError('Rollback location overlaps the program')
    files = program_files(directory)
    required = sum(filesystem_path(path).stat().st_size for path in files)
    filesystem_path(backup.parent).mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(filesystem_path(backup.parent)).free < required + 256_000_000:
        raise OSError('Not enough disk space to preserve the current version')
    filesystem_path(backup).mkdir()
    manifest = []
    for path in files:
        relative = path.relative_to(directory)
        destination = backup / relative
        filesystem_path(destination.parent).mkdir(parents=True, exist_ok=True)
        shutil.copy2(filesystem_path(path), filesystem_path(destination))
        manifest.append(str(relative))
    return manifest


def installer_command(installer, directory):
    # Inno's progress and error dialogs stay visible. Never /VERYSILENT,
    # /SUPPRESSMSGBOXES, /FORCECLOSEAPPLICATIONS or an elevation bypass.
    return [str(installer), '/SILENT', '/SP-', '/NORESTART', '/NOCLOSEAPPLICATIONS',
            '/NOFORCECLOSEAPPLICATIONS', '/NORESTARTAPPLICATIONS', '/STUDIOUPDATE=1',
            '/DIR=' + str(directory)]


class WindowsUpdater:
    def __init__(self, checker, cache, install_dir, *, on_install, opener=open_asset, launch=subprocess.Popen):
        self.checker, self.cache = checker, canonical_path(cache)
        self.install_dir = canonical_path(install_dir) if install_dir else None
        self.on_install, self.opener, self.launch = on_install, opener, launch
        self.lock = threading.Lock(); self.cancelled = threading.Event()
        self.worker = None; self.offer = None; self.job = None
        self.state = {'status': 'idle', 'supported': self.install_dir is not None, 'received': 0, 'total': 0}

    def snapshot(self):
        with self.lock:
            return dict(self.state)

    def _set(self, **values):
        with self.lock:
            self.state.update(values)

    def request(self, action):
        if action == 'status':
            return self.snapshot()
        if not self.install_dir:
            raise ValueError('Automatic installation requires the Windows installed edition')
        if action == 'cancel':
            if self.snapshot()['status'] not in ('checking', 'downloading'):
                raise ValueError('Only a download can be cancelled')
            self.cancelled.set(); return self.snapshot()
        with self.lock:
            if self.worker and self.worker.is_alive():
                raise ValueError('An update operation is already running')
            if action == 'download':
                self.cancelled.clear()
                self.state.update(status='checking', received=0, total=0, error=None, errorStage=None)
                task = self._download
            elif action == 'install' and self.state['status'] == 'ready':
                self.state.update(status='preparing', error=None, errorStage=None)
                task = self._prepare
            else:
                raise ValueError('The requested update action is unavailable')
            self.worker = threading.Thread(target=task, daemon=True, name='Figure Studio update')
            self.worker.start()
        return self.snapshot()

    def _download(self):
        try:
            offer = checked_offer(self.checker.check(refresh=True))
            if self.cancelled.is_set():
                raise InterruptedError()
            filesystem_path(self.cache).mkdir(parents=True, exist_ok=True)
            self.job = self.cache / ('update-' + secrets.token_hex(12)); filesystem_path(self.job).mkdir()
            self.offer = offer
            self._set(status='downloading', total=offer['assetBytes'], latestVersion=offer['latestVersion'])
            download_asset(offer, self.job / offer['assetName'], opener=self.opener, cancelled=self.cancelled,
                           progress=lambda value: self._set(received=value))
            self._set(status='ready')
        except InterruptedError:
            self._set(status='cancelled')
        except Exception:
            self._set(status='error', error='download-verification-failed')

    def _prepare(self):
        stage = 'verify-installer'
        try:
            installer = self.job / self.offer['assetName']
            verify_file(installer, self.offer)
            if self.cache.is_relative_to(self.install_dir) or self.install_dir.is_relative_to(self.cache):
                raise ValueError('Update cache overlaps program data')
            backup = self.job / 'rollback'
            stage = 'backup-program'
            files = backup_program(self.install_dir, backup)
            stage = 'verify-backup'
            manifest = {'version': 1, 'installDir': str(self.install_dir), 'parentPid': os.getpid(),
                        'offer': self.offer, 'files': files,
                        'fileHashes': {name: file_hash(backup / name) for name in files}}
            path = self.job / 'handoff.json'
            filesystem_path(path).write_text(json.dumps(manifest), encoding='utf-8')
            helper = backup / 'Figure Studio.exe'
            if not filesystem_path(helper).is_file():
                raise ValueError('Rollback launcher is missing')
            stage = 'start-helper'
            process = self.launch([str(helper), '--apply-update', str(path)], cwd=str(backup), close_fds=True)
            # The helper validates the preserved program before allowing the
            # editor to close. Slow disks still have a finite preparation wait.
            deadline = time.monotonic() + 120
            stage = 'wait-helper'
            while not filesystem_path(self.job / 'helper-ready.json').is_file():
                if process.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError('The update helper could not start')
                time.sleep(.1)
            self._set(status='installing')
            self.on_install()
        except Exception as error:
            # This bounded local diagnostic contains no token, environment or
            # research-file content. Keep API/UI errors concise and stable.
            diagnostic = {'stage': stage, 'type': type(error).__name__,
                          'message': str(error)[:1200], 'errno': getattr(error, 'errno', None),
                          'winerror': getattr(error, 'winerror', None)}
            try:
                if self.job:
                    filesystem_path(self.job / 'prepare-error.json').write_text(json.dumps(diagnostic), encoding='utf-8')
            except OSError:
                pass
            self._set(status='error', error='prepare-failed', errorStage=stage)


def wait_for_process(pid, executable, timeout=90):
    import ctypes
    from ctypes import wintypes
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    handle = kernel.OpenProcess(0x00100000 | 0x1000, False, pid)
    if not handle:
        if ctypes.get_last_error() == 87:  # Already exited.
            return
        raise OSError('Unable to wait for the previous editor')
    try:
        buffer = ctypes.create_unicode_buffer(32768); length = wintypes.DWORD(len(buffer))
        kernel.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
        if not kernel.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(length)) or canonical_path(buffer.value) != canonical_path(executable):
            raise ValueError('The previous process identity changed')
        kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        if kernel.WaitForSingleObject(handle, int(timeout * 1000)) != 0:
            raise TimeoutError('The editor is still finishing work; installation was not started')
    finally:
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]; kernel.CloseHandle(handle)


def restore_program(directory, backup, files, hashes):
    """Restore the exact installation inventory; user data is elsewhere.

    The original editor and installer have both stopped. Never recurse through
    links and never delete a directory wholesale. Only files absent from the
    pre-install inventory inside this verified program directory are removed.
    """
    if linked_path(directory) or linked_path(backup):
        raise ValueError('Rollback paths contain a link')
    directory, backup = canonical_path(directory), canonical_path(backup)
    if directory == backup or directory.is_relative_to(backup) or backup.is_relative_to(directory):
        raise ValueError('Rollback paths overlap')
    program_files(backup)
    for name in files:
        if file_hash(backup / name) != hashes[name]:
            raise ValueError('The preserved program failed verification')
    current = program_files(directory)
    old = set(files)
    for path in current:
        if str(path.relative_to(directory)) not in old:
            if not canonical_path(path).is_relative_to(directory):
                raise ValueError('Rollback target escaped the program directory')
            filesystem_path(path).unlink()
    for name in files:
        source, target = backup / name, directory / name
        if not canonical_path(target).is_relative_to(directory):
            raise ValueError('Rollback target escaped the program directory')
        filesystem_path(target.parent).mkdir(parents=True, exist_ok=True)
        shutil.copy2(filesystem_path(source), filesystem_path(target))
    # Verify bytes and the complete file inventory before claiming success.
    restored = program_files(directory)
    if {str(path.relative_to(directory)) for path in restored} != old or any(file_hash(directory / name) != hashes[name] for name in files):
        raise ValueError('Restored program verification failed')


def apply_handoff(path, *, executable=None, registration=registered_install, wait=wait_for_process, run=subprocess.run, launch=subprocess.Popen):
    """Invoked only from a preserved program copy after explicit confirmation."""
    path = canonical_path(path); backup = path.parent / 'rollback'
    own = canonical_path(executable or sys.executable)
    if path.name != 'handoff.json' or not re.fullmatch(r'update-[0-9a-f]{24}', path.parent.name) or own != backup / 'Figure Studio.exe' or filesystem_path(path).stat().st_size > 4_000_000:
        raise ValueError('Invalid update handoff')
    value = json.loads(filesystem_path(path).read_text(encoding='utf-8'))
    directory = canonical_path(value['installDir']); original = directory / 'Figure Studio.exe'
    if registration(original, frozen=True) != directory or path.parent.is_relative_to(directory) or directory.is_relative_to(path.parent):
        raise ValueError('The registered installation changed')
    offer = value['offer']; installer = path.parent / offer['assetName']
    if installer.parent != path.parent or not re.fullmatch(r'polish-sci-figures-Studio-\d+\.\d+\.\d+-Setup-x64\.exe', offer['assetName']):
        raise ValueError('Invalid installer identity')
    verify_file(installer, offer)
    files = value.get('files')
    if not isinstance(files, list) or len(files) > 100000 or any(not isinstance(name, str) or not name or Path(name).is_absolute() or '..' in Path(name).parts for name in files):
        raise ValueError('Invalid rollback file list')
    hashes = value.get('fileHashes')
    if len(set(files)) != len(files) or not isinstance(hashes, dict) or set(hashes) != set(files) or any(not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest) for digest in hashes.values()):
        raise ValueError('Invalid rollback checksums')
    if {str(item.relative_to(backup)) for item in program_files(backup)} != set(files):
        raise ValueError('Rollback inventory changed')
    program_files(directory)
    if any(not filesystem_path(backup / name).is_file() or not canonical_path(backup / name).is_relative_to(backup) or file_hash(backup / name) != hashes[name] for name in files):
        raise ValueError('Rollback files are incomplete')
    if type(value.get('parentPid')) is not int or value['parentPid'] <= 0:
        raise ValueError('Invalid previous process identity')
    filesystem_path(path.parent / 'helper-ready.json').write_text('{"ready":true}', encoding='utf-8')
    wait(value['parentPid'], original)
    outcome = 'failed'
    try:
        result = run(installer_command(installer, directory), check=False)
        if result.returncode == 0:
            outcome = 'installed'
        else:
            raise RuntimeError('Installer was cancelled or failed')
    except Exception:
        try:
            restore_program(directory, backup, files, hashes)
            outcome = 'restored'
        except Exception:
            outcome = 'rollback-failed'
    report = {'status': outcome}
    if outcome == 'rollback-failed':
        report.update(backupPath=str(backup), error='The original installation could not be fully restored. The preserved program copy is being opened; user projects and settings remain in their existing location.')
    # Record the failure independently of launching recovery, so even a failed
    # program launch leaves an actionable record beside the preserved files.
    report_error = None
    try:
        filesystem_path(path.parent / 'result.json').write_text(json.dumps(report), encoding='utf-8')
    except OSError as error:
        report_error = error
    restart = backup / 'Figure Studio.exe' if outcome == 'rollback-failed' else original
    launch([str(restart)], cwd=str(restart.parent), close_fds=True)
    if report_error:
        raise OSError('The update result could not be written. Preserved program: ' + str(backup)) from report_error
    return outcome

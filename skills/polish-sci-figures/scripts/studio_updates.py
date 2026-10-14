"""Bounded public release checks. Never accepts URLs, credentials or project data."""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
import platform
import re
import threading
import time
from datetime import datetime, timezone
from urllib.request import Request, build_opener, HTTPRedirectHandler

STUDIO_VERSION = '0.1.11'
SUITE_VERSION = '1.4.11'
REPOSITORY = 'https://github.com/zhoy0409-debug/polish-sci-figures'
RELEASES_URL = REPOSITORY + '/releases'
API_URL = 'https://api.github.com/repos/zhoy0409-debug/polish-sci-figures/releases?per_page=30'
CACHE_SECONDS = 24 * 60 * 60
TIMEOUT_SECONDS = 5
MAX_RESPONSE = 2_000_000
VERSION_RE = r'(?:0|[1-9][0-9]{0,4})\.(?:0|[1-9][0-9]{0,4})\.(?:0|[1-9][0-9]{0,4})'
TAG_RE = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]{0,99}')
ASSET_RE = re.compile(rf'polish-sci-figures-Studio-({VERSION_RE})-(Setup-x64\.exe|macOS-(arm64|x86_64)-Preview\.zip|Android-preview\.apk)')


def version_tuple(value):
    if not isinstance(value, str) or not re.fullmatch(VERSION_RE, value):
        raise ValueError('Invalid application version')
    return tuple(map(int, value.split('.')))


def installation_info(suite_root=None, *, system=None, machine=None):
    """Read package identity, independently of a browser's OS/user agent."""
    system = system or platform.system()
    machine = (machine or platform.machine()).lower()
    architecture = 'arm64' if machine in ('arm64', 'aarch64') else 'x86_64' if machine in ('amd64', 'x86_64') else 'unknown'
    current = {'currentVersion': STUDIO_VERSION, 'suiteVersion': SUITE_VERSION,
               'platform': {'Windows': 'windows', 'Darwin': 'macos'}.get(system, 'browser'),
               'architecture': architecture, 'channel': 'preview' if system == 'Darwin' else 'stable'}
    if suite_root:
        try:
            path = Path(suite_root) / 'build-info.json'
            if path.stat().st_size > 16_384:
                raise ValueError('Package metadata limit')
            build = json.loads(path.read_text(encoding='utf-8'))
            version_tuple(build['version'])
            packaged = build.get('platform', '')
            expected = {'windows-x86_64': ('windows', 'x86_64'),
                        'macos-arm64': ('macos', 'arm64'), 'macos-x86_64': ('macos', 'x86_64')}
            if packaged not in expected:
                raise ValueError('Unknown package platform')
            current.update(currentVersion=build['version'], platform=expected[packaged][0], architecture=expected[packaged][1])
            current['channel'] = 'preview' if build.get('distribution') == 'ci-preview' or current['platform'] == 'macos' else 'stable'
            suite = build.get('suiteVersion', SUITE_VERSION).removeprefix('v')
            version_tuple(suite)
            current['suiteVersion'] = suite
        except (OSError, ValueError, KeyError, TypeError, AttributeError):
            pass
    return current


def asset_platform(match):
    suffix = match.group(2)
    if suffix == 'Setup-x64.exe':
        return 'windows', 'x86_64'
    if suffix.startswith('macOS-'):
        return 'macos', match.group(3)
    return 'android', 'universal'


def published_time(value):
    if not isinstance(value, str) or len(value) > 40:
        raise ValueError('Invalid release time')
    date = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if date.tzinfo is None:
        raise ValueError('Release time requires a timezone')
    return date.timestamp()


def choose_release(releases, current):
    version_tuple(current['currentVersion'])
    if current.get('channel') not in ('stable', 'preview'):
        raise ValueError('Unknown release channel')
    if not isinstance(releases, list) or len(releases) > 30:
        raise ValueError('Invalid release response')
    candidates = []
    for release in releases:
        if not isinstance(release, dict) or release.get('draft') is not False or type(release.get('prerelease')) is not bool:
            continue
        if current['channel'] == 'stable' and release['prerelease']:
            continue
        tag = release.get('tag_name')
        if not isinstance(tag, str) or not TAG_RE.fullmatch(tag) or release.get('html_url') != RELEASES_URL + '/tag/' + tag:
            continue
        try:
            stamp = published_time(release.get('published_at'))
        except (ValueError, TypeError, OverflowError):
            continue
        assets = release.get('assets')
        if not isinstance(assets, list) or len(assets) > 100:
            continue
        for asset in assets:
            if not isinstance(asset, dict) or asset.get('state') != 'uploaded' or type(asset.get('size')) is not int or not 0 < asset['size'] <= 2_000_000_000:
                continue
            name = asset.get('name')
            match = ASSET_RE.fullmatch(name) if isinstance(name, str) else None
            if not match:
                continue
            target, architecture = asset_platform(match)
            if target != current.get('platform') or (architecture != 'universal' and architecture != current.get('architecture')):
                continue
            # A preview-named package is never promoted to a stable install.
            if current['channel'] == 'stable' and ('Preview' in name or 'preview' in name):
                continue
            url = RELEASES_URL + '/download/' + tag + '/' + name
            if asset.get('browser_download_url') != url:
                continue
            candidate = {'latestVersion': match.group(1), 'releaseUrl': release['html_url'],
                         'downloadUrl': url, 'assetName': name, 'assetBytes': asset['size'],
                         'releaseTag': tag, 'prerelease': release['prerelease']}
            digest = asset.get('digest')
            if isinstance(digest, str) and re.fullmatch(r'sha256:[0-9a-fA-F]{64}', digest):
                candidate['assetSha256'] = digest[7:].lower()
            candidates.append((version_tuple(match.group(1)), stamp, candidate))
    if not candidates:
        return {'status': 'unavailable', 'reason': 'no-installer', 'releaseUrl': RELEASES_URL}
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    candidate = candidates[0][2]
    candidate['status'] = 'update-available' if version_tuple(candidate['latestVersion']) > version_tuple(current['currentVersion']) else 'up-to-date'
    return candidate


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Release metadata redirects are not allowed')


def fetch_releases():
    # No auth handler, cookie jar, request body, installed paths or version
    # identifiers are sent. The same fixed public GET is used on every install.
    request = Request(API_URL, headers={'Accept': 'application/vnd.github+json',
                                      'User-Agent': 'Figure-Studio-Update-Check',
                                      'X-GitHub-Api-Version': '2022-11-28'}, method='GET')
    started = time.monotonic()
    with build_opener(NoRedirect()).open(request, timeout=TIMEOUT_SECONDS) as response:
        if response.status != 200 or response.geturl() != API_URL:
            raise ValueError('Unexpected release metadata response')
        size = response.headers.get('Content-Length')
        if size and (not size.isdigit() or int(size) > MAX_RESPONSE):
            raise ValueError('Release metadata limit')
        chunks, total = [], 0
        while True:
            if time.monotonic() - started > TIMEOUT_SECONDS * 2:
                raise TimeoutError('Release metadata timed out')
            chunk = response.read(min(65_536, MAX_RESPONSE + 1 - total))
            if not chunk:
                break
            chunks.append(chunk)
            total += len(chunk)
            if total > MAX_RESPONSE:
                raise ValueError('Release metadata limit')
    value = json.loads(b''.join(chunks))
    if not isinstance(value, list) or len(value) > 30:
        raise ValueError('Invalid release response')
    return value


class UpdateChecker:
    def __init__(self, current, cache_path=None, *, fetcher=fetch_releases, clock=time.time):
        version_tuple(current['currentVersion'])
        self.current = dict(current)
        self.cache_path = Path(cache_path) if cache_path else None
        self.fetcher, self.clock = fetcher, clock
        self.lock = threading.Lock()
        self.cached = None
        self.failed_at = None
        if self.cache_path:
            try:
                if self.cache_path.stat().st_size > 32_768:
                    raise ValueError('Cache limit')
                cached = json.loads(self.cache_path.read_text(encoding='utf-8'))
                if cached.get('current') == self.current and self._valid_cached(cached):
                    self.cached = cached
            except (OSError, ValueError, TypeError):
                pass

    def _valid_cached(self, cached):
        if not isinstance(cached, dict) or not isinstance(cached.get('offer'), dict) or type(cached.get('checkedAt')) not in (int, float) or not math.isfinite(cached['checkedAt']) or cached['checkedAt'] < 0 or cached['checkedAt'] > self.clock() + 300:
            return False
        offer = cached['offer']
        if offer == {'status': 'unavailable', 'reason': 'no-installer', 'releaseUrl': RELEASES_URL}:
            return True
        # Re-run exactly the public-release validation for persisted links.
        release = {'draft': False, 'prerelease': offer.get('prerelease'), 'tag_name': offer.get('releaseTag'),
                   'published_at': '2026-01-01T00:00:00Z', 'html_url': offer.get('releaseUrl'),
                   'assets': [{'state': 'uploaded', 'name': offer.get('assetName'), 'size': offer.get('assetBytes'),
                               'browser_download_url': offer.get('downloadUrl'),
                               'digest': 'sha256:' + offer['assetSha256'] if isinstance(offer.get('assetSha256'), str) else None}]}
        return choose_release([release], self.current) == offer

    def _response(self, offer, *, cached=False, stale=False, checked_at=None, reason=None):
        value = {**self.current, **offer, 'cached': cached, 'stale': stale}
        if checked_at is not None:
            value['checkedAt'] = datetime.fromtimestamp(checked_at, timezone.utc).isoformat().replace('+00:00', 'Z')
        if reason:
            value['reason'] = reason
        return value

    def check(self, *, refresh=False):
        if type(refresh) is not bool:
            raise ValueError('Refresh must be a boolean')
        now = self.clock()
        if not self.lock.acquire(blocking=False):
            if self.cached:
                return self._response(self.cached['offer'], cached=True, stale=now-self.cached['checkedAt'] >= CACHE_SECONDS, checked_at=self.cached['checkedAt'], reason='checking')
            return self._response({'status': 'unavailable', 'releaseUrl': RELEASES_URL}, reason='checking')
        try:
            if self.cached and not refresh and now - self.cached['checkedAt'] < CACHE_SECONDS:
                return self._response(self.cached['offer'], cached=True, checked_at=self.cached['checkedAt'])
            if self.failed_at is not None and not refresh and now-self.failed_at < CACHE_SECONDS:
                if self.cached:
                    return self._response(self.cached['offer'], cached=True, stale=True, checked_at=self.cached['checkedAt'], reason='offline')
                return self._response({'status': 'offline', 'releaseUrl': RELEASES_URL}, reason='check-failed')
            try:
                offer = choose_release(self.fetcher(), self.current)
            except Exception:
                # No network exception messages/paths are echoed into the UI.
                self.failed_at = now
                if self.cached:
                    return self._response(self.cached['offer'], cached=True, stale=True, checked_at=self.cached['checkedAt'], reason='offline')
                return self._response({'status': 'offline', 'releaseUrl': RELEASES_URL}, reason='check-failed')
            self.failed_at = None
            self.cached = {'current': self.current, 'offer': offer, 'checkedAt': now}
            if self.cache_path:
                temporary = self.cache_path.with_suffix('.tmp')
                try:
                    self.cache_path.parent.mkdir(parents=True, exist_ok=True)
                    temporary.write_text(json.dumps(self.cached, ensure_ascii=True), encoding='utf-8')
                    os.replace(temporary, self.cache_path)
                except OSError:
                    pass
                finally:
                    try:
                        temporary.unlink(missing_ok=True)
                    except OSError:
                        pass
            return self._response(offer, checked_at=now)
        finally:
            self.lock.release()

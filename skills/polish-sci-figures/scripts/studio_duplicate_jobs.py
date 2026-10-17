"""Bounded in-memory image checks, independent of the plotting lock."""
from __future__ import annotations

import copy
import secrets
import threading
import time


class DuplicateJobs:
    def __init__(self, scanner=None):
        self.scanner = scanner
        self.lock = threading.RLock()
        self.jobs = {}
        self.cache = None

    def request(self, payload):
        if not isinstance(payload, dict):
            raise ValueError('Image check request must be an object')
        action = payload.get('action')
        if action == 'start':
            if set(payload) != {'action', 'images'}:
                raise ValueError('Start requires action and images')
            images = payload['images']
            if not isinstance(images, list) or not 2 <= len(images) <= 60:
                raise ValueError('Choose 2–60 raster images / 请选择 2–60 张图片')
            total = 0
            for item in images:
                if not isinstance(item, dict) or not {'id', 'label', 'data'} <= set(item):
                    raise ValueError('Each image requires id, label and data')
                if not isinstance(item['data'], str):
                    raise ValueError('Image data must be a raster data URL')
                total += len(item['data'])
            if total > 40_000_000:
                raise ValueError('Image check limit: 40 MB encoded / 本批图片超过 40 MB')
            with self.lock:
                now = time.monotonic()
                self.jobs = {k: v for k, v in self.jobs.items()
                             if v['status'] == 'running' or now - v['updated'] < 900}
                if any(v['status'] == 'running' for v in self.jobs.values()):
                    raise ValueError('An image check is already running; cancel it first / 已有查重任务，请先取消')
                # Keep only the most recent completed report plus this job.
                if self.jobs:
                    latest = max(self.jobs, key=lambda k: self.jobs[k]['updated'])
                    self.jobs = {latest: self.jobs[latest]}
                job_id = secrets.token_urlsafe(24)
                self.jobs[job_id] = {'status': 'running', 'progress': {'stage': 'preparing', 'completed': 0, 'total': len(images)},
                                     'cancel': threading.Event(), 'updated': now}
                threading.Thread(target=self._run, args=(job_id, images), daemon=True,
                                 name='image-duplicate-check').start()
                return {'jobId': job_id}
        if action not in {'status', 'cancel'} or set(payload) != {'action', 'jobId'}:
            raise ValueError('Expected start, status or cancel')
        job_id = payload['jobId']
        if not isinstance(job_id, str) or len(job_id) > 100:
            raise ValueError('Invalid image check ID')
        with self.lock:
            job = self.jobs.get(job_id)
            if job is None or (job['status'] != 'running' and time.monotonic() - job['updated'] >= 900):
                self.jobs.pop(job_id, None)
                raise ValueError('Image check expired; run it again / 查重记录已过期，请重新检查')
            if action == 'cancel' and job['status'] == 'running':
                job['cancel'].set()
            return {k: v for k, v in job.items() if k not in {'cancel', 'updated'}}

    def _run(self, job_id, images):
        def progress(value):
            with self.lock:
                self.jobs[job_id]['progress'] = copy.deepcopy(value)

        job = self.jobs[job_id]
        try:
            if self.scanner is None:
                from studio_duplicates import ScreeningCache, scan_images
                if self.cache is None:
                    self.cache = ScreeningCache()
                result = scan_images(images, progress=progress, cancelled=job['cancel'].is_set, cache=self.cache)
            else:
                result = self.scanner(images, progress=progress, cancelled=job['cancel'].is_set)
            with self.lock:
                if job['cancel'].is_set():
                    job['status'] = 'cancelled'
                else:
                    job.update(status='complete', result=result)
        except Exception as exc:
            with self.lock:
                if job['cancel'].is_set() or type(exc).__name__ == 'ScanCancelled':
                    job['status'] = 'cancelled'
                else:
                    job.update(status='error', error=str(exc))
        finally:
            with self.lock:
                job['updated'] = time.monotonic()


JOBS = DuplicateJobs()

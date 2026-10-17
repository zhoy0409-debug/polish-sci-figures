"""Process-local reuse of validated statistics during visual data re-rendering.

No files or network are used. Every observation, design/config field and recipe
field participates in the key except axis_settings, which analyze does not read.
Explicit /api/analyze remains a fresh analysis; this cache serves render only.
"""
from __future__ import annotations

from collections import OrderedDict
from copy import deepcopy
import hashlib
import json
import threading
import time


class RenderStatisticsCache:
    def __init__(self, max_entries=24, max_bytes=8 * 1024 * 1024, ttl=300, clock=time.monotonic):
        self.max_entries = max_entries
        self.max_bytes = max_bytes
        self.ttl = ttl
        self.clock = clock
        self.entries = OrderedDict()
        self.bytes = 0
        self.lock = threading.RLock()

    @staticmethod
    def key(recipe, rows, config):
        statistical_recipe = {key: value for key, value in recipe.items() if key != 'axis_settings'}
        raw = json.dumps([statistical_recipe, rows, config], ensure_ascii=False,
                         sort_keys=True, separators=(',', ':'), allow_nan=False).encode('utf-8')
        return hashlib.sha256(raw).digest()

    def analyze(self, recipe, rows, config, producer):
        key = self.key(recipe, rows, config)
        with self.lock:
            now = self.clock()
            for expired in [key for key, (at, _, _) in self.entries.items() if now - at >= self.ttl]:
                self.bytes -= self.entries.pop(expired)[1]
            if key in self.entries:
                at, size, result = self.entries.pop(key)
                self.entries[key] = (at, size, result)
                return deepcopy(result)
            # Exceptions are never cached, and no previous result is substituted.
            result = producer(recipe, rows, config)
            size = len(json.dumps(result, ensure_ascii=False, allow_nan=False).encode('utf-8'))
            if 0 < self.max_entries and size <= self.max_bytes:
                while self.entries and (len(self.entries) >= self.max_entries or self.bytes + size > self.max_bytes):
                    self.bytes -= self.entries.popitem(last=False)[1][1]
                self.entries[key] = (now, size, deepcopy(result))
                self.bytes += size
            return result


RENDER_STATISTICS = RenderStatisticsCache()


def analyze_for_render(recipe, rows, config):
    from studio_statistics import analyze
    return RENDER_STATISTICS.analyze(recipe, rows, config, analyze)

"""Cache correctness/privacy/bounds; does not assert real-image accuracy."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_image_duplicates import duplicate, item, raster


class CacheTests(unittest.TestCase):
    def test_recheck_reuses_pairs_and_features_without_stale_ids_or_mutation(self):
        source = raster(24)
        crop = source.crop((60, 40, 410, 310))
        cache = duplicate.ScreeningCache()
        records = [item('old-source', source), item('old-crop', crop), item('negative', raster(25))]
        first = duplicate.scan_images(records, cache=cache)
        self.assertEqual(len(first['matches']), 1)
        records[0]['id'], records[0]['label'] = 'new-source', 'new label'
        with patch.object(duplicate, '_candidate', side_effect=AssertionError('pair recomputed')):
            second = duplicate.scan_images(records, cache=cache)
        self.assertEqual(second['matches'][0]['a'], 'new-source')
        self.assertEqual(second['images'][0]['label'], 'new label')
        self.assertEqual(first['matches'][0]['a'], 'old-source')
        self.assertEqual(second['matches'][0]['transformAtoB'], first['matches'][0]['transformAtoB'])
        self.assertTrue(all('data:image' not in str(k) for k in cache.entries))
        self.assertNotIn('old-source', repr(cache.entries))
        self.assertNotIn('new label', repr(cache.entries))
        self.assertLessEqual(cache.bytes, cache.max_bytes)
        changed = [item('a', source), item('b', raster(26))]
        with patch.object(duplicate, '_candidate', wraps=duplicate._candidate) as candidate:
            duplicate.scan_images(changed, cache=cache)
            self.assertGreater(candidate.call_count, 0)

    def test_negative_entry_expiry_clear_and_memory_bounds(self):
        now = [0.]
        cache = duplicate.ScreeningCache(max_bytes=10_000, max_entries=2, ttl_seconds=2, clock=lambda: now[0])
        cache.put(('pair', 'a', 'b'), None)
        self.assertEqual(cache.get(('pair', 'a', 'b')), (True, None))
        cache.put('second', {'values': [1]})
        cache.put('third', {'values': [2]})
        self.assertEqual(cache.get(('pair', 'a', 'b')), (False, None))
        found, value = cache.get('second')
        value['values'][0] = 55
        self.assertEqual(cache.get('second')[1]['values'], [1])
        now[0] = 3
        self.assertEqual(cache.get('second'), (False, None))
        self.assertEqual(cache.bytes, 0)
        cache.put('large', 'x'*40_000)
        self.assertEqual(cache.bytes, 0)
        cache.put('small', None)
        cache.clear()
        self.assertEqual(cache.bytes, 0)
        self.assertEqual(len(cache.entries), 0)

    def test_cancelled_warm_scan_never_returns_complete(self):
        records = [item('a', raster(50)), item('b', raster(51))]
        cache = duplicate.ScreeningCache()
        duplicate.scan_images(records, cache=cache)
        with self.assertRaises(duplicate.ScanCancelled):
            duplicate.scan_images(records, cache=cache, cancelled=lambda: True)


if __name__ == '__main__':
    unittest.main(verbosity=2)

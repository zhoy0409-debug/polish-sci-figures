"""Real analysis reuse during rendering, plus cache isolation/bounds regressions."""
from __future__ import annotations
import copy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/polish-sci-figures/scripts'))
sys.path.insert(0, str(ROOT / 'skills/make-sci-data-figures/scripts'))
from studio_render_statistics import RenderStatisticsCache
from studio_statistics import analyze
import studio_render_statistics
import studio_server

ROWS = [['group', 'value'], ['A', '1'], ['A', '2'], ['A', '4'], ['B', '2'], ['B', '5'], ['B', '7']]
CONFIG = {'mode':'raw','group':'group','value':'value','unit':'','unit_mode':'row',
          'design':'independent','method':'welch','goal':'mean','family':'all_pairs',
          'design_confirmed':True,'unit_role':'independent_experimental_unit','outcome_type':'continuous'}


class Tests(unittest.TestCase):
    def test_real_analysis_reused_only_across_axis_changes(self):
        cache = RenderStatisticsCache(); calls = []
        def produce(*args):
            calls.append(1); return analyze(*args)
        rows = copy.deepcopy(ROWS); config = copy.deepcopy(CONFIG)
        a = cache.analyze({'axis_settings':{'y_max':10}}, rows, config, produce)
        b = cache.analyze({'axis_settings':{'y_max':20}}, rows, config, produce)
        self.assertEqual(a, b); self.assertEqual(len(calls), 1)
        self.assertEqual(rows, ROWS); self.assertEqual(config, CONFIG)
        self.assertEqual(a['data_sha256'], analyze({}, ROWS, CONFIG)['data_sha256'])
        b['analysis']['primary_test']['pairwise'][0]['p'] = .9
        c = cache.analyze({}, rows, config, produce)
        self.assertEqual(c, a); self.assertEqual(len(calls), 1)

    def test_every_measurement_design_and_recipe_field_participates(self):
        cache = RenderStatisticsCache(); calls = []
        def produce(*args): calls.append(1); return {'measurement':len(calls)}
        cache.analyze({}, ROWS, CONFIG, produce)
        changed = copy.deepcopy(ROWS); changed[1][1] = '1.0000000000001'
        cache.analyze({}, changed, CONFIG, produce)
        cache.analyze({}, ROWS, {**CONFIG,'method':'mannwhitney'}, produce)
        cache.analyze({'design':'paired'}, ROWS, CONFIG, produce)
        cache.analyze({'parameters':{'view':'other'}}, ROWS, CONFIG, produce)
        self.assertEqual(len(calls), 5)
        self.assertTrue(all(isinstance(key, bytes) and len(key)==32 for key in cache.entries))

    def test_failures_never_return_previous_results_or_enter_cache(self):
        cache = RenderStatisticsCache(); good = cache.analyze({}, ROWS, CONFIG, analyze)
        invalid = {**CONFIG,'design_confirmed':False}
        for _ in range(2):
            with self.assertRaises(ValueError): cache.analyze({}, ROWS, invalid, analyze)
        self.assertEqual(len(cache.entries), 1)
        self.assertEqual(cache.analyze({}, ROWS, CONFIG, analyze), good)

    def test_ttl_lru_and_encoded_size_bounds(self):
        now = [0]; calls = []
        cache = RenderStatisticsCache(max_entries=2, max_bytes=100, ttl=10, clock=lambda:now[0])
        def produce(*args): calls.append(1); return {'value':len(calls)}
        for n in [1,2,1,3]: cache.analyze({'n':n}, [], {}, produce)
        self.assertEqual(len(calls), 3); self.assertEqual(len(cache.entries), 2)
        cache.analyze({'n':2}, [], {}, produce); self.assertEqual(len(calls), 4)
        now[0] = 11; cache.analyze({'n':2}, [], {}, produce); self.assertEqual(len(calls), 5)
        self.assertLessEqual(cache.bytes, 100)
        oversized = RenderStatisticsCache(max_bytes=2)
        oversized.analyze({}, [], {}, lambda *_:{'large':'x'*200})
        self.assertEqual(oversized.bytes, 0); self.assertFalse(oversized.entries)

    def test_render_uses_same_real_full_precision_results_without_reanalysis(self):
        cache = RenderStatisticsCache(); calls = []
        recipe = {'family':'gallery','parameters':{'view':'compare_box_points'},
                  'input':'cache-engineering-only.csv'}
        rows = [['group','unit','value']] + [[row[0],row[0]+str(index),row[1]] for index,row in enumerate(ROWS[1:])]
        config = {**CONFIG, 'unit':'unit', 'unit_mode':'column'}
        before = copy.deepcopy((recipe,rows,config))
        def produce(*args): calls.append(1); return analyze(*args)
        temporary = ROOT / '.cache/render-statistics-test-tmp'
        temporary.mkdir(parents=True, exist_ok=True)
        with patch.object(studio_server.tempfile, 'tempdir', str(temporary)), patch.object(studio_render_statistics, 'RENDER_STATISTICS', cache), patch('studio_statistics.analyze', side_effect=produce):
            a = studio_server.regenerate(recipe, rows, config, {'y_max':10})
            b = studio_server.regenerate(recipe, rows, config, {'y_max':20})
        self.assertEqual(len(calls), 1)
        self.assertEqual(a['statistics'], b['statistics'])
        self.assertEqual(a['table']['sha256'], b['table']['sha256'])
        self.assertEqual((recipe,rows,config), before)
        self.assertEqual(a['statistics'], analyze(recipe, rows, config))
        self.assertNotEqual(a['variants'][0]['svg'], b['variants'][0]['svg'])


if __name__ == '__main__': unittest.main()

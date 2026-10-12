"""Method, result-import, local HTTP and data-revision regression checks."""
from __future__ import annotations
import copy
import csv
import http.client
import io
import json
import math
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
TEST_TMP = (ROOT / '.cache/statistics-test-tmp').resolve()
assert TEST_TMP.is_relative_to(ROOT.resolve())
TEST_TMP.mkdir(parents=True, exist_ok=True)
tempfile.tempdir = str(TEST_TMP)
sys.path.insert(0, str(ROOT / 'skills/polish-sci-figures/scripts'))
from studio_statistics import analyze, holm, recommendations, table_hash
from studio_server import Handler, ThreadingHTTPServer, regenerate

BASE = {'mode': 'raw', 'group': 'group', 'value': 'value', 'unit': 'unit',
        'design': 'independent', 'method': 'welch', 'family': 'all_pairs',
        'design_confirmed': True, 'unit_role': 'independent_experimental_unit'}


def rows_for(values, paired=False):
    return [['group', 'unit', 'value']] + [[name, f'U{i}' if paired else f'{name}{i}', str(v)]
            for name, values in values.items() for i, v in enumerate(values)]


def comparisons(result):
    return result['analysis']['primary_test']['pairwise']


class StatisticalMethods(unittest.TestCase):
    def test_confirmed_row_units_without_ids_preserve_rows(self):
        rows = [['group', 'value'], ['A', '1'], ['A', '2'], ['A', '4'],
                ['B', '2'], ['B', '5'], ['B', '7']]
        original = copy.deepcopy(rows)
        config = {**BASE, 'unit': '', 'unit_mode': 'row', 'outcome_type': 'continuous'}
        result = analyze({}, rows, config)
        self.assertAlmostEqual(comparisons(result)[0]['p'], stats.ttest_ind([1, 2, 4], [2, 5, 7], equal_var=False).pvalue)
        self.assertEqual(result['analysis']['experimental_unit_mode'], 'row')
        self.assertIsNone(result['analysis']['experimental_unit_column'])
        self.assertEqual(rows, original)
        self.assertEqual(result['data_sha256'], table_hash(rows))
        for changes in ({'design_confirmed': False}, {'design': 'paired', 'method': 'paired_t'}):
            with self.assertRaises(ValueError):
                analyze({}, rows, {**config, **changes})

    def test_outcome_type_is_not_silently_forced_into_mean_tests(self):
        rows = rows_for({'A': [1, 2, 3], 'B': [2, 4, 5]})
        for kind in ('binary', 'count', 'survival', 'categorical', 'ordinal'):
            with self.assertRaises(ValueError):
                analyze({}, rows, {**BASE, 'outcome_type': kind})
        result = analyze({}, rows, {**BASE, 'outcome_type': 'ordinal', 'method': 'mannwhitney', 'goal': 'distribution'})
        self.assertEqual(result['analysis']['outcome_type'], 'ordinal')

    def test_welch_mean_ci_and_source_integrity(self):
        x, y = [1, 2, 4, 5, 8], [2, 4, 6, 9, 11, 14]
        rows = rows_for({'A': x, 'B': y}); original = copy.deepcopy(rows)
        result = analyze({}, rows, BASE); pair = comparisons(result)[0]
        expected = stats.ttest_ind(y, x, equal_var=False)
        self.assertAlmostEqual(pair['p'], expected.pvalue)
        self.assertAlmostEqual(pair['estimate'], np.mean(y) - np.mean(x))
        self.assertAlmostEqual(pair['ci95'][0], expected.confidence_interval().low)
        self.assertEqual(rows, original)
        self.assertEqual(result['data_sha256'], table_hash(rows))
        self.assertEqual(pair['ci_scope'], 'unadjusted pairwise 95% CI')

    def test_holm_known_values_and_control_family(self):
        self.assertEqual(holm([.01, .04, .03, .002]), [.03, .06, .06, .008])
        rows = rows_for({'A': [1, 2, 4], 'B': [2, 4, 6], 'C': [3, 8, 9]})
        result = analyze({}, rows, {**BASE, 'family': 'control', 'control': 'B'})
        pairs = comparisons(result)
        self.assertEqual([(p['group_a'], p['group_b']) for p in pairs], [('B', 'A'), ('B', 'C')])
        self.assertEqual([p['p'] for p in pairs], holm(p['p_raw'] for p in pairs))

    def test_paired_identity_decimal_differences(self):
        rows = rows_for({'A': [.5, .825, .375, .5], 'B': [.525, .775, .325, .55]}, paired=True)
        config = {**BASE, 'design': 'paired', 'method': 'paired_t', 'order': ['A', 'B']}
        expected = stats.ttest_1samp([.025, -.05, -.05, .05], 0)
        for ordered in (rows, [rows[0]] + list(reversed(rows[1:]))):
            result = comparisons(analyze({}, ordered, config))[0]
            self.assertAlmostEqual(result['p'], expected.pvalue)
            self.assertAlmostEqual(result['estimate'], -.00625)

    def test_mannwhitney_exact_distribution_and_ties(self):
        rows = rows_for({'A': [19, 22, 16, 29, 24], 'B': [20, 11, 17, 12]})
        pair = comparisons(analyze({}, rows, {**BASE, 'method': 'mannwhitney'}))[0]
        self.assertAlmostEqual(pair['p'], 1 / 9)
        self.assertEqual(pair['p_method'], 'exact')
        self.assertIn('Pr(group_b', pair['estimand'])
        tied = rows_for({'A': [1, 1, 2], 'B': [2, 3, 3]})
        first = analyze({}, tied, {**BASE, 'method': 'mannwhitney'})
        second = analyze({}, tied, {**BASE, 'method': 'mannwhitney'})
        expected = stats.mannwhitneyu([2, 3, 3], [1, 1, 2], method=stats.PermutationMethod(n_resamples=9999, rng=np.random.default_rng(18731)))
        self.assertAlmostEqual(comparisons(first)[0]['p'], expected.pvalue)
        self.assertEqual(first, second)
        self.assertIn('permutation', comparisons(first)[0]['p_method'])

    def test_wilcoxon_exact_and_decimal_ties(self):
        differences = [6, 8, 14, 16, 23, 24, 28, 29, 41, -48, 49, 56, 60, -67, 75]
        x = np.arange(1, 16)
        rows = rows_for({'A': x, 'B': x + differences}, paired=True)
        config = {**BASE, 'design': 'paired', 'method': 'wilcoxon'}
        pair = comparisons(analyze({}, rows, config))[0]
        self.assertAlmostEqual(pair['p'], .041259765625)
        self.assertEqual(pair['p_method'], 'exact')
        tied = rows_for({'A': [.5, .825, .375, .5], 'B': [.525, .775, .325, .55]}, paired=True)
        result = comparisons(analyze({}, tied, config))[0]
        reference = stats.wilcoxon([.025, -.05, -.05, .05], method=stats.PermutationMethod(n_resamples=9999, rng=np.random.default_rng(18731)))
        self.assertAlmostEqual(result['p'], reference.pvalue)
        self.assertIn('permutation', result['p_method'])

    def test_seeded_rank_inference_is_invariant_to_table_order(self):
        rows = rows_for({'A': [1, 1, 2, 2, 3, 3, 4, 4], 'B': [2, 2, 3, 3, 4, 4, 5, 5, 6, 6]})
        config = {**BASE, 'method': 'mannwhitney'}
        expected = comparisons(analyze({}, rows, config))[0]
        for ordered in ([rows[0]] + rows[:0:-1], [rows[0]] + rows[1::2] + rows[2::2]):
            pair = comparisons(analyze({}, ordered, config))[0]
            self.assertEqual(pair['p'], expected['p'])
            self.assertEqual(pair['p_raw'], expected['p_raw'])
        paired = rows_for({'A': list(range(18)), 'B': [i + (i % 3 - .5) for i in range(18)]}, paired=True)
        pc = {**BASE, 'design': 'paired', 'method': 'wilcoxon', 'order': ['A', 'B']}
        before = comparisons(analyze({}, paired, pc))[0]
        after = comparisons(analyze({}, [paired[0]] + paired[:0:-1], pc))[0]
        self.assertEqual(before, after)

    def test_small_sample_permutation_work_is_bounded(self):
        rows = rows_for({'A': [1, 1, 2], 'B': [2, 3, 3]})
        with patch('studio_statistics.MAX_PERMUTATION_WORK', 100), self.assertRaisesRegex(ValueError, 'computation limit'):
            analyze({}, rows, {**BASE, 'method': 'mannwhitney'})

    def test_invalid_units_methods_values_constants(self):
        rows = rows_for({'A': [1, 2, 4], 'B': [2, 4, 6]})
        for change in ({'design_confirmed': False}, {'unit_role': 'technical_replicate'},
                       {'method': 'paired_t'}, {'value': 'unit'}, {'unexpected': 1}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                analyze({}, rows, {**BASE, **change})
        for value in ('', 'NA', 'NaN', 'inf', '-inf', 'word'):
            edited = copy.deepcopy(rows); edited[1][-1] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                analyze({}, edited, BASE)
        duplicate = rows + [rows[1][:]]
        with self.assertRaises(ValueError): analyze({}, duplicate, BASE)
        constant = rows_for({'A': [1, 1], 'B': [2, 2]})
        with self.assertRaises(ValueError): analyze({}, constant, BASE)
        paired = rows_for({'A': [1, 2, 3], 'B': [2, 3, 4]}, paired=True)
        with self.assertRaises(ValueError): analyze({}, paired, {**BASE, 'design': 'paired', 'method': 'paired_t'})
        with self.assertRaises(ValueError): analyze({}, paired[:-1], {**BASE, 'design': 'paired', 'method': 'wilcoxon'})

    def test_recommendations_depend_on_design_and_goal_not_p(self):
        self.assertEqual(recommendations('independent')[0]['method'], 'welch')
        self.assertEqual(recommendations('independent', 'distribution')[0]['method'], 'mannwhitney')
        self.assertEqual(recommendations('paired')[0]['method'], 'paired_t')
        self.assertEqual(recommendations('paired', 'distribution')[0]['method'], 'wilcoxon')
        self.assertEqual(recommendations('unknown'), [])

    def test_pca_filter_is_explicit_and_provenance_recorded(self):
        rows = [['role', 'group', 'unit', 'value'], ['score', 'A', 'A1', '1'], ['score', 'A', 'A2', '2'],
                ['score', 'B', 'B1', '4'], ['score', 'B', 'B2', '6'], ['loading', 'A', 'gene1', '100']]
        recipe = {'family': 'gallery', 'parameters': {'view': 'pca_loadings'}}
        with self.assertRaises(ValueError): analyze(recipe, rows, BASE)
        result = analyze(recipe, rows, {**BASE, 'filter_column': 'role', 'filter_value': 'score'})
        self.assertEqual(result['analysis']['rows_used'], 4)
        self.assertEqual(result['analysis']['rows_filtered_out'], 1)
        self.assertIn('not overall PCA', result['analysis']['diagnostics'][-1]['en'])


class ImportedResults(unittest.TestCase):
    config = {'mode': 'results', 'group_a': 'a', 'group_b': 'b', 'p_value': 'p',
              'method_label': 'Supplied model contrasts', 'adjustment': 'holm',
              'family': 'all_pairs', 'results_confirmed': True}
    rows = [['a', 'b', 'p'], ['A', 'B', '.01'], ['A', 'C', '.03'], ['B', 'C', '.2']]

    def test_raw_and_adjusted_import(self):
        result = analyze({}, self.rows, self.config)
        self.assertEqual([p['p'] for p in comparisons(result)], [.03, .06, .2])
        adjusted = analyze({}, self.rows, {**self.config, 'adjustment': 'already_adjusted', 'correction_method': 'Tukey'})
        self.assertEqual([p['p'] for p in comparisons(adjusted)], [.01, .03, .2])
        self.assertTrue(all('p_raw' not in p for p in comparisons(adjusted)))

    def test_incomplete_duplicate_or_unconfirmed_import_rejected(self):
        for rows, config in ((self.rows[:-1], self.config), (self.rows + [self.rows[1]], self.config),
                             (self.rows, {**self.config, 'results_confirmed': False}),
                             (self.rows, {**self.config, 'adjustment': 'none'}),
                             (self.rows, {**self.config, 'adjustment': 'already_adjusted'})):
            with self.subTest(rows=rows, config=config), self.assertRaises(ValueError):
                analyze({}, rows, config)
        one = analyze({}, self.rows[:2], {**self.config, 'adjustment': 'none'})
        self.assertEqual(comparisons(one)[0]['p'], .01)


class LocalEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='studio-statistics-http-')
        cls.page = Path(cls.tmp.name) / 'index.html'; cls.page.write_text('<html><head></head><body>QA</body></html>')
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.server.address = f'127.0.0.1:{cls.server.server_port}'
        cls.server.token = 'qa-token'; cls.server.page = cls.page
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join(timeout=5); cls.tmp.cleanup()

    def post(self, path, payload, authorized=True):
        conn = http.client.HTTPConnection(self.server.address, timeout=10)
        headers = {'Content-Type': 'application/json', 'Origin': 'http://' + self.server.address,
                   'X-Studio-Token': self.server.token if authorized else 'wrong'}
        conn.request('POST', path, json.dumps(payload), headers)
        result = conn.getresponse(); body = json.loads(result.read()); status = result.status; conn.close()
        return status, body

    def test_analyze_auth_and_validation(self):
        payload = {'recipe': {}, 'rows': rows_for({'A': [1, 2, 4], 'B': [2, 4, 6]}), 'config': BASE}
        status, result = self.post('/api/analyze', payload)
        self.assertEqual(status, 200); self.assertTrue(comparisons(result))
        self.assertEqual(self.post('/api/analyze', payload, False)[0], 403)
        self.assertEqual(self.post('/api/analyze', {**payload, 'extra': 'code'})[0], 422)
        self.assertEqual(self.post('/api/analyze', {**payload, 'config': {}})[0], 422)

    def test_render_passes_explicit_statistics_and_rejects_extras(self):
        payload = {'recipe': {}, 'rows': rows_for({'A': [1, 2, 4], 'B': [2, 4, 6]}), 'statistics': BASE}
        with patch('studio_server.regenerate', return_value={'statistics': analyze({}, payload['rows'], BASE)}) as spy:
            status, result = self.post('/api/render', payload)
            self.assertEqual(status, 200); spy.assert_called_once_with(payload['recipe'], payload['rows'], BASE, None)
            self.assertTrue(comparisons(result['panel']['statistics']))
        self.assertEqual(self.post('/api/render', {**payload, 'execute': 'anything'})[0], 422)

    def test_axes_render_and_reflow_protocol(self):
        rows=rows_for({'A': [-20,-15,-10], 'B': [10,20,30]})
        recipe={'family':'gallery','parameters':{'view':'compare_bar_points'},'font':'Arial'}
        axes={'y_min':-40,'y_max':60,'first_group_gap':-.1,
              'reference_lines':[{'axis':'y','value':0,'style':'solid','width':.8,'color':'#778899'}]}
        payload={'recipe':recipe,'rows':rows,'axes':axes,'statistics':BASE}
        with patch('studio_server.regenerate',return_value={'axis_controls':{'settings':axes}}) as spy:
            status,result=self.post('/api/render',payload)
            self.assertEqual(status,200)
            spy.assert_called_once_with(recipe,rows,BASE,axes)
            self.assertEqual(result['panel']['axis_controls']['settings'],axes)
        reflow_payload={'recipe':recipe,'rows':rows,'width':360,'height':260,'axes':axes}
        status,result=self.post('/api/reflow',reflow_payload)
        self.assertEqual(status,200,result)
        info=result['variant']['axis_controls'];actual=info['effective'][0]
        self.assertEqual((actual['y_min'],actual['y_max'],actual['first_group_gap']),(-40,60,-.1))
        self.assertTrue(info['reference_line_status'][0]['visible'])
        self.assertEqual(self.post('/api/reflow',{**reflow_payload,'axes':{'y_min':float('nan')}})[0],422)
        self.assertEqual(self.post('/api/reflow',{**reflow_payload,'extra':True})[0],422)


class RenderingRevision(unittest.TestCase):
    def test_replacement_recomputes_and_preserves_separate_analysis(self):
        recipe = json.loads((ROOT / 'demo/workbench/figure_recipe.json').read_text(encoding='utf-8'))
        rows = list(csv.reader(io.StringIO((ROOT / 'skills/make-sci-data-figures/examples/synthetic_group_comparison.csv').read_text(encoding='utf-8-sig'))))
        config = {**BASE, 'group': recipe['group'], 'value': recipe['value'], 'unit': recipe['subject']}
        original = copy.deepcopy(rows)
        first = regenerate(recipe, rows, config)
        edited = copy.deepcopy(rows); index = rows[0].index(recipe['value']); edited[1][index] = str(float(edited[1][index]) + 1)
        second = regenerate(recipe, edited, config)
        self.assertEqual(first['statistics']['data_sha256'], first['table']['sha256'])
        self.assertEqual(second['statistics']['data_sha256'], second['table']['sha256'])
        self.assertNotEqual(first['statistics']['data_sha256'], second['statistics']['data_sha256'])
        self.assertNotEqual(comparisons(first['statistics'])[0]['p'], comparisons(second['statistics'])[0]['p'])
        self.assertIn('primary_estimand', second['analysis'])
        self.assertEqual(rows, original)
        invalid = copy.deepcopy(edited); invalid[1][index] = 'unfinished'
        with self.assertRaises(ValueError): regenerate(recipe, invalid, config)


if __name__ == '__main__':
    unittest.main(verbosity=2)

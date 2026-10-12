"""Independent complex-figure statistical integration checks using synthetic source observations.

No stored P values are used as if they were analyzed data. Expected comparisons are
computed from the supplied observations with SciPy and an independent Holm stepdown.
"""
from __future__ import annotations
import copy
import itertools
import json
import math
from pathlib import Path
import sys
import tempfile
import numpy as np
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/polish-sci-figures/scripts'))
from studio_statistics import analyze


def holm(values):
    values = np.asarray(values, dtype=float)
    ix = np.argsort(values)
    corrected = np.minimum(1, np.maximum.accumulate(values[ix] * (len(values) - np.arange(len(values)))))
    result = np.empty(len(values)); result[ix] = corrected
    return result


def observations():
    """Two measured outcomes/facets; three groups and twelve experimental units each."""
    residuals = [-1.1, -.3, .2, .6, -.8, 1.3, .1, -.4, .9, -.6, .4, 1.0]
    rows = [['factor', 'group', 'unit', 'value']]
    for fi, facet in enumerate(['Assay A', 'Assay B']):
        for gi, group in enumerate(['Control', 'Treatment', 'Rescue']):
            shift = [0, 1.4, .55][gi] if fi == 0 else [0, -.35, 1.9][gi]
            for i, value in enumerate(residuals):
                # Same unit IDs can recur across distinct measured outcomes; each
                # within-facet group comparison still uses each unit exactly once.
                observed = 10 + 35 * fi + shift + value * [1, 1.25, .85][gi] + (i % 3) * .06
                rows.append([facet, group, f'{group}-{i:02}', format(observed, '.12g')])
    return rows


RECIPE = {'family': 'gallery', 'parameters': {'view': 'compare_facet_boxes'}}
CONFIG = {'mode': 'raw', 'group': 'group', 'value': 'value', 'unit': 'unit',
          'facet': 'factor', 'design': 'independent', 'method': 'welch',
          'family': 'all_pairs', 'design_confirmed': True,
          'unit_role': 'independent_experimental_unit',
          'order': ['Control', 'Treatment', 'Rescue']}


def pair_map(result):
    output = {}
    facets = result['analysis'].get('facets')
    assert facets, 'facet requests must preserve named result sets'
    for facet in facets:
        for pair in facet['primary_test']['pairwise']:
            output[(facet['label'], pair['group_a'], pair['group_b'])] = pair
    return output


def reject(rows, config, recipe=RECIPE):
    try:
        analyze(recipe, rows, config)
    except (ValueError, TypeError):
        return
    raise AssertionError('Invalid design/data was accepted')


def main():
    rows = observations(); original = copy.deepcopy(rows); config_before = copy.deepcopy(CONFIG)
    first = analyze(RECIPE, rows, CONFIG); pairs = pair_map(first)
    expected_raw = []; keys = []
    for facet in ['Assay A', 'Assay B']:
        for a, b in itertools.combinations(CONFIG['order'], 2):
            x = [float(r[3]) for r in rows[1:] if r[0] == facet and r[1] == a]
            y = [float(r[3]) for r in rows[1:] if r[0] == facet and r[1] == b]
            expected_raw.append(float(stats.ttest_ind(x, y, equal_var=False).pvalue)); keys.append((facet, a, b))
    for key, raw, adjusted in zip(keys, expected_raw, holm(expected_raw)):
        assert math.isclose(pairs[key]['p_raw'], raw, rel_tol=1e-11, abs_tol=1e-14), key
        assert math.isclose(pairs[key]['p'], adjusted, rel_tol=1e-11, abs_tol=1e-14), key
        assert pairs[key]['n_a'] == pairs[key]['n_b'] == 12
    assert len(pairs) == 6
    assert not first['analysis'].get('primary_test', {}).get('pairwise'), 'facets must not become one cross-facet comparison family in the display'

    # A single-facet revision recomputes that outcome, retaining the other raw tests.
    edited = copy.deepcopy(rows)
    for row in edited[1:]:
        if row[0] == 'Assay A' and row[1] == 'Treatment':
            row[3] = str(float(row[3]) + 2.7)
    second = analyze(RECIPE, edited, first['config']); new_pairs = pair_map(second)
    assert first['data_sha256'] != second['data_sha256']
    assert pairs[('Assay A', 'Control', 'Treatment')]['p_raw'] != new_pairs[('Assay A', 'Control', 'Treatment')]['p_raw']
    for key in pairs:
        if key[0] == 'Assay B':
            assert pairs[key]['p_raw'] == new_pairs[key]['p_raw'], 'unmodified facet raw tests must not be mixed with edited facet observations'
    replay = analyze(RECIPE, rows, first['config'])
    assert pair_map(replay) == pairs and replay['data_sha256'] == first['data_sha256']
    assert rows == original and CONFIG == config_before, 'analysis must not mutate source rows or declaration'

    # Unit and declaration guards: no accidental technical-replicate inflation.
    bad = copy.deepcopy(rows); bad.append(bad[1][:]); reject(bad, CONFIG)
    bad = copy.deepcopy(rows); bad[13][2] = bad[1][2]; reject(bad, CONFIG)
    for value in ['', 'NaN', 'inf', 'not a measurement']:
        bad = copy.deepcopy(rows); bad[1][3] = value; reject(bad, CONFIG)
    for change in [{'design_confirmed': False}, {'design': ''}, {'unit_role': 'technical_replicate'}, {'unit': ''}]:
        reject(rows, {**CONFIG, **change})
    bad = [r for r in rows if not (r[0] == 'Assay B' and r[1] != 'Control')]
    reject(bad, CONFIG)  # No global order silently applied to a one-group facet.

    # Paired data are joined by declared unit rather than row order.
    paired = [['factor', 'group', 'unit', 'value']]
    for facet, shift in [('Assay A', 0), ('Assay B', .7)]:
        for i in range(9):
            before = 5 + i * .3 + (i % 2) * .2
            paired.extend([[facet, 'Before', f'U{i}', str(before)], [facet, 'After', f'U{i}', str(before + [.4, -.2, .9][i % 3] + shift)]])
    paired_config = {**CONFIG, 'design': 'paired', 'method': 'paired_t', 'order': ['Before', 'After']}
    ordered = analyze(RECIPE, paired, paired_config); shuffled = [paired[0]] + list(reversed(paired[1:]))
    shuffled_result = analyze(RECIPE, shuffled, paired_config)
    ordered_pairs = pair_map(ordered); shuffled_pairs = pair_map(shuffled_result)
    for key, pair in ordered_pairs.items():
        assert math.isclose(pair['p_raw'], shuffled_pairs[key]['p_raw'], rel_tol=1e-12)
        before = [float(r[3]) for r in paired[1:] if r[0] == key[0] and r[1] == 'Before']
        after = [float(r[3]) for r in paired[1:] if r[0] == key[0] and r[1] == 'After']
        assert math.isclose(pair['p_raw'], float(stats.ttest_rel(before, after).pvalue), rel_tol=1e-12)
    reject(paired[:-1], paired_config)

    # A histogram facet containing a single group cannot carry an invented bracket.
    hist = [['group', 'unit', 'value']] + [r[1:] for r in rows[1:] if r[0] == 'Assay A']
    reject(hist, {**CONFIG, 'facet': 'group'}, {'family': 'gallery', 'parameters': {'view': 'compare_hist_facets'}})

    # A mixed PCA table must analyze only explicitly selected score coordinates.
    # Loading vectors are not experimental observations; their magnitude must
    # have no effect on the score-only comparisons.
    pca_recipe = {'family': 'gallery', 'parameters': {'view': 'pca_loadings'}}
    pca = [['id', 'role', 'group', 'x', 'y']]
    for row in rows[1:]:
        if row[0] == 'Assay A':
            pca.append([row[2], 'score', row[1], row[3], str(float(row[3]) * .3)])
    pca.extend([['Gene A', 'loading', 'Control', '999', '-999'], ['Gene B', 'loading', 'Treatment', '-999', '999']])
    pca_config = {k: v for k, v in CONFIG.items() if k != 'facet'}
    pca_config.update(unit='id', value='x')
    reject(pca, pca_config, pca_recipe)
    pca_config.update(filter_column='role', filter_value='score')
    pca_result = analyze(pca_recipe, pca, pca_config)
    assert pca_result['analysis']['rows_used'] == 36
    assert pca_result['analysis']['rows_filtered_out'] == 2
    assert pca_result['analysis']['row_filter'] == {'column': 'role', 'value': 'score'}
    assert any('not overall PCA' in note['en'] for note in pca_result['analysis']['diagnostics'])
    altered_loadings = copy.deepcopy(pca); altered_loadings[-1][3] = '-99999'
    unchanged = analyze(pca_recipe, altered_loadings, pca_config)
    assert pca_result['analysis']['primary_test'] == unchanged['analysis']['primary_test']
    assert pca_result['data_sha256'] != unchanged['data_sha256'], 'full-table provenance retains excluded rows'

    # A table sort cannot change a reproducible Monte Carlo comparison.
    rank = [['group', 'unit', 'value']]
    rank += [['A', f'A{i}', str(v)] for i, v in enumerate([1, 1, 2, 2, 3, 3, 4, 4])]
    rank += [['B', f'B{i}', str(v)] for i, v in enumerate([2, 2, 3, 3, 4, 4, 5, 5, 6, 6])]
    rank_config = {k: v for k, v in CONFIG.items() if k not in ('facet', 'order')}
    rank_config.update(method='mannwhitney', order=['A', 'B'])
    rank_first = analyze({}, rank, rank_config)
    rank_sorted = analyze({}, [rank[0]] + list(reversed(rank[1:])), rank_config)
    assert rank_first['analysis']['primary_test'] == rank_sorted['analysis']['primary_test'], 'sorting does not alter permutation P'
    proof = ROOT / '.cache/composite-statistics-qa'
    proof.mkdir(parents=True, exist_ok=True)
    (proof / 'results.json').write_text(json.dumps({'fixture': 'Synthetic observations for regression only', 'recipe': RECIPE, 'rows': rows, 'original': first, 'updated': second, 'paired': ordered, 'pca': pca_result}, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    if '--render' in sys.argv:
        from studio_server import regenerate
        temp_root = proof / 'tmp'; temp_root.mkdir(exist_ok=True)
        tempfile.tempdir = str(temp_root)
        rendered = []
        for values, expected in [(rows, first), (edited, second)]:
            actual = regenerate(RECIPE, values, CONFIG)
            assert actual['table']['sha256'] == expected['data_sha256']
            assert actual['statistics'] == expected
            assert actual['table']['rows'] == values
            assert len(actual['variants']) >= 4
            dimensions = []
            for variant in actual['variants']:
                assert variant['width'] > 0 and variant['height'] > 0
                assert '<svg' in variant['svg'] and '<image' not in variant['svg']
                dimensions.append([variant['name'], variant['width'], variant['height']])
            rendered.append({'table_sha256': actual['table']['sha256'], 'dimensions': dimensions})
        (proof / 'render-revisions.json').write_text(json.dumps(rendered, indent=2), encoding='utf-8')
        print('PASS two actual compound gallery regenerations: table/statistics hashes match; changed observations update results; editable vector variants generated at multiple sizes.')
    print('PASS composite statistical inputs: source recomputation, 2 facets/3 groups/global Holm, revision separation, unit guards, paired identity, PCA score filtering, permutation row-order stability and no single-group facet inference.')


if __name__ == '__main__':
    main()

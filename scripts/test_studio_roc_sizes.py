"""Exercise ROC starters through the real Studio CSV -> analysis -> SVG pipeline."""
import copy
import json
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
(ROOT / '.cache/studio-roc-temp').mkdir(parents=True, exist_ok=True)
tempfile.tempdir = str(ROOT / '.cache/studio-roc-temp')
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'skills/make-sci-data-figures/scripts'),
               str(ROOT / 'skills/polish-sci-figures/scripts')]
import numpy as np
import pandas as pd
from build_original_roc_styles import fixtures
from gallery_registry import SIZES
from studio_server import regenerate

RAW_VIEWS = ['roc', 'precision_recall', 'roc_auc_fill', 'roc_threshold_points',
             'roc_threshold_color', 'roc_threshold_labels', 'roc_youden',
             'roc_pointwise_band', 'roc_direct_labels', 'roc_bootstrap_curves',
             'roc_with_auc_forest', 'roc_log_fpr', 'roc_confusion',
             'roc_score_distribution', 'roc_two_graph']


def raw_fixture():
    rng = np.random.default_rng(973)
    rows = []
    for cohort in ['Discovery', 'Validation']:
        for i in range(96):
            truth = i % 2
            rows.append([cohort + str(i), cohort, truth, float(rng.normal(truth * 1.5, 1))])
    return pd.DataFrame(rows, columns=['unit', 'cohort', 'outcome', 'score'])


def check(recipe, data, key, output, revision='initial'):
    rows = [list(data.columns)] + data.astype(str).values.tolist()
    before_rows, before_recipe = copy.deepcopy(rows), copy.deepcopy(recipe)
    started = time.monotonic()
    panel = regenerate(recipe, rows)
    assert rows == before_rows and recipe == before_recipe, ('input mutated', key)
    assert panel['table']['rows'] == rows, ('CSV changed', key)
    assert panel['variants'][panel['initialVariant']]['name'] == key
    variants = {v.get('size', 'original'): v for v in panel['variants'] if v['name'] == key}
    assert set(variants) == set(SIZES), (key, set(variants))
    for size, variant in variants.items():
        np.testing.assert_allclose([variant['width'] / 72, variant['height'] / 72], SIZES[size], rtol=1e-5)
        assert '<svg' in variant['svg'] and '<text' in variant['svg'] and '<image' not in variant['svg'], (key, size)
        if size != 'original':
            assert variant['preserveAspect']
        (output / f'{key}_{revision}_{size}.svg').write_text(variant['svg'], encoding='utf-8')
    report = dict(template=key, revision=revision, sizes=len(variants),
                  seconds=round(time.monotonic() - started, 2), table_sha256=panel['table']['sha256'])
    print(json.dumps(report), flush=True)
    return panel, report


def main():
    # A straight segment through (0,0) is invalid on a logarithmic FPR axis.
    from advanced_template_workbench import _roc_points, _trapezoid
    from roc_explorer import render_views
    import matplotlib.pyplot as plt
    sample = raw_fixture().query("cohort == 'Discovery'")
    x, y, _, thresholds = _roc_points(sample.outcome.to_numpy(), sample.score.to_numpy())
    record = dict(fpr=x, tpr=y, thresholds=thresholds, label='Discovery', color='#3f6da3',
                  auc=_trapezoid(y, x), ci=[.7, .95], truth=sample.outcome.to_numpy(), scores=sample.score.to_numpy())
    selected = render_views([record], (3.6, 3.6), views={'roc_log_fpr'})
    assert len(selected) == 1 and selected[0][0] == 'roc_log_fpr'
    reference = selected[0][1].axes[0].lines[1]
    assert len(reference.get_xdata()) > 2 and np.all(reference.get_xdata() > 0)
    np.testing.assert_allclose(reference.get_xdata(), reference.get_ydata())
    plt.close(selected[0][1])
    output = ROOT / '.cache/studio-roc-qa'
    output.mkdir(parents=True, exist_ok=True)
    report = []
    originals = {}
    for view, (data, options) in fixtures().items():
        key = 'roc_' + view
        recipe = {'family': 'roc_results', 'font': 'Arial',
                  'parameters': {'view': view, 'method': 'Supplied synthetic analysis results', **options}}
        panel, item = check(recipe, data, key, output)
        report.append(item)
        originals[key] = (panel, recipe, data)
        (output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    for key in RAW_VIEWS:
        recipe = {'family': 'roc', 'font': 'Arial', 'studio_view': key,
                  'parameters': {'outcome': 'outcome', 'score': 'score', 'unit': 'unit',
                                 'cohort': 'cohort', 'positive': '1'}}
        data = raw_fixture()
        panel, item = check(recipe, data, key, output)
        report.append(item)
        originals[key] = (panel, recipe, data)
        (output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    for key in ['roc_youden', 'roc_with_auc_forest', 'roc_partial', 'roc_cutoff_ci']:
        previous, recipe, data = originals[key]
        replacement = data.copy(deep=True)
        if recipe['family'] == 'roc':
            replacement.loc[replacement.outcome == 1, 'score'] += .5
        elif key == 'roc_partial':
            replacement['y'] = replacement.y ** .8
        else:
            for column in ['y', 'y_low', 'y_high']:
                replacement[column] *= .94
        panel, item = check(recipe, replacement, key, output, 'replacement')
        assert panel['table']['sha256'] != previous['table']['sha256']
        if recipe['family'] == 'roc':
            assert panel['analysis']['metrics']['Discovery']['auc'] != previous['analysis']['metrics']['Discovery']['auc']
        report.append(item)
    (output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    assert len(report) == 31
    print('12 result + 15 raw starters + 4 valid replacements; 217 SVG size variants passed.')


if __name__ == '__main__':
    main()

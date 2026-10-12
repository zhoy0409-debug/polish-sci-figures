"""Independent axis-control regression with real negative observations.

This checks plotting geometry and immutable inputs, not browser interaction.
The optional --engine pass checks actual regenerate/reflow response contracts.
"""
from __future__ import annotations

import copy
import io
import json
import math
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'skills/make-sci-data-figures/scripts'),
                str(ROOT / 'skills/polish-sci-figures/scripts')]
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from figure_workbench import style
import gallery_axes
import gallery_registry as gallery
from studio_statistics import analyze


def negative_observations():
    return pd.DataFrame([{'group': group, 'unit': f'{group}-{i}', 'value': value + residual}
                         for group, value in [('Control', -20), ('Treatment', 30), ('Rescue', -10)]
                         for i, residual in enumerate([-2, 0, 1, 3])])


def table(data):
    return [data.columns.tolist()] + data.astype(str).values.tolist()


def rejects(call, message):
    try:
        call()
    except (ValueError, TypeError):
        return
    raise AssertionError(message)


RECIPE = {'family': 'gallery', 'parameters': {'view': 'compare_bar_points'}}
CONFIG = {'mode': 'raw', 'group': 'group', 'value': 'value', 'unit': 'unit',
          'design': 'independent', 'method': 'welch', 'family': 'all_pairs',
          'design_confirmed': True, 'unit_role': 'independent_experimental_unit',
          'order': ['Control', 'Treatment', 'Rescue']}
SIZES = [(3.6, 3.6), (7.2, 3.6), (4.8, 5.4)]


def main():
    style('Arial')
    data = negative_observations(); before = data.copy(deep=True)
    rows = table(data); original_rows = copy.deepcopy(rows)
    initial_statistics = analyze(RECIPE, rows, CONFIG)
    results = []
    for size in SIZES:
        for gap in [-.25, 0, .8, 1.5]:
            settings = {'first_group_gap': gap, 'y_min': -40, 'y_max': 60}
            fig = gallery.render(data, 'compare_bar_points', figsize=size, axes=settings)
            try:
                ax = fig.axes[0]; fig.canvas.draw()
                assert np.allclose(ax.get_ylim(), [-40, 60])
                assert math.isclose(ax.get_xlim()[0], -gap)
                actual_means = [p.get_height() for p in ax.patches]
                expected_means = [data.loc[data.group == g, 'value'].mean() for g in CONFIG['order']]
                assert np.allclose(actual_means, expected_means), (actual_means, expected_means)
                assert sum(value < 0 for value in actual_means) == 2, 'negative observations must produce negative bars'
                assert all(p.get_y() == 0 for p in ax.patches), 'bar origin remains the actual zero baseline'
                first_x = ax.transData.transform((0, 0))[0]; axis_left = ax.get_window_extent().x0
                assert (first_x < axis_left) if gap < 0 else math.isclose(first_x, axis_left) if gap == 0 else (first_x > axis_left)
                info = fig._studio_axis_controls
                assert info['settings'] == settings
                assert math.isclose(info['effective'][0]['first_group_gap'], gap)
                assert bool([w for w in info['warnings'] if w['code'] == 'first_group_clipped']) == (gap <= 0)
                output = io.BytesIO(); fig.savefig(output, format='svg')
                assert b'<image' not in output.getvalue(), 'negative data remains editable vector artwork'
                results.append({'view': 'compare_bar_points', 'size': size, 'settings': settings, 'means': actual_means})
            finally:
                plt.close(fig)
    pd.testing.assert_frame_equal(data, before)
    assert rows == original_rows
    assert analyze({**RECIPE, 'axis_settings': {'y_min': -40, 'y_max': 60}}, rows, CONFIG) == initial_statistics

    facets = pd.concat([data.assign(factor='Assay A'), data.assign(factor='Assay B', value=data.value + 7)], ignore_index=True)
    facets_before = facets.copy(deep=True)
    for size in SIZES:
        fig = gallery.render(facets, 'compare_facet_boxes', figsize=size, axes={'first_group_gap': -.1, 'y_min': -40, 'y_max': 60})
        try:
            fig.canvas.draw(); assert len(fig.axes) == 2
            for ax in fig.axes:
                assert np.allclose(ax.get_ylim(), [-40, 60]); assert math.isclose(ax.get_xlim()[0], .1)
            assert [r['label'] for r in fig._studio_axis_controls['effective']] == ['Assay A', 'Assay B']
            results.append({'view': 'compare_facet_boxes', 'size': size, 'facets': 2})
        finally:
            plt.close(fig)
    pd.testing.assert_frame_equal(facets, facets_before)

    relationship = pd.DataFrame({'unit': ['a', 'b', 'c', 'd', 'e'], 'x': [-6, -2, 0, 2, 6], 'y': [-4, 2, 0, 6, -8]})
    for size in SIZES:
        fig = gallery.render(relationship, 'relation_scatter', figsize=size, axes={'x_min': -8, 'x_max': 8, 'y_min': -12, 'y_max': 12})
        try:
            ax = fig.axes[0]; assert np.allclose(ax.get_xlim(), [-8, 8]); assert np.allclose(ax.get_ylim(), [-12, 12])
            assert np.allclose(ax.collections[0].get_offsets(), relationship[['x', 'y']].to_numpy())
            fig.canvas.draw(); results.append({'view': 'relation_scatter', 'size': size})
        finally:
            plt.close(fig)

    for setting in [{'y_min': float('nan')}, {'y_max': float('inf')}, {'first_group_gap': True}, {'y_min': '-2'}, {'unknown': 1}, {'x_min': 3, 'x_max': 3}, {'y_min': 3, 'y_max': -3}]:
        rejects(lambda: gallery_axes.validate_settings('relation_scatter', setting), f'invalid setting accepted: {setting}')
    assert gallery_axes.normalize({'x_min': None, 'y_max': None}) == {}
    rejects(lambda: gallery_axes.validate_settings('compare_bar_points', {'x_min': -1}), 'category location cannot masquerade as numerical X')
    rejects(lambda: gallery_axes.validate_settings('pca_loadings', {'y_min': -1}), 'ambiguous compound axes cannot receive global limits')
    rejects(lambda: gallery.render(data, 'compare_bar_points', axes={'y_min': 100}), 'partial lower limit larger than automatic upper bound accepted')
    rejects(lambda: gallery.render(data, 'compare_bar_points', axes={'first_group_gap': -5}), 'inverted category axis accepted')
    positive = data.copy(); positive.value = positive.value.abs() + 1
    rejects(lambda: gallery.render(positive, 'compare_log_points', axes={'y_min': -1}), 'log axis accepted a negative lower bound')
    assert not gallery_axes.compatible_settings('compare_density', 'compare_ecdf', {'y_min': -.1}), 'density limits cannot leak into probability coordinates'
    assert gallery_axes.compatible_settings('compare_bar_points', 'compare_box', {'y_min': -40, 'first_group_gap': .8})

    reference = {'axis': 'y', 'value': 0, 'style': 'solid', 'width': .8, 'color': '#7b8797'}
    for size in SIZES:
        settings = {'y_min': -40, 'y_max': 60, 'reference_lines': [reference, {**reference, 'value': 1000, 'style': 'dotted'}]}
        fig = gallery.render(data, 'compare_bar_points', figsize=size, axes=settings)
        try:
            ax = fig.axes[0]; assert np.allclose(ax.get_ylim(), [-40, 60])
            refs = [line for line in ax.lines if (line.get_gid() or '').startswith('studio-reference-line-')]
            assert len(refs) == 2; assert np.allclose(refs[0].get_ydata(), [0, 0]); assert np.allclose(refs[1].get_ydata(), [1000, 1000])
            assert refs[0].get_linewidth() == .8; assert refs[0].get_linestyle() == '-'; assert refs[1].get_linestyle() == ':'
            assert [r['visible'] for r in fig._studio_axis_controls['reference_line_status']] == [True, False]
            assert any(w['code'] == 'reference_line_outside' for w in fig._studio_axis_controls['warnings'])
            assert np.allclose([p.get_height() for p in ax.patches], [-19.5, 30.5, -9.5])
            fig.canvas.draw(); results.append({'view': 'compare_bar_points', 'size': size, 'zero_line': True, 'outside_line_does_not_expand_limits': True})
        finally:
            plt.close(fig)
    for lines in [[{**reference, 'value': float('nan')}], [{**reference, 'width': -1}], [{**reference, 'axis': 'q'}], [{**reference, 'style': 'unknown'}], [{**reference, 'color': 'url(https://example.invalid)'}], [reference] * 9]:
        rejects(lambda: gallery_axes.validate_settings('compare_bar_points', {'reference_lines': lines}), 'invalid reference line accepted')
    rejects(lambda: gallery_axes.validate_settings('compare_bar_points', {'reference_lines': [{**reference, 'axis': 'x'}]}), 'reference line cannot use category index as a numeric variable')
    rejects(lambda: gallery.render(positive, 'compare_log_points', axes={'reference_lines': [reference]}), 'log zero reference accepted')
    assert gallery_axes.normalize({'reference_lines': []}) == {}
    pd.testing.assert_frame_equal(data, before)
    assert analyze({**RECIPE, 'axis_settings': {'reference_lines': [reference]}}, rows, CONFIG) == initial_statistics

    if '--engine' in sys.argv:
        scratch = ROOT / '.cache/axes-regression-qa/tmp'; scratch.mkdir(parents=True, exist_ok=True)
        tempfile.tempdir = str(scratch)
        from studio_server import regenerate, reflow
        settings = {'first_group_gap': -.25, 'y_min': -40, 'y_max': 60, 'reference_lines': [reference]}
        actual = regenerate(RECIPE, rows, statistics=CONFIG, axes=settings)
        assert actual['statistics'] == initial_statistics
        assert actual['recipe']['axis_settings'] == settings
        for variant in actual['variants']:
            info = gallery_axes.controls_from_svg(variant['svg'].encode())
            assert info and info['settings'] == settings, variant['name']
            assert all(r['y_min'] == -40 and r['y_max'] == 60 for r in info['effective'])
        resized = reflow(actual['recipe'], rows, 600, 300)
        info = gallery_axes.controls_from_svg(resized['svg'].encode())
        assert info['settings'] == settings
        assert resized['width'] == 600 and resized['height'] == 300
        assert rows == original_rows
        results.append({'engine': 'regenerate/reflow', 'variant_count': len(actual['variants']), 'statistics_unchanged': True})

    out = ROOT / '.cache/axes-regression-qa'; out.mkdir(parents=True, exist_ok=True)
    (out / 'report.json').write_text(json.dumps({'scope': 'Matplotlib geometry and optional engine contracts; browser interaction not covered', 'cases': results}, indent=2), encoding='utf-8')
    print(f'PASS {len(results)} real negative-data axis cases; invalid/ambiguous limits rejected and original observations/statistics unchanged')


if __name__ == '__main__':
    main()

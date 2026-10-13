"""Real SVG cell identities for factorial comparisons; artwork stays unchanged."""
from __future__ import annotations

import io
import json
import copy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'skills/make-sci-data-figures/scripts'),
               str(ROOT / 'skills/polish-sci-figures/scripts')]
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import gallery_workbench
import gallery_compare
import gallery_registry
from gallery_marks import prepare_marks, embed_marks
from studio_statistics import analyze

OWNERS = {'grouped_observations': gallery_workbench,
          'compare_facet_boxes': gallery_compare}
GROUPS = ['Control', 'Stress', 'Rescue']
FACTORS = ['Line 1', 'Line 2', 'Line 3']


def observations(groups=GROUPS, factors=FACTORS):
    return pd.DataFrame([
        {'factor': factor, 'group': group, 'unit': f'g{gi}-u{ui}',
         'value': 11 + fi * 3 + [0, 4, -3][gi] + residual}
        for fi, factor in enumerate(factors) for gi, group in enumerate(groups)
        for ui, residual in enumerate([-1.2, -.8, -.25, .15, .4, .7, 1.0, 1.7])
    ])


def serialize(fig):
    prepare_marks(fig)
    stream = io.StringIO()
    with plt.rc_context({'svg.fonttype': 'none'}):
        fig.savefig(stream, format='svg', metadata={'Date': None})
    return embed_marks(stream.getvalue(), fig)


def metadata(svg):
    root = ET.fromstring(svg)
    identifiers = [node.get('id') for node in root.iter() if node.get('id')]
    assert len(identifiers) == len(set(identifiers)), 'Duplicate SVG identifiers'
    lookup = {node.get('id'): node for node in root.iter() if node.get('id')}
    return json.loads(lookup['studio-stat-anchors'].text), lookup


class GroupedStatMetadata(unittest.TestCase):
    def test_source_identity_and_final_coordinates_after_resize(self):
        # Escape-sensitive, numeric-looking and repeated-across-facet labels
        # must retain their exact source identity, not depend on display text.
        groups = ['0', 'Stress & rescue', 'Treatment </metadata>']
        factors = ['Line <2>', '细胞系 A', 'Line 1']
        data = observations(groups, factors)
        for view, owner in OWNERS.items():
            for size in [(4.8, 3.6), (7.2, 3.6), (3.6, 4.8)]:
                with self.subTest(view=view, size=size):
                    fig = owner.render(data, view, figsize=size)
                    try:
                        raw = serialize(fig)
                        meta, lookup = metadata(raw)
                        self.assertEqual(meta['version'], 1)
                        self.assertEqual(meta['group_column'], 'group')
                        self.assertEqual(meta['facet_column'], 'factor')
                        cells = {}
                        member_ids = set()
                        for axis in meta['axes']:
                            axis_node = lookup[axis['axis']]
                            child_ids = {node.get('id') for node in axis_node.iter()}
                            for cell in axis['groups']:
                                key = (cell['facet']['value'], cell['group'])
                                self.assertNotIn(key, cells)
                                cells[key] = cell
                                self.assertEqual(cell['facet']['column'], 'factor')
                                self.assertTrue(set(cell['members']) <= child_ids)
                                self.assertFalse(member_ids & set(cell['members']))
                                member_ids.update(cell['members'])
                                self.assertTrue(all(member.startswith('studio-mark-') for member in cell['members']))
                                self.assertGreaterEqual(len(cell['members']), 5)
                        self.assertEqual(set(cells), {(f, g) for f in factors for g in groups})
                        for fi, f in enumerate(factors):
                            for gi, g in enumerate(groups):
                                values = data.loc[(data.factor == f) & (data.group == g), 'value']
                                if view == 'grouped_observations':
                                    ax, x, y = fig.axes[0], fi + (gi - 1) * .7 / 3, values.mean()
                                else:
                                    ax, x, y = fig.axes[fi], gi, values.median()
                                expected = ax.transData.transform([x, y]) * 72 / fig.dpi
                                expected[1] = fig.get_figheight() * 72 - expected[1]
                                np.testing.assert_allclose(cells[(f, g)]['center'], expected, atol=1e-6, rtol=0)
                    finally:
                        plt.close(fig)

    def test_metadata_does_not_change_artwork_or_data(self):
        data = observations()
        original = data.copy(deep=True)
        for view, owner in OWNERS.items():
            with self.subTest(view=view):
                tagged = owner.render(data, view)
                with patch.object(owner, 'tag_stat_group', lambda *args: None):
                    original_fig = owner.render(data, view)
                try:
                    tagged.canvas.draw(); original_fig.canvas.draw()
                    np.testing.assert_array_equal(np.asarray(tagged.canvas.buffer_rgba()),
                                                  np.asarray(original_fig.canvas.buffer_rgba()))
                    pd.testing.assert_frame_equal(data, original)
                finally:
                    plt.close(tagged); plt.close(original_fig)

    def test_reordered_data_and_changed_values_map_to_correct_cells(self):
        data = observations()
        data = pd.concat([data[(data.factor == f) & (data.group == g)]
                          for f in reversed(FACTORS) for g in reversed(GROUPS)], ignore_index=True)
        data.loc[(data.factor == 'Line 2') & (data.group == 'Stress'), 'value'] *= -2
        for view in OWNERS:
            with self.subTest(view=view):
                raw = gallery_registry.svg_at_size(data, view, None, 'DejaVu Sans', (6, 4))
                meta, _ = metadata(raw)
                cells = {(c['facet']['value'], c['group']): c
                         for ax in meta['axes'] for c in ax['groups']}
                self.assertEqual(len(cells), 9)
                for f in FACTORS:
                    self.assertLess(cells[(f, 'Rescue')]['center'][0], cells[(f, 'Stress')]['center'][0])
                    self.assertLess(cells[(f, 'Stress')]['center'][0], cells[(f, 'Control')]['center'][0])
                fig = OWNERS[view].render(data, view, figsize=(6, 4))
                try:
                    rec = next(r for r in fig._studio_stat_groups
                               if r['group'] == 'Stress' and r['facet']['value'] == 'Line 2')
                    self.assertLess(rec['center'][1], 0)
                finally:
                    plt.close(fig)

    def test_missing_cell_is_explicitly_rejected(self):
        data = observations()
        incomplete = data[~((data.factor == 'Line 2') & (data.group == 'Stress'))]
        for view, owner in OWNERS.items():
            with self.subTest(view=view), self.assertRaisesRegex(ValueError, '(cell|factor-group)'):
                owner.render(incomplete, view)
        plt.close('all')

    def test_metadata_reflow_is_bounded_and_keeps_layout_eligibility(self):
        from studio_server import reflow
        from gallery_layout import REVIEWED
        from gallery_axes import capabilities
        rows = [list(observations().columns), *observations().astype(str).values.tolist()]
        original = copy.deepcopy(rows)
        reviewed = set(REVIEWED)
        controls = {view: capabilities(view) for view in OWNERS}
        for view in OWNERS:
            recipe = {'family': 'gallery', 'parameters': {'view': view}, 'font': 'DejaVu Sans'}
            recipe_before = copy.deepcopy(recipe)
            with self.subTest(view=view):
                result = reflow(recipe, rows, 345.6, 259.2)
                self.assertAlmostEqual(result['width'], 345.6)
                self.assertAlmostEqual(result['height'], 259.2)
                meta, _ = metadata(result['svg'])
                self.assertEqual(sum(len(axis['groups']) for axis in meta['axes']), 9)
                self.assertEqual(recipe, recipe_before)
                for size in [(100, 259.2), (345.6, 2000), (float('nan'), 259.2)]:
                    with self.assertRaises(ValueError):
                        reflow(recipe, rows, *size)
        self.assertEqual(rows, original)
        self.assertEqual(set(REVIEWED), reviewed)
        self.assertEqual({view: capabilities(view) for view in OWNERS}, controls)
        with self.assertRaisesRegex(ValueError, 'no reviewed reflow layout'):
            reflow({'family': 'gallery', 'parameters': {'view': 'superplot'}}, rows, 345.6, 259.2)
        with self.assertRaises(ValueError):
            reflow({'family': 'gallery', 'parameters': {'view': 'grouped_observations'}},
                   rows, 345.6, 259.2, axes={'y_min': 0})


def write_fixtures():
    target = ROOT / '.cache/grouped-stat-anchors'
    target.mkdir(parents=True, exist_ok=True)
    data = observations()
    rows = [list(data.columns), *data.astype(str).values.tolist()]
    config = {'mode': 'raw', 'group': 'group', 'value': 'value', 'unit': 'unit',
              'facet': 'factor', 'design': 'independent', 'method': 'welch',
              'family': 'all_pairs', 'design_confirmed': True,
              'unit_role': 'independent_experimental_unit', 'order': GROUPS}
    for view in OWNERS:
        svg = gallery_registry.svg_at_size(data, view, None, 'DejaVu Sans', (4.8, 3.6))
        (target / (view + '.svg')).write_bytes(svg)
        result = analyze({'family': 'gallery', 'parameters': {'view': view}}, rows, config)
        (target / (view + '.json')).write_text(json.dumps({'rows': rows, **result}, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Real SVG + analysis fixtures:', target)


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(GroupedStatMetadata)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
    write_fixtures()

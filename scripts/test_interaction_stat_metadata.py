"""Synthetic factorial data: exact interaction-point anchors, unchanged artwork."""
from __future__ import annotations
import io
import unittest
from unittest.mock import patch
import numpy as np
from test_grouped_stat_metadata import observations, serialize, metadata, gallery_compare, plt
from gallery_marks import tag_stat_group


class InteractionAnchors(unittest.TestCase):
    def test_point_identity_and_final_coordinates(self):
        data = observations(['Control', 'Treatment & rescue', '3'], ['Day <1>', 'Day 7', 'Day 14'])
        for size in [(4.8, 3.6), (7.2, 3.6), (3.6, 4.8)]:
            fig = gallery_compare.render(data, 'compare_interaction', figsize=size)
            try:
                value, lookup = metadata(serialize(fig))
                axis = value['axes'][0]
                self.assertEqual(axis['comparison_axis'], 'y')
                self.assertEqual(len(axis['groups']), 9)
                self.assertEqual(len({cell['members'][0] for cell in axis['groups']}), 3)
                seen = set()
                for cell in axis['groups']:
                    self.assertIn(cell['members'][0], lookup)
                    index = list(data.factor.unique()).index(cell['facet']['value'])
                    self.assertEqual(index, cell['point_index'])
                    identity = (cell['members'][0], index)
                    self.assertNotIn(identity, seen)
                    seen.add(identity)
                    mean = data.loc[(data.factor == cell['facet']['value']) & (data.group == cell['group']), 'value'].mean()
                    expected = fig.axes[0].transData.transform((index, mean)) * 72 / fig.dpi
                    expected[1] = fig.get_figheight() * 72 - expected[1]
                    np.testing.assert_allclose(cell['center'], expected, atol=1e-6, rtol=0)
            finally:
                plt.close(fig)

    def test_tagging_changes_no_pixels_or_observations(self):
        data = observations()
        before = data.copy(deep=True)
        images = []
        for enabled in [True, False]:
            with patch.object(gallery_compare, 'tag_stat_group', tag_stat_group if enabled else lambda *args, **kwargs: None):
                fig = gallery_compare.render(data, 'compare_interaction')
                try:
                    fig.canvas.draw()
                    images.append(np.asarray(fig.canvas.buffer_rgba()).copy())
                finally:
                    plt.close(fig)
        np.testing.assert_array_equal(*images)
        self.assertTrue(before.equals(data))

    def test_reject_index_or_center_not_on_real_series(self):
        fig, ax = plt.subplots()
        line, = ax.plot([0, 1, 2], [5, 7, 6], marker='o')
        try:
            for index, center in [(3, (2, 6)), (1, (1, 9)), (-1, (0, 5))]:
                with self.assertRaises(ValueError):
                    tag_stat_group(ax, 'A', 'F', center, [line], point_index=index, comparison_axis='y')
        finally:
            plt.close(fig)


if __name__ == '__main__':
    unittest.main()

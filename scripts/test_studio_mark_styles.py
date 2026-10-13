"""Regression: error-bar directions use actual estimates in final SVG coordinates."""
import io
import json
import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/make-sci-data-figures/scripts'))
import figure_workbench as wb
from gallery_marks import prepare_marks, embed_marks, tag_color_source
import gallery_compare
import gallery_workbench
import pandas as pd


class MarkGeometry(unittest.TestCase):
    def metadata(self, fig):
        prepare_marks(fig)
        output = io.StringIO()
        fig.savefig(output, format='svg')
        root = ET.fromstring(embed_marks(output.getvalue(), fig))
        return json.loads(root.find(".//*[@id='studio-mark-styles']").text), root

    def test_asymmetric_negative_and_log_centers(self):
        for log, values, lower, upper in [(False, [-12, 30], [2, 3], [7, 9]), (True, [10, 100], [6, 50], [30, 900])]:
            fig, ax = wb.plt.subplots()
            if log:
                ax.set_yscale('log')
            ax.errorbar([1, 2], values, yerr=[lower, upper], fmt='none', capsize=3)
            meta, root = self.metadata(fig)
            segments = meta['errors'][0]['segments']
            self.assertEqual(len(segments), 2)
            for segment, x, y in zip(segments, [1, 2], values):
                cx, cy = ax.transData.transform((x, y)) * 72 / fig.dpi
                cy = fig.get_figheight() * 72 - cy
                self.assertAlmostEqual(segment['center'][0], cx, places=5)
                self.assertAlmostEqual(segment['center'][1], cy, places=5)
                self.assertNotAlmostEqual(cy, sum(p[1] for p in segment['ends']) / 2, places=2)
            self.assertIsNotNone(root.find(".//*[@id='" + meta['errors'][0]['id'] + "']"))
            wb.plt.close(fig)

    def test_xy_errors_have_separate_caps(self):
        fig, ax = wb.plt.subplots()
        ax.scatter([1, 2], [2, 3])
        ax.errorbar([1, 2], [2, 3], xerr=.2, yerr=.3, fmt='o', capsize=4)
        meta, _ = self.metadata(fig)
        self.assertEqual(len(meta['errors']), 2)
        self.assertFalse(set(meta['errors'][0]['caps']) & set(meta['errors'][1]['caps']))
        self.assertEqual(len(meta['points']), 2)
        wb.plt.close(fig)

    def test_duplicate_positions_do_not_guess(self):
        fig, ax = wb.plt.subplots()
        ax.errorbar([1, 1], [2, 3], yerr=2, fmt='none')
        meta, _ = self.metadata(fig)
        self.assertTrue(all(s['center'] is None for s in meta['errors'][0]['segments']))
        wb.plt.close(fig)

    def test_grouped_colors_follow_explicit_cell_members_without_pixel_changes(self):
        data = pd.DataFrame([{'factor': factor, 'group': group, 'unit': str(i), 'value': 3 + gi + fi + value}
                             for fi, factor in enumerate(['Line 2', 'Line 1'])
                             for gi, group in enumerate(['Rescue', 'Control', 'Stress'])
                             for i, value in enumerate([-.3, 0, .4])])
        fig = gallery_workbench.render(data, 'grouped_observations')
        try:
            # Stabilize the shared layout before comparing PNGs around SVG
            # serialization; different backend text metrics otherwise reflow it.
            fig.canvas.draw(); fig.set_layout_engine(None)
            before = io.BytesIO(); fig.savefig(before, format='png')
            meta, root = self.metadata(fig)
            after = io.BytesIO(); fig.savefig(after, format='png')
            self.assertEqual(before.getvalue(), after.getvalue(), 'Metadata must not repaint or move original artists')
            colors = {item['id']: item for item in meta['pointColors']}
            errors = {item['id']: item for item in meta['errors']}
            anchors = json.loads(root.find(".//*[@id='studio-stat-anchors']").text)
            for cell in anchors['axes'][0]['groups']:
                points = [key for key in cell['members'] if key in colors]
                stems = [key for key in cell['members'] if key in errors]
                self.assertEqual(len(points), 1); self.assertEqual(len(stems), 1)
                source = colors[points[0]]['colorSource']
                self.assertEqual(source, errors[stems[0]]['colorSource'])
                self.assertEqual(source['paint'], 'fill')
                self.assertIn(source['id'], cell['members'])
                self.assertNotIn(source['id'], points + stems)
                self.assertEqual(colors[points[0]]['kind'], 'collection')
        finally:
            wb.plt.close(fig)

    def test_basic_bars_and_lines_keep_object_color_ownership(self):
        data = pd.DataFrame([{'group': group, 'value': value, 'unit': str(i)}
                             for group in ['B', 'A'] for i, value in enumerate([1, 2, 3, 4])])
        for view in ['compare_bar_points', 'compare_bar_sd']:
            fig = gallery_compare.render(data, view)
            try:
                meta, root = self.metadata(fig)
                sources = [error['colorSource'] for error in meta['errors']]
                self.assertEqual(len({item['id'] for item in sources}), 2)
                self.assertTrue(all(item['paint'] == 'fill' for item in sources))
                for item in sources:
                    self.assertIsNotNone(root.find(".//*[@id='" + item['id'] + "']"))
                if view.endswith('points'):
                    self.assertEqual([p['colorSource'] for p in meta['pointColors']], sources)
            finally:
                wb.plt.close(fig)
        fig, ax = wb.plt.subplots()
        line = ax.errorbar([0, 1], [1, 3], yerr=.3, fmt='o-', color='blue', ecolor='black')
        try:
            meta, _ = self.metadata(fig)
            self.assertEqual(meta['errors'][0]['colorSource'], {'id': line.lines[0].get_gid(), 'paint': 'stroke'})
            self.assertEqual(meta['pointColors'][0]['kind'], 'line')
        finally:
            wb.plt.close(fig)

    def test_multicolor_bar_segments_are_owned_not_nearest(self):
        fig, ax = wb.plt.subplots()
        bars = ax.bar([1, 1, 2], [2, 4, 3], yerr=.3, color=['red', 'blue', 'green'], capsize=3)
        try:
            meta, _ = self.metadata(fig)
            error = meta['errors'][0]
            self.assertNotIn('colorSource', error)
            self.assertEqual([s['colorSource']['id'] for s in error['segments']], [p.get_gid() for p in bars.patches])
        finally:
            wb.plt.close(fig)
        fig, ax = wb.plt.subplots()
        ax.bar([0, 1, 2], [2, 4, 3], yerr=.3, error_kw={'errorevery': 2})
        try:
            meta, _ = self.metadata(fig)
            self.assertTrue(all('colorSource' not in segment for segment in meta['errors'][0]['segments']))
        finally:
            wb.plt.close(fig)

    def test_unrelated_same_location_marks_do_not_acquire_sources(self):
        fig, ax = wb.plt.subplots()
        ax.bar(1, 3, color='red')
        point = ax.scatter([1], [3], facecolors='none', edgecolors='blue')
        ax.errorbar(1, 3, yerr=.2, fmt='none', ecolor='black')
        try:
            meta, _ = self.metadata(fig)
            self.assertEqual(meta['pointColors'][0]['id'], point.get_gid())
            self.assertEqual(meta['pointColors'][0]['kind'], 'collection')
            self.assertNotIn('colorSource', meta['pointColors'][0])
            expected = ax.transData.transform((1, 3)) * 72 / fig.dpi
            expected[1] = fig.get_figheight() * 72 - expected[1]
            self.assertEqual(meta['pointColors'][0]['centers'], [expected.round(6).tolist()])
            self.assertNotIn('colorSource', meta['errors'][0])
        finally:
            wb.plt.close(fig)

    def test_collection_centers_preserve_valid_offset_order(self):
        fig, ax = wb.plt.subplots()
        point = ax.scatter([1, 2, 3], [10, float('nan'), 100])
        ax.set_yscale('log')
        try:
            meta, _ = self.metadata(fig)
            centers = next(p['centers'] for p in meta['pointColors'] if p['id'] == point.get_gid())
            expected = ax.transData.transform([[1, 10], [3, 100]]) * 72 / fig.dpi
            expected[:, 1] = fig.get_figheight() * 72 - expected[:, 1]
            self.assertEqual(centers, expected.round(6).tolist())
        finally:
            wb.plt.close(fig)

    def test_existing_category_group_ids_remain_and_source_points(self):
        fig, ax = wb.plt.subplots()
        points = ax.scatter([-.1, .1], [1, 2], color='red')
        error = ax.errorbar(0, 1.5, yerr=.3, fmt='o', color='black', markerfacecolor='white')
        ax.set_xticks([0], ['A'])
        wb.tag_category_groups(fig, ax, ['A'], [(points, error)])
        before = [a.get_gid() for a in [points, error.lines[0], *error.lines[1], *error.lines[2]]]
        try:
            meta, _ = self.metadata(fig)
            self.assertEqual(before, [a.get_gid() for a in [points, error.lines[0], *error.lines[1], *error.lines[2]]])
            source = {'id': points.get_gid(), 'paint': 'fill'}
            self.assertEqual(meta['errors'][0]['colorSource'], source)
            self.assertEqual(next(p for p in meta['pointColors'] if p['kind'] == 'line')['colorSource'], source)
            with self.assertRaises(ValueError):
                tag_color_source(error, points, 'url')
        finally:
            wb.plt.close(fig)


if __name__ == '__main__':
    unittest.main()

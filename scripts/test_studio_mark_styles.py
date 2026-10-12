"""Regression: error-bar directions use actual estimates in final SVG coordinates."""
import io
import json
import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/make-sci-data-figures/scripts'))
import figure_workbench as wb
from gallery_marks import prepare_marks, embed_marks


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


if __name__ == '__main__':
    unittest.main()

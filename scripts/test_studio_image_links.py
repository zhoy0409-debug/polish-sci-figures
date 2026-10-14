"""Real OpenCV localization from synthetic images, including hard negatives."""
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/polish-sci-figures/scripts'))
import studio_image_links as links
from test_image_duplicates import item, raster


class ImageLinkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parent = raster(13, (640, 480))
        cls.box = (110, 80, 520, 390)
        cls.crop = cls.parent.crop(cls.box)

    def locate(self, child, parent=None):
        return links.locate_image_links([item('parent', parent or self.parent), item('child', child)])['pairs'][0]

    def assert_region(self, pair, expected, tolerance=.006):
        self.assertEqual(pair['status'], 'matched', pair)
        np.testing.assert_allclose(pair['parentCorners'], expected, atol=tolerance, rtol=0)
        self.assertTrue(pair['reviewRequired'])
        self.assertGreaterEqual(pair['quality']['forwardInliers'], links.MIN_INLIERS)
        self.assertGreaterEqual(pair['quality']['reverseInliers'], links.MIN_INLIERS)
        self.assertGreaterEqual(pair['quality']['contentAgreement'], links.MIN_CONTENT_AGREEMENT)

    def test_crop_resize_jpeg_and_pixel_boundary_coordinates(self):
        expected = np.array([[110, 80], [520, 80], [520, 390], [110, 390]]) / [640, 480]
        for image in [self.crop, self.crop.resize((820, 620), Image.Resampling.LANCZOS), self.crop.resize((287, 217), Image.Resampling.LANCZOS)]:
            with self.subTest(size=image.size):
                self.assert_region(self.locate(image), expected)
        report = links.locate_image_links([item('parent', self.parent), item('child', self.crop, fmt='JPEG', quality=88)])
        self.assert_region(report['pairs'][0], expected)
        json.dumps(report, allow_nan=False)

    def test_quarter_turns_and_reflections_keep_child_corner_order(self):
        corners = np.array([[110, 80], [520, 80], [520, 390], [110, 390]]) / [640, 480]
        variants = [(self.crop.transpose(Image.Transpose.ROTATE_90), [1, 2, 3, 0]),
                    (self.crop.transpose(Image.Transpose.ROTATE_180), [2, 3, 0, 1]),
                    (self.crop.transpose(Image.Transpose.ROTATE_270), [3, 0, 1, 2]),
                    (ImageOps.mirror(self.crop), [1, 0, 3, 2]),
                    (ImageOps.flip(self.crop), [3, 2, 1, 0])]
        for image, order in variants:
            with self.subTest(order=order):
                self.assert_region(self.locate(image), corners[order])

    def test_three_images_are_adjacent_local_links_with_progress_and_no_payload_echo(self):
        grandchild = self.crop.crop((70, 45, 350, 270))
        events = []
        records = [item('a', self.parent), item('b', self.crop), item('c', grandchild)]
        before = json.dumps(records)
        report = links.locate_image_links(records, progress=events.append)
        self.assertEqual(report['status'], 'matched', report)
        self.assertEqual([(p['parentId'], p['childId']) for p in report['pairs']], [('a', 'b'), ('b', 'c')])
        self.assert_region(report['pairs'][1], np.array([[70, 45], [350, 45], [350, 270], [70, 270]]) / [410, 310])
        self.assertEqual(report['coordinateSpace'], 'decoded-image-normalized')
        self.assertEqual(events[-1], {'stage': 'pairs', 'completed': 2, 'total': 2})
        self.assertEqual(before, json.dumps(records))
        self.assertNotIn('data:image', json.dumps(report))

    def test_large_analysis_downsample_keeps_full_file_coordinates(self):
        parent = self.parent.resize((1280, 960), Image.Resampling.LANCZOS)
        child = parent.crop((220, 160, 1040, 780))
        expected = np.array([[220, 160], [1040, 160], [1040, 780], [220, 780]]) / [1280, 960]
        self.assert_region(self.locate(child, parent), expected)

    def test_large_native_depth_full_roi_preserves_analysis_pixels_and_source_identity(self):
        parent = self.parent.resize((1280, 960), Image.Resampling.LANCZOS).convert('L')
        native = Image.fromarray(np.asarray(parent, dtype=np.uint16)*200+5000)
        cv = links.duplicate._engine()
        for fmt in ['PNG', 'TIFF']:
            with self.subTest(fmt=fmt):
                record = item('parent', native, fmt=fmt)
                plain = links.duplicate._read(record, cv)
                full = links.duplicate._read(record, cv, roi={'x': 0, 'y': 0, 'w': 1, 'h': 1})
                np.testing.assert_array_equal(full.gray, plain.gray)
                self.assertEqual(full.info['sha256'], plain.info['sha256'])
                self.assertEqual((full.info['width'], full.info['height']), (1280, 960))
                self.assertEqual(full.info['intensityMapping']['sourceDtype'], 'uint16')

    def test_large_native_depth_visible_crop_localizes_in_original_pixel_coordinates(self):
        parent = self.parent.resize((1280, 960), Image.Resampling.LANCZOS).convert('L')
        native = Image.fromarray(np.asarray(parent, dtype=np.uint16)*200+5000)
        child_canvas = Image.fromarray(np.full((1200, 1600), 5000, np.uint16))
        child_canvas.paste(native.crop((220, 160, 1040, 780)), (400, 300))
        expected = np.array([[220, 160], [1040, 160], [1040, 780], [220, 780]])/[1280, 960]
        # Fractional pixel edges must retain their precise visible ROI while
        # the native analysis crop rounds outwards to complete source pixels.
        parent_roi = {'x': 120.25/1280, 'y': 80.25/960, 'w': 1039.5/1280, 'h': 799.5/960}
        for fmt in ['PNG', 'TIFF']:
            with self.subTest(fmt=fmt):
                report = links.locate_image_links([
                    {**item('parent', native, fmt=fmt), 'roi': parent_roi},
                    {**item('child', child_canvas, fmt=fmt), 'roi': {'x': .25, 'y': .25, 'w': 820/1600, 'h': 620/1200}},
                ])
                self.assert_region(report['pairs'][0], expected)
                self.assertEqual(report['images'][0]['visibleRoi'], parent_roi)
                self.assertEqual(report['images'][0]['analysisRoi'], {'x': 120/1280, 'y': 80/960, 'w': 1040/1280, 'h': 800/960})
                self.assertEqual(report['images'][1]['analysisWidth'], 820, 'native crop precedes preview downsampling')
                self.assertEqual((report['images'][1]['width'], report['images'][1]['height']), (1600, 1200))

    def test_optional_parent_and_child_roi_match_only_visible_pixels_and_return_full_parent_coordinates(self):
        expected = np.array([[110, 80], [520, 80], [520, 390], [110, 390]]) / [640, 480]
        child_canvas = Image.new('RGB', (1600, 1200), 'white')
        child_canvas.paste(self.crop, (400, 300))
        parent = {**item('parent', self.parent), 'roi': {'x': 60/640, 'y': 40/480, 'w': 520/640, 'h': 400/480}}
        child = {**item('child', child_canvas), 'roi': {'x': 400/1600, 'y': 300/1200, 'w': 410/1600, 'h': 310/1200}}
        report = links.locate_image_links([parent, child])
        self.assert_region(report['pairs'][0], expected)
        self.assertEqual(report['images'][1]['analysisWidth'], 410, 'crop precedes analysis downsampling')
        self.assertEqual(report['images'][1]['width'], 1600, 'native full-file dimensions remain authoritative')
        hidden = {**parent, 'roi': {'x': 0, 'y': 0, 'w': .25, 'h': .5}}
        self.assertEqual(links.locate_image_links([hidden, child])['pairs'][0]['status'], 'unresolved')

    def test_same_file_distinct_rois_are_not_mistaken_for_identical_fields(self):
        parent = {**item('parent', self.parent), 'roi': {'x': 0, 'y': 0, 'w': 1, 'h': 1}}
        child = {**item('child', self.parent), 'roi': {'x': 110/640, 'y': 80/480, 'w': 410/640, 'h': 310/480}}
        report = links.locate_image_links([parent, child])
        self.assert_region(report['pairs'][0], np.array([[110, 80], [520, 80], [520, 390], [110, 390]]) / [640, 480])

    def test_no_match_blanks_and_repeated_texture_never_return_guessed_roi(self):
        repeat = Image.new('RGB', (640, 480), '#151b22')
        draw = ImageDraw.Draw(repeat)
        for y in range(20, 480, 30):
            for x in range(20, 640, 30):
                draw.ellipse((x-7, y-7, x+7, y+7), fill='#ad83c4')
        for parent, child in [(self.parent, raster(999, (410, 310))),
                              (self.parent, Image.new('RGB', (410, 310), 'white')),
                              (repeat, repeat.crop((110, 80, 520, 390)))]:
            with self.subTest(size=child.size):
                pair = self.locate(child, parent)
                self.assertEqual(pair['status'], 'unresolved', pair)
                self.assertNotIn('parentCorners', pair)

    def test_partial_patch_and_reverse_order_cannot_imply_whole_child_containment(self):
        patchwork = raster(492, (410, 310))
        patchwork.paste(self.crop.crop((0, 0, 190, 140)), (0, 0))
        for parent, child in [(self.parent, patchwork), (self.crop, self.parent), (self.parent, self.parent)]:
            pair = self.locate(child, parent)
            self.assertEqual(pair['status'], 'unresolved', pair)
            self.assertNotIn('parentCorners', pair)

    def test_duplicated_complex_tiles_and_new_child_border_do_not_invent_a_location(self):
        tiled = Image.new('RGB', (820, 310))
        tiled.paste(self.crop, (0, 0)); tiled.paste(self.crop, (410, 0))
        for parent, child in [(tiled, self.crop), (self.parent, ImageOps.expand(self.crop, border=24, fill='white'))]:
            pair = self.locate(child, parent)
            self.assertEqual(pair['status'], 'unresolved', pair)
            self.assertNotIn('parentCorners', pair)

    def test_arbitrary_rotation_and_nonlinear_stretch_require_manual_localization(self):
        for child in [self.crop.rotate(13, resample=Image.Resampling.BICUBIC, expand=True),
                      self.crop.resize((610, 250), Image.Resampling.LANCZOS)]:
            pair = self.locate(child)
            self.assertEqual(pair['status'], 'unresolved', pair)
            self.assertNotIn('parentCorners', pair)

    def test_cancellation_count_and_untrusted_paths_fail_before_engine_use(self):
        good = item('parent', self.parent)
        with self.assertRaises(links.duplicate.ScanCancelled):
            links.locate_image_links([good, item('child', self.crop)], cancelled=lambda: True)
        with patch.object(links.duplicate, '_engine') as engine:
            for count in [0, 1, 4, 60]:
                with self.assertRaises(ValueError):
                    links.locate_image_links([{**good, 'id': str(i)} for i in range(count)])
            for value in ['https://example.invalid/private.png', 'C:/private.png', 'file:///private.png', 'data:image/svg+xml;base64,PHN2Zy8+']:
                with self.assertRaises(ValueError):
                    links.locate_image_links([good, {'id': 'bad', 'label': 'bad', 'data': value}])
            for roi in [None, {'x': 0, 'y': 0, 'w': 0, 'h': 1}, {'x': 0, 'y': 0, 'w': True, 'h': 1}, {'x': .5, 'y': 0, 'w': 1, 'h': 1}, {'x': 0, 'y': 0, 'w': float('nan'), 'h': 1}]:
                with self.assertRaises(ValueError):
                    links.locate_image_links([good, {**good, 'id': 'roi', 'roi': roi}])
            engine.assert_not_called()


if __name__ == '__main__':
    unittest.main()

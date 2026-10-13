"""Deterministic image-reuse cases, hard negatives and resource/input boundaries."""
import base64
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'skills/polish-sci-figures/scripts'))
import studio_duplicates as duplicate


def raster(seed=13, size=(480, 360)):
    """Synthetic microscopy-like images with distinct cells and local texture."""
    rng = np.random.default_rng(seed)
    background = np.clip(rng.normal(27, 7, (size[1], size[0], 3)), 0, 255).astype('uint8')
    image = Image.fromarray(background).filter(ImageFilter.GaussianBlur(.6))
    draw = ImageDraw.Draw(image)
    for _ in range(155):
        x, y = rng.integers(8, size[0] - 8), rng.integers(8, size[1] - 8)
        r, q = rng.integers(3, 12, 2)
        color = tuple(int(v) for v in rng.integers(45, 230, 3))
        draw.ellipse((x-r, y-q, x+r, y+q), fill=color, outline=(220, 165, 230))
        draw.line((x-r//2, y, x+r//2, y+q//2), fill=(24, 31, 40), width=2)
    return image.filter(ImageFilter.GaussianBlur(.45))


def data(image, fmt='PNG', **kwargs):
    stream = io.BytesIO()
    image.save(stream, format=fmt, **kwargs)
    return 'data:image/' + ('jpeg' if fmt == 'JPEG' else fmt.lower()) + ';base64,' + base64.b64encode(stream.getvalue()).decode('ascii')


def item(name, image, **kwargs):
    return {'id': name, 'label': '图片 ' + name, 'data': data(image, **kwargs)}


class DuplicateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = raster()

    def test_exact_pixel_identity_survives_reencoding(self):
        events = []
        a, b = item('a', self.original), item('b', self.original, compress_level=0)
        self.assertNotEqual(a['data'], b['data'])
        report = duplicate.scan_images([a, b], progress=events.append)
        self.assertEqual(report['matches'][0]['kind'], 'exact')
        self.assertTrue(report['matches'][0]['reviewRequired'])
        self.assertEqual(report['images'][0]['sha256'], report['images'][1]['sha256'])
        self.assertEqual(events[-1], {'stage': 'pairs', 'completed': 1, 'total': 1})
        json.dumps(report, allow_nan=False)
        evidence = Image.open(io.BytesIO(base64.b64decode(report['matches'][0]['evidence'].split(',')[1])))
        self.assertLessEqual(evidence.width, 1010)

    def test_resize_rotate_flip_crop_and_jpeg(self):
        variants = {
            'resized_jpeg': (self.original.resize((336, 252)), {'fmt': 'JPEG', 'quality': 80}),
            'rotate': (self.original.rotate(31, expand=True, resample=Image.Resampling.BICUBIC), {}),
            'flip': (ImageOps.mirror(self.original), {}),
            'vertical_flip': (ImageOps.flip(self.original), {}),
            'crop': (self.original.crop((90, 70, 390, 300)), {}),
            'crop_flip_resize': (ImageOps.mirror(self.original.crop((70, 40, 350, 290))).resize((380, 339)), {'fmt': 'JPEG', 'quality': 85}),
        }
        for name, (image, kwargs) in variants.items():
            with self.subTest(name=name):
                report = duplicate.scan_images([item('source', self.original), item(name, image, **kwargs)])
                self.assertEqual(len(report['matches']), 1, report['images'])
                match = report['matches'][0]
                self.assertGreaterEqual(match['inliers'], 12)
                self.assertGreater(match['contentAgreement'], .84)
                self.assertEqual(match['mirrored'], 'flip' in name)
                if 'crop' in name:
                    self.assertEqual(match['kind'], 'overlap')
                    self.assertLess(match['overlapA'], .8)
                    self.assertGreater(match['overlapB'], .9)

    def test_unrelated_microscopy_blank_and_repeating_textures(self):
        repetitive = Image.new('RGB', (400, 300), '#151b22')
        draw = ImageDraw.Draw(repetitive)
        for y in range(20, 300, 30):
            for x in range(20, 400, 30):
                draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill='#ad83c4')
        records = [item('microscopy_a', self.original), item('microscopy_b', raster(18)),
                   item('blank_white', Image.new('RGB', (300, 300), 'white')),
                   item('blank_gray', Image.new('RGB', (300, 300), '#dddddd')),
                   item('repetition_a', repetitive),
                   item('repetition_b', ImageOps.expand(repetitive.crop((10, 8, 390, 290)), border=15, fill='#151b22'))]
        report = duplicate.scan_images(records)
        self.assertEqual(report['matches'], [])
        self.assertIn('low_information', report['images'][2]['warnings'])

    def test_same_plot_axes_different_observations_not_duplicate(self):
        def plot(seed):
            im = Image.new('RGB', (600, 420), 'white')
            draw = ImageDraw.Draw(im)
            draw.line((55, 30, 55, 365, 570, 365), fill='black', width=2)
            for i in range(7):
                y = 365 - i * 48
                draw.text((25, y-5), str(i*10), fill='black')
                draw.line((50, y, 570, y), fill='#dddddd')
            draw.text((210, 10), 'Same template, different observations', fill='black')
            rng = np.random.default_rng(seed)
            for x in (150, 300, 450):
                draw.text((x-15, 380), 'Group', fill='black')
                for y in rng.integers(70, 340, 25):
                    xx = x + rng.integers(-20, 20)
                    draw.ellipse((xx-4, y-4, xx+4, y+4), fill='#436ca3')
            return im
        report = duplicate.scan_images([item('plot_a', plot(6)), item('plot_b', plot(22))])
        self.assertEqual(report['matches'], [])

    def test_cancel_and_invalid_payloads(self):
        valid = item('ok', self.original)
        with self.assertRaises(duplicate.ScanCancelled):
            duplicate.scan_images([valid, {**valid, 'id': 'other'}], cancelled=lambda: True)
        for bad in ('https://example.com/image.png', 'C:/private.png',
                    'data:image/svg+xml;base64,PHN2Zy8+', 'data:image/png;base64,!!!',
                    'data:image/png;base64,' + base64.b64encode(b'<svg/>').decode()):
            with self.subTest(payload=bad[:50]), self.assertRaises(ValueError):
                duplicate.scan_images([valid, {'id': 'bad', 'label': 'bad', 'data': bad}])
        with self.assertRaises(ValueError):
            duplicate.scan_images([valid, valid])
        with self.assertRaises(ValueError):
            duplicate.scan_images([valid])
        with patch.object(duplicate, 'MAX_ENCODED_BYTES', 100), self.assertRaises(ValueError):
            duplicate.scan_images([valid, {**valid, 'id': 'other'}])
        with patch.object(duplicate, 'MAX_PIXELS', 100), self.assertRaises(ValueError):
            duplicate.scan_images([valid, {**valid, 'id': 'other'}])
        events = []
        with self.assertRaises(duplicate.ScanCancelled):
            duplicate.scan_images([valid, {**valid, 'id': 'other'}], progress=events.append,
                                  cancelled=lambda: len(events) > 1)

    def test_no_silent_multipage_or_animated_first_frame(self):
        stream = io.BytesIO()
        self.original.save(stream, format='TIFF', save_all=True, append_images=[raster(42)])
        record = {'id': 'pages', 'label': 'pages', 'data': 'data:image/tiff;base64,' + base64.b64encode(stream.getvalue()).decode()}
        with self.assertRaisesRegex(ValueError, 'separately'):
            duplicate.scan_images([item('a', self.original), record])

    def test_high_depth_native_identity_is_not_eight_bit_clipping(self):
        import cv2
        pixels = np.asarray(self.original.convert('L')).astype(np.uint16) * 180 + 1200
        other = np.asarray(raster(28).convert('L')).astype(np.uint16) * 180 + 1200
        report = duplicate.scan_images([item('a', Image.fromarray(pixels), fmt='TIFF'),
                                        item('other', Image.fromarray(other), fmt='TIFF'),
                                        item('identical', Image.fromarray(pixels), fmt='PNG')])
        self.assertEqual([(m['a'], m['b'], m['kind']) for m in report['matches']], [('a', 'identical', 'exact')])
        self.assertNotEqual(report['images'][0]['sha256'], report['images'][1]['sha256'])
        self.assertIn('high_bit_depth_preview', report['images'][0]['warnings'])
        self.assertGreater(report['images'][0]['intensityMapping']['minimum'], 255)
        # Pillow can expose 16-bit RGB as 8-bit RGB; the source bit depth still
        # requires a native-depth decode, not a clipped/quantized identity hash.
        rgb = np.asarray(self.original).astype(np.uint16) * 200 + 1200
        shifted = rgb + 1
        records = []
        for name, values in [('rgb16', rgb), ('plus_one', shifted)]:
            ok, encoded = cv2.imencode('.png', cv2.cvtColor(values, cv2.COLOR_RGB2BGR))
            self.assertTrue(ok)
            records.append({'id': name, 'label': name, 'data': 'data:image/png;base64,' + base64.b64encode(encoded).decode()})
        report = duplicate.scan_images(records)
        self.assertNotEqual(report['images'][0]['sha256'], report['images'][1]['sha256'])
        self.assertTrue(all(m['kind'] != 'exact' for m in report['matches']))
        self.assertEqual(report['images'][0]['intensityMapping']['sourceDtype'], 'uint16')
        invalid = np.full((80, 80), np.nan, np.float32)
        with self.assertRaisesRegex(ValueError, 'NaN'):
            duplicate.scan_images([item('a', self.original), item('float', Image.fromarray(invalid), fmt='TIFF')])

    def test_reverse_order_crop_and_original_dimensions(self):
        report = duplicate.scan_images([item('crop', self.original.crop((150, 100, 300, 220))),
                                        item('source', self.original)])
        self.assertEqual(report['matches'][0]['kind'], 'overlap')
        self.assertGreater(report['matches'][0]['overlapA'], .9)
        self.assertLess(report['matches'][0]['overlapB'], .2)
        native = np.zeros((1000, 1200), np.uint16)
        report = duplicate.scan_images([item('a', Image.fromarray(native), fmt='TIFF'),
                                        item('b', Image.fromarray(native), fmt='TIFF')])
        self.assertEqual(report['images'][0]['width'], 1200)
        self.assertEqual(report['images'][0]['height'], 1000)
        self.assertEqual(report['images'][0]['analysisWidth'], 900)

    def test_evidence_limits_keep_pair_records(self):
        image = Image.new('RGB', (25, 25), '#555555')
        records = [item(str(i), image) for i in range(6)]
        with patch.object(duplicate, 'MAX_EVIDENCE', 2):
            report = duplicate.scan_images(records)
        self.assertEqual(report['pairCount'], 15)
        self.assertEqual(len(report['matches']), 15)
        self.assertEqual(report['evidenceOmitted'], 13)
        self.assertEqual(sum(bool(m['evidence']) for m in report['matches']), 2)
        self.assertIn('evidence_limit', report['warnings'])
        with patch.object(duplicate, 'MAX_EVIDENCE_BYTES', 10):
            report = duplicate.scan_images(records)
        self.assertEqual(report['evidenceBytes'], 0)
        self.assertEqual(report['evidenceOmitted'], 15)


if __name__ == '__main__':
    unittest.main(verbosity=2)

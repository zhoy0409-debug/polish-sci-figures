"""Real encoded TIFFs: native sample fidelity, OME mappings and explicit refusals."""
import base64
import hashlib
import io
import json
import http.client
from http.server import ThreadingHTTPServer
from pathlib import Path
import struct
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image, TiffImagePlugin

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "skills/polish-sci-figures/scripts"))
import studio_tiff as tiff


def encoded(arrays, description=None, compression="raw", extra_tags=None):
    images = [Image.fromarray(array) for array in arrays]
    tags = TiffImagePlugin.ImageFileDirectory_v2()
    if description:
        tags[270] = description
    for key, value in (extra_tags or {}).items():
        tags[key] = value
    result = io.BytesIO()
    images[0].save(result, format="TIFF", save_all=True, append_images=images[1:],
                   compression=compression, tiffinfo=tags)
    return result.getvalue()


def call(raw, action="inspect", **parameters):
    return tiff.request({"data": base64.b64encode(raw).decode(), "action": action, **parameters})


def ome(x=3, y=2, c=2, z=1, time=1, order="XYCZT", blocks="<TiffData/>", pixel_type="uint16", prefix=False):
    content = f'<Image ID="Image:0"><Pixels ID="Pixels:0" SizeX="{x}" SizeY="{y}" SizeC="{c}" SizeZ="{z}" SizeT="{time}" Type="{pixel_type}" DimensionOrder="{order}" PhysicalSizeX="0.25" PhysicalSizeXUnit="µm">'
    content += ''.join(f'<Channel ID="Channel:0:{i}" Name="channel-{i}" SamplesPerPixel="1"/>' for i in range(c))
    content += blocks + '</Pixels></Image>'
    if prefix:
        content = content.replace('<', '<ome:').replace('<ome:/', '</ome:')
        return '<ome:OME xmlns:ome="http://www.openmicroscopy.org/Schemas/OME/2016-06">' + content + '</ome:OME>'
    return '<OME xmlns="http://www.openmicroscopy.org/Schemas/OME/2016-06">' + content + '</OME>'


def rgb16_bytes():
    # A real little-endian RGB16 TIFF. Pillow exposes it as RGB8, so the header
    # must refuse it before that implicit precision reduction can reach Studio.
    count = 10
    bit_offset = 8 + 2 + count * 12 + 4
    pixel_offset = bit_offset + 6
    tags = [(256, 4, 1, 2), (257, 4, 1, 2), (258, 3, 3, bit_offset),
            (259, 3, 1, 1), (262, 3, 1, 2), (273, 4, 1, pixel_offset),
            (277, 3, 1, 3), (278, 4, 1, 2), (279, 4, 1, 24), (284, 3, 1, 1)]
    entries = b''.join(struct.pack('<HHII', *tag) for tag in tags)
    return b'II*\0' + struct.pack('<I', 8) + struct.pack('<H', count) + entries + b'\0' * 4 + struct.pack('<HHH', 16, 16, 16) + np.arange(12, dtype='<u2').tobytes()


class ScientificTiff(unittest.TestCase):
    def setUp(self):
        self.native = np.array([[0, 256, 1024], [2048, 4095, 65535]], dtype=np.uint16)

    def test_both_byte_orders_preserve_native_samples_and_explicit_display_window(self):
        expected = np.round(np.clip(self.native.astype(float) / 4095, 0, 1) * 255).astype('u1')
        for dtype in ('<u2', '>u2'):
            with self.subTest(dtype=dtype):
                raw = encoded([self.native.astype(dtype)])
                original = bytes(raw)
                metadata = call(raw)['metadata']
                self.assertEqual(metadata['fileSha256'], hashlib.sha256(original).hexdigest())
                self.assertEqual(metadata['pages'][0]['bitsPerSample'], [16])
                self.assertFalse(metadata['decodingVerified'])
                with self.assertRaisesRegex(ValueError, 'explicit valid window'):
                    call(raw, 'display')
                result = call(raw, 'display', window=[0, 4095])
                native_sha = hashlib.sha256(self.native.astype('<u2').tobytes()).hexdigest()
                self.assertEqual(result['native']['samplesSha256'], native_sha)
                self.assertTrue(result['metadata']['decodingVerified'])
                display = np.asarray(Image.open(io.BytesIO(base64.b64decode(result['display']['data']))))
                np.testing.assert_array_equal(display, np.repeat(expected[..., None], 3, axis=-1))
                self.assertEqual(raw, original)
                with Image.open(io.BytesIO(raw)) as reread:
                    np.testing.assert_array_equal(np.asarray(reread), self.native)

    def test_native_lossless_compressions(self):
        for compression in ('raw', 'tiff_lzw', 'tiff_adobe_deflate'):
            with self.subTest(compression=compression):
                raw = encoded([self.native], compression=compression)
                result = call(raw, 'display', window=[0, 65535])
                self.assertEqual(result['native']['samplesSha256'], hashlib.sha256(self.native.astype('<u2').tobytes()).hexdigest())

    def test_global_suggestion_and_constant_image_do_not_modify_native_data(self):
        raw = encoded([self.native])
        result = call(raw, 'suggest')
        self.assertEqual(result['suggestedWindow'], [0, 65535])
        self.assertEqual(result['method'], 'global-native-min-max')
        self.assertTrue(result['forDisplayOnly'])
        self.assertEqual(call(encoded([np.full((2, 3), 500, dtype='u2')]), 'suggest')['suggestedWindow'], [0, 65535])

    def test_rgb8_preserves_actual_values(self):
        pixels = np.array([[[1, 55, 200], [0, 255, 111]]], dtype='u1')
        raw = encoded([pixels])
        result = call(raw, 'display', window=[0, 255])
        shown = np.asarray(Image.open(io.BytesIO(base64.b64decode(result['display']['data']))))
        np.testing.assert_array_equal(shown, pixels)
        with self.assertRaisesRegex(ValueError, 'LUT'):
            call(raw, 'display', window=[0, 255], lut='green')

    def test_rgb_native_icc_is_retained_in_display_png(self):
        from PIL import ImageCms
        profile = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
        raw = encoded([np.array([[[10, 30, 200]]], dtype='u1')], extra_tags={34675: profile})
        result = call(raw, 'display', window=[0, 255])
        self.assertEqual(result['metadata']['pages'][0]['iccProfileSha256'], hashlib.sha256(profile).hexdigest())
        self.assertEqual(result['display']['iccProfileSha256'], hashlib.sha256(profile).hexdigest())
        with Image.open(io.BytesIO(base64.b64decode(result['display']['data']))) as displayed:
            self.assertEqual(displayed.info['icc_profile'], profile)

    def test_rgb16_is_refused_before_pillow_precision_reduction(self):
        raw = rgb16_bytes()
        with Image.open(io.BytesIO(raw)) as image:
            self.assertEqual(image.mode, 'RGB')
            self.assertEqual(tuple(image.tag_v2[258]), (16, 16, 16))
        info = call(raw)['metadata']['pages'][0]
        self.assertFalse(info['supported'])
        with self.assertRaisesRegex(ValueError, 'RGB16'):
            call(raw, 'display', window=[0, 255])

    def test_signed_float_and_orientation_are_explicitly_refused(self):
        for pixels in (self.native.astype('int32'), self.native.astype('float32')):
            raw = encoded([pixels])
            self.assertFalse(call(raw)['metadata']['pages'][0]['supported'])
            with self.assertRaisesRegex(ValueError, 'unsigned'):
                call(raw, 'display', window=[0, 65535])
        raw = encoded([self.native], extra_tags={274: 6})
        self.assertFalse(call(raw)['metadata']['pages'][0]['supported'])
        with self.assertRaisesRegex(ValueError, 'orientation'):
            call(raw, 'display', window=[0, 65535])

    def test_preview_resampling_is_declared_and_native_hash_remains_full_resolution(self):
        pixels = np.arange(512 * 256, dtype='u2').reshape(256, 512)
        raw = encoded([pixels])
        result = call(raw, 'display', window=[0, 65535], previewEdge=256, lut='magenta')
        self.assertTrue(result['display']['resampled'])
        self.assertEqual(result['display']['size'], [256, 128])
        self.assertEqual(result['native']['size'], [512, 256])
        self.assertEqual(result['native']['samplesSha256'], hashlib.sha256(pixels.astype('<u2').tobytes()).hexdigest())

    def test_bounded_strip_processing_is_pixel_exact_to_the_shared_global_formula(self):
        sys.path.insert(0, str(ROOT / 'skills/standardize-sci-images/scripts'))
        from standardize_images import apply_display
        gray = (np.arange(48, dtype='u2').reshape(4, 12) * 1000)
        rgb = np.arange(144, dtype='u1').reshape(4, 12, 3)
        for pixels, window, lut in ((gray, [100, 45000], 'gray'), (gray.astype('>u2'), [100, 45000], 'magenta'), (rgb, [10, 140], 'gray')):
            with self.subTest(dtype=pixels.dtype, lut=lut):
                original = Image.fromarray(pixels)
                before = np.asarray(original).copy()
                expected = apply_display(original, window[0], window[1], 1.7, lut)
                with patch.object(tiff, 'DISPLAY_TILE_PIXELS', 16):
                    actual = tiff._display_image(original, window, 1.7, lut)
                np.testing.assert_array_equal(np.asarray(actual), np.asarray(expected))
                np.testing.assert_array_equal(np.asarray(original), before)

    def test_ome_default_mapping_and_prefix_namespace(self):
        for prefix in (False, True):
            raw = encoded([self.native, self.native + 1], ome(prefix=prefix))
            metadata = call(raw)['metadata']
            self.assertTrue(metadata['ome']['complete'])
            self.assertEqual(metadata['pages'][1]['omePosition'], {'C': 1, 'Z': 0, 'T': 0})
            self.assertEqual(metadata['ome']['physicalSize']['PhysicalSizeX'], '0.25')
            result = call(raw, 'display', page=1, window=[0, 65535])
            self.assertEqual(result['native']['samplesSha256'], hashlib.sha256((self.native + 1).astype('<u2').tobytes()).hexdigest())

    def test_ome_explicit_reverse_time_is_not_guessed_from_ifd_order(self):
        blocks = '<TiffData IFD="0" FirstT="1"/><TiffData IFD="1" FirstT="0"/>'
        raw = encoded([self.native, self.native], ome(c=1, time=2, order='XYZCT', blocks=blocks))
        pages = call(raw)['metadata']['pages']
        self.assertEqual(pages[0]['omePosition'], {'Z': 0, 'C': 0, 'T': 1})
        self.assertEqual(pages[1]['omePosition'], {'Z': 0, 'C': 0, 'T': 0})

    def test_ome_published_xyz_tc_raster_example_and_nonzero_start(self):
        # Independent expected positions from the OME-TIFF specification's
        # XYZTC example; do not implement the decoder algorithm in the oracle.
        expected = [(0, 0, 0), (1, 0, 0), (2, 0, 0), (0, 1, 0), (1, 1, 0), (2, 1, 0),
                    (0, 0, 1), (1, 0, 1), (2, 0, 1), (0, 1, 1), (1, 1, 1), (2, 1, 1)]
        metadata = call(encoded([self.native] * 12, ome(z=3, time=2, order='XYZTC')))['metadata']
        actual = [(page['omePosition']['Z'], page['omePosition']['T'], page['omePosition']['C']) for page in metadata['pages']]
        self.assertEqual(actual, expected)
        partial = call(encoded([self.native] * 3, ome(z=3, time=2, order='XYZTC', blocks='<TiffData IFD="1" FirstZ="2" PlaneCount="2"/>')))['metadata']
        self.assertFalse(partial['pages'][0]['supported'])
        self.assertEqual(partial['pages'][1]['omePosition'], {'Z': 2, 'T': 0, 'C': 0})
        self.assertEqual(partial['pages'][2]['omePosition'], {'Z': 0, 'T': 1, 'C': 0})

    def test_ome_does_not_invent_missing_calibration_or_significant_bits(self):
        raw = encoded([self.native] * 2, ome())
        metadata = call(raw)['metadata']['ome']
        self.assertIsNone(metadata['significantBits'])
        self.assertNotIn('PhysicalSizeY', metadata['physicalSize'])
        explicit = ome().replace('Type="uint16"', 'Type="uint16" SignificantBits="12"')
        self.assertEqual(call(encoded([self.native] * 2, explicit))['metadata']['ome']['significantBits'], 12)

    def test_partial_and_extraneous_ifds_are_explicit(self):
        partial = call(encoded([self.native], ome()))['metadata']['ome']
        self.assertFalse(partial['complete'])
        self.assertEqual(partial['declaredPlanes'], 2)
        extra = call(encoded([self.native, self.native, self.native], ome()))['metadata']
        self.assertFalse(extra['pages'][2]['supported'])
        with self.assertRaisesRegex(ValueError, 'not declared'):
            call(encoded([self.native] * 3, ome()), 'display', page=2, window=[0, 65535])

    def test_ome_conflicts_and_external_references_are_refused(self):
        cases = [ome(pixel_type='uint8'), ome(x=99),
                 ome(blocks='<TiffData IFD="0"/><TiffData IFD="0"/>'),
                 ome(blocks='<TiffData IFD="5"/>'),
                 ome(blocks='<TiffData><UUID FileName="private.tif">external</UUID></TiffData>'),
                 ome(blocks=''), ome(blocks='<TiffData FirstQ="1"/>'),
                 ome().replace('Type="uint16"', 'Type="uint16" Interleaved="true"')]
        for xml in cases:
            with self.subTest(xml=xml):
                with self.assertRaises(ValueError):
                    call(encoded([self.native] * 2, xml))
        entity = '<!DOCTYPE OME [<!ENTITY value "unsafe">]>' + ome()
        with self.assertRaisesRegex(ValueError, 'DTD/entity'):
            call(encoded([self.native], entity))

    def test_limits_and_invalid_parameters_do_not_produce_fake_output(self):
        raw = encoded([self.native])
        for parameters in ({'window': None}, {'window': [0, float('inf')]}, {'window': [False, 5]},
                           {'window': [0, 65535], 'gamma': float('nan')},
                           {'window': [0, 65535], 'previewEdge': 20},
                           {'window': [0, 65535], 'page': True}):
            with self.subTest(parameters=parameters):
                with self.assertRaises(ValueError):
                    call(raw, 'display', **parameters)
        for payload in ({'action': 'inspect', 'path': 'private.tif'}, {'action': 'inspect', 'data': 'https://example.com/file.tif'},
                        {'action': 'inspect', 'data': base64.b64encode(b'not TIFF').decode()}):
            with self.assertRaises(ValueError):
                tiff.request(payload)
        with patch.object(tiff, 'MAX_BYTES', 100):
            with self.assertRaises(ValueError):
                call(b'II*\0' + b'\0' * 101)
        with self.assertRaisesRegex(ValueError, '128'):
            call(encoded([np.ones((2, 2), dtype='u1')] * 129))


class ScientificTiffSessions(unittest.TestCase):
    def test_upload_request_release_reuses_immutable_source_without_base64(self):
        raw = encoded([np.array([[0, 256], [1024, 65535]], dtype='u2')])
        store = tiff.TiffSessions()
        uploaded = store.upload(raw)
        result = store.request({'action': 'display', 'sourceId': uploaded['sourceId'], 'window': [0, 65535]})
        self.assertEqual(result['metadata']['fileSha256'], hashlib.sha256(raw).hexdigest())
        self.assertTrue(result['metadata']['decodingVerified'])
        self.assertFalse(uploaded['metadata']['decodingVerified'])
        self.assertEqual(store.snapshot(), {'count': 1, 'rawBytes': len(raw)})
        self.assertTrue(store.request({'action': 'release', 'sourceId': uploaded['sourceId']})['released'])
        self.assertEqual(store.snapshot(), {'count': 0, 'rawBytes': 0})
        with self.assertRaisesRegex(ValueError, 'expired'):
            store.request({'action': 'display', 'sourceId': uploaded['sourceId'], 'window': [0, 65535]})

    def test_source_lru_and_lazy_expiry_are_bounded_and_isolated(self):
        now = [0]
        store = tiff.TiffSessions(clock=lambda: now[0])
        raw = encoded([np.ones((2, 2), dtype='u1')])
        first, second = store.upload(raw), store.upload(raw)
        store.request({'action': 'inspect', 'sourceId': first['sourceId']})
        third = store.upload(raw)
        self.assertEqual(store.snapshot()['count'], 2)
        with self.assertRaisesRegex(ValueError, 'expired'):
            store.request({'action': 'inspect', 'sourceId': second['sourceId']})
        self.assertEqual(store.request({'action': 'inspect', 'sourceId': third['sourceId']})['metadata']['fileBytes'], len(raw))
        with self.assertRaises(ValueError):
            store.request({'action': 'inspect', 'sourceId': third['sourceId'], 'path': 'private.tif'})
        now[0] = 1801
        self.assertEqual(store.snapshot(), {'count': 0, 'rawBytes': 0})


class ScientificTiffHttp(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from studio_server import Handler
        cls.temporary = tempfile.TemporaryDirectory(prefix='tiff-http-', dir=ROOT / '.cache')
        cls.directory = Path(cls.temporary.name).resolve()
        cls.directory.relative_to((ROOT / '.cache').resolve())
        page = cls.directory / 'public.html'
        page.write_text('<html><head></head><body>Public TIFF regression</body></html>', encoding='utf-8')
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.server.page = page
        cls.server.token = 'synthetic-local-only'
        cls.server.address = '127.0.0.1:' + str(cls.server.server_address[1])
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)
        cls.directory.relative_to((ROOT / '.cache').resolve())
        cls.temporary.cleanup()

    def post(self, payload, headers=None, route='/api/import-tiff'):
        request_headers = {'Host': self.server.address, 'Origin': 'http://' + self.server.address,
                           'X-Studio-Token': self.server.token, 'Content-Type': 'application/json'}
        request_headers.update(headers or {})
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_address[1], timeout=5)
        try:
            connection.request('POST', route, json.dumps(payload), headers=request_headers)
            response = connection.getresponse()
            return response.status, json.loads(response.read())
        finally:
            connection.close()

    def test_real_local_api_display_and_no_source_write(self):
        pixels = np.array([[0, 1000], [4000, 65535]], dtype='u2')
        raw = encoded([pixels])
        original = bytes(raw)
        status, result = self.post({'action': 'display', 'data': base64.b64encode(raw).decode(), 'window': [0, 65535]})
        self.assertEqual(status, 200)
        self.assertEqual(result['tiff']['metadata']['fileSha256'], hashlib.sha256(raw).hexdigest())
        self.assertEqual(result['tiff']['native']['samplesSha256'], hashlib.sha256(pixels.astype('<u2').tobytes()).hexdigest())
        self.assertFalse(result['tiff']['display']['quantitative'])
        self.assertGreaterEqual(result['seconds'], 0)
        self.assertEqual(raw, original)

    def test_capability_is_local_and_does_not_contact_a_release_service(self):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_address[1], timeout=5)
        try:
            connection.request('GET', '/', headers={'Host': self.server.address})
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            text = response.read().decode()
            self.assertIn('"tiffEndpoint": "/api/import-tiff"', text)
            self.assertNotIn('https://', text)
        finally:
            connection.close()

    def test_host_origin_and_token_guards_cover_new_and_existing_routes(self):
        payload = {'action': 'inspect', 'data': base64.b64encode(encoded([np.ones((2, 2), dtype='u1')])).decode()}
        for header in ({'Host': 'untrusted.invalid'}, {'Origin': 'https://untrusted.invalid'}, {'X-Studio-Token': 'wrong'}):
            for route in ('/api/import-tiff', '/api/render'):
                with self.subTest(header=header, route=route):
                    self.assertEqual(self.post(payload, header, route)[0], 403)

    def test_binary_upload_uses_same_local_authorization_and_short_id(self):
        raw = encoded([np.array([[0, 65535]], dtype='u2')])
        def upload(extra=None):
            headers = {'Host': self.server.address, 'Origin': 'http://' + self.server.address,
                       'X-Studio-Token': self.server.token, 'Content-Type': 'image/tiff'}
            headers.update(extra or {})
            connection = http.client.HTTPConnection('127.0.0.1', self.server.server_address[1], timeout=5)
            try:
                connection.request('POST', '/api/import-tiff', raw, headers=headers)
                response = connection.getresponse()
                return response.status, json.loads(response.read())
            finally:
                connection.close()
        self.assertEqual(upload({'X-Studio-Token': 'wrong'})[0], 403)
        self.assertEqual(upload({'Origin': 'https://untrusted.invalid'})[0], 403)
        self.assertEqual(upload({'Content-Length': '64000001'})[0], 422)
        status, uploaded = upload()
        self.assertEqual(status, 200)
        self.assertNotIn('data', uploaded['tiff'])
        key = uploaded['tiff']['sourceId']
        status, shown = self.post({'action': 'display', 'sourceId': key, 'window': [0, 65535]})
        self.assertEqual(status, 200)
        self.assertEqual(shown['tiff']['metadata']['fileSha256'], hashlib.sha256(raw).hexdigest())
        self.assertTrue(self.post({'action': 'release', 'sourceId': key})[1]['tiff']['released'])

    def test_no_paths_remote_download_or_oversized_body(self):
        for payload in ({'action': 'inspect', 'data': 'https://untrusted.invalid/private.tiff'},
                        {'action': 'inspect', 'path': 'private.tiff'}):
            self.assertEqual(self.post(payload)[0], 422)
        status, result = self.post({}, {'Content-Length': '27000001'})
        self.assertEqual(status, 422)
        self.assertIn('27 MB', result['error'])


if __name__ == '__main__':
    unittest.main()

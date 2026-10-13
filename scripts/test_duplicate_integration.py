"""Real HTTP authorization, cancellation, file extraction and evidence reports."""
import base64
import http.client
import io
import json
from pathlib import Path
import sys
import struct
import tempfile
import threading
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/polish-sci-figures/scripts'))
from duplicate_files import collect_files, write_report
from studio_duplicate_jobs import DuplicateJobs
from studio_server import Handler
from http.server import ThreadingHTTPServer
from PIL import Image, ImageDraw, UnidentifiedImageError


def picture():
    im = Image.new('RGB', (120, 100), '#29354b')
    draw = ImageDraw.Draw(im)
    for n in range(10):
        draw.ellipse((n*11, n*7, n*11+15, n*7+12), fill=(20*n, 220-n*8, 160))
    raw = io.BytesIO(); im.save(raw, format='PNG')
    return raw.getvalue()


def high_depth_color_tiff(frames=2, photometric=5):
    """Native 16-bit CMYK/Lab fixture without an optional TIFF dependency.

    Frames differ only in low bits, which Pillow's 8-bit color view discards.
    This makes silent frame-conversion bugs visible as false exact duplicates.
    """
    import numpy as np
    width = height = 32
    channels = 4 if photometric == 5 else 3
    values = np.arange(width * height * channels, dtype=np.uint16).reshape(height, width, channels) * 8 + 1024
    offset = 8
    chunks = []
    for frame in range(frames):
        native = values + frame
        extra = offset + 2 + 10 * 12 + 4
        pixels = extra + channels * 2
        end = pixels + native.nbytes
        fields = [(256, 4, 1, width), (257, 4, 1, height), (258, 3, channels, extra),
                  (259, 3, 1, 1), (262, 3, 1, photometric), (273, 4, 1, pixels),
                  (277, 3, 1, channels), (278, 4, 1, height), (279, 4, 1, native.nbytes), (284, 3, 1, 1)]
        chunks.append(struct.pack('<H', 10) + b''.join(struct.pack('<HHII', *field) for field in fields)
                      + struct.pack('<I', 0 if frame == frames - 1 else end)
                      + struct.pack('<' + 'H' * channels, *([16] * channels)) + native.tobytes())
        offset = end
    return b'II' + struct.pack('<HI', 42, 8) + b''.join(chunks)


class Integration(unittest.TestCase):
    def test_files_and_reports(self):
        cache = ROOT / '.cache/duplicate-tests'
        cache.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=cache) as directory:
            base = Path(directory)
            raw = picture(); data = 'data:image/png;base64,' + base64.b64encode(raw).decode()
            (base/'a.png').write_bytes(raw)
            (base/'b.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"><defs><image id="r" href="'+data+'"/></defs><g><use href="#r"/></g><image href="https://example.invalid/private.png"/></svg>', encoding='utf-8')
            images, warnings = collect_files([base/'a.png', base/'b.svg'])
            self.assertEqual(len(images), 2)
            self.assertEqual(len(warnings), 1)
            from studio_duplicates import scan_images
            result = scan_images(images)
            self.assertEqual(result['matches'][0]['kind'], 'exact')
            result['images'][0]['label'] = '<script>alert(1)</script>'
            path = write_report(result, base/'report')
            self.assertIn('&lt;script&gt;', path.read_text(encoding='utf-8'))
            self.assertNotIn('<script>alert', path.read_text(encoding='utf-8'))
            self.assertTrue((base/'report'/'evidence-001.png').is_file())
            self.assertTrue((base/'report'/'matches.csv').is_file())
            result['matches'][0]['evidence'] = None
            result['matches'][0]['evidenceAvailable'] = False
            result['warnings'] = ['evidence_limit']
            result['evidenceOmitted'] = 1
            limited = write_report(result, base/'limited-report').read_text(encoding='utf-8')
            self.assertIn('1 matching pairs remain', limited)
            self.assertIn('保留 1 组匹配记录', limited)
            self.assertNotIn('<li>evidence_limit</li>', limited)
            with self.assertRaises(FileExistsError):
                write_report(result, base/'report')
            self.assertEqual((base/'a.png').read_bytes(), raw)
            (base/'bad.svg').write_text('<!DOCTYPE svg [<!ENTITY x "value">]><svg>&x;</svg>', encoding='utf-8')
            with self.assertRaises(ValueError):
                collect_files([base/'bad.svg'])
            (base/'utf16.svg').write_text('<!DOCTYPE svg [<!ENTITY x "value">]><svg>&x;</svg>', encoding='utf-16')
            with self.assertRaises(ValueError):
                collect_files([base/'utf16.svg'])
            (base/'deep.svg').write_text('<svg>' + '<g>'*150 + '</g>'*150 + '</svg>', encoding='utf-8')
            with self.assertRaises(ValueError):
                collect_files([base/'deep.svg'])
            (base/'hidden.svg').write_text('<svg><image visibility="hidden" href="'+data+'"/><image opacity="0" href="'+data+'"/><image href="'+data+'"/></svg>', encoding='utf-8')
            visible, notes = collect_files([base/'a.png', base/'hidden.svg'])
            self.assertEqual(len(visible), 2)
            self.assertEqual(len(notes), 2)
            import numpy as np
            values = np.arange(1024, dtype=np.uint16).reshape((32, 32)) + 500
            Image.fromarray(values).save(base/'frames.tif', save_all=True, append_images=[Image.fromarray(values+1)])
            frames, _ = collect_files([base/'frames.tif'])
            native_result = scan_images(frames)
            self.assertNotEqual(native_result['images'][0]['sha256'], native_result['images'][1]['sha256'])
            self.assertFalse(any(m['kind']=='exact' for m in native_result['matches']))
            for folder in ('experiment-a','experiment-b'):
                (base/folder).mkdir(); (base/folder/'same.png').write_bytes(raw)
            named, _ = collect_files([base/'experiment-a/same.png', base/'experiment-b/same.png'])
            self.assertNotEqual(named[0]['label'], named[1]['label'])

    def test_high_depth_color_images_are_not_silently_quantized(self):
        from studio_duplicates import scan_images
        cache = ROOT / '.cache/duplicate-tests'
        cache.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=cache) as directory:
            for photometric, mode in [(5, 'CMYK'), (8, 'LAB')]:
                with self.subTest(mode=mode):
                    stack = high_depth_color_tiff(2, photometric)
                    if mode == 'CMYK':
                        with Image.open(io.BytesIO(stack)) as source:
                            self.assertEqual(source.mode, mode)
                            self.assertEqual(source.tag_v2[258], (16,) * 4)
                    path = Path(directory) / (mode + '.tif')
                    path.write_bytes(stack)
                    with self.assertRaises((ValueError, UnidentifiedImageError)):
                        collect_files([path])
                    self.assertEqual(path.read_bytes(), stack)
                    single = high_depth_color_tiff(1, photometric)
                    value = 'data:image/tiff;base64,' + base64.b64encode(single).decode('ascii')
                    with self.assertRaises(ValueError):
                        scan_images([{'id': str(i), 'label': mode + str(i), 'data': value} for i in range(2)])

    def test_cancel_and_single_worker(self):
        def scanner(images, progress, cancelled):
            while not cancelled():
                time.sleep(.005)
            raise RuntimeError('cancelled')
        jobs = DuplicateJobs(scanner)
        images = [{'id':str(i), 'label':str(i), 'data':'fake'} for i in range(2)]
        job = jobs.request({'action':'start', 'images':images})['jobId']
        with self.assertRaises(ValueError):
            jobs.request({'action':'start', 'images':images})
        jobs.request({'action':'cancel', 'jobId':job})
        for _ in range(100):
            status = jobs.request({'action':'status', 'jobId':job})
            if status['status'] != 'running': break
            time.sleep(.01)
        self.assertEqual(status['status'], 'cancelled')
        self.assertNotIn('result', status)
        with self.assertRaises(ValueError):
            jobs.request({'action':'status', 'jobId':'other'})
        with self.assertRaises(ValueError):
            jobs.request({'action':'start', 'images':images, 'path':'/tmp/a'})

    def test_http(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        server.address = '127.0.0.1:' + str(server.server_port)
        server.token = 'test-local-only'
        cache = ROOT / '.cache/duplicate-tests'
        cache.mkdir(parents=True, exist_ok=True)
        server.page = cache / 'injection.html'
        server.page.write_text('<html><head></head><body><script>const report="</head>";</script></body></html>', encoding='utf-8')
        threading.Thread(target=server.serve_forever, daemon=True).start()
        def request(payload, authenticated=True):
            connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=10)
            headers = {'Content-Type':'application/json', 'Origin':'http://' + server.address}
            if authenticated: headers['X-Studio-Token'] = server.token
            connection.request('POST', '/api/image-duplicates', json.dumps(payload), headers)
            response = connection.getresponse()
            value = json.loads(response.read()); status = response.status
            connection.close()
            return status, value
        try:
            connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=10)
            connection.request('GET', '/')
            markup = connection.getresponse().read().decode()
            connection.close()
            self.assertEqual(markup.count('id="local-engine"'), 1)
            self.assertIn('const report="</head>"', markup)
            self.assertEqual(request({'action':'start', 'images':[]}, False)[0], 403)
            self.assertEqual(request({'action':'start', 'images':[]})[0], 422)
            data = 'data:image/png;base64,' + base64.b64encode(picture()).decode()
            payload = {'action':'start', 'images':[{'id':str(i), 'label':str(i), 'data':data} for i in range(2)]}
            status, job = request(payload)
            self.assertEqual(status, 200)
            for _ in range(200):
                status, result = request({'action':'status', 'jobId':job['jobId']})
                if result['status'] != 'running': break
                time.sleep(.02)
            self.assertEqual(result['status'], 'complete', result)
            self.assertEqual(result['result']['matches'][0]['kind'], 'exact')
        finally:
            server.shutdown(); server.server_close()


if __name__ == '__main__': unittest.main()

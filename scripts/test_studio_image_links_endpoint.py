"""Real authenticated localhost image-link API, ROI and request boundaries."""
import http.client
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import sys
import threading
import unittest
from unittest.mock import patch

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'skills/polish-sci-figures/scripts'))
from studio_server import Handler
from test_image_duplicates import item, raster


class ImageLinksHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.server.address = '127.0.0.1:'+str(cls.server.server_port)
        cls.server.token = 'local-image-link-test-token'
        cls.server.page = ROOT/'.cache/image-links-http.html'
        cls.server.page.parent.mkdir(parents=True, exist_ok=True)
        cls.server.page.write_text('<html><head></head><body>Local test</body></html>', encoding='utf-8')
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        parent = raster(13, (640, 480))
        cls.payload = {'images': [item('parent', parent),
                                 {**item('child', parent), 'roi': {'x': 110/640, 'y': 80/480, 'w': 410/640, 'h': 310/480}}]}

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join(timeout=5)

    def request(self, payload, override=None, *, headers_only=False):
        headers = {'Content-Type': 'application/json', 'Origin': 'http://'+self.server.address,
                   'X-Studio-Token': self.server.token}
        headers.update(override or {})
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=20)
        try:
            body = json.dumps(payload).encode('utf-8')
            if headers_only:
                # Rejection must not wait for image bytes. Sending the large
                # body after an early 403 races the server's close on Linux.
                conn.putrequest('POST', '/api/image-links', skip_host='Host' in headers)
                headers.setdefault('Content-Length', str(len(body)))
                for name, value in headers.items():
                    conn.putheader(name, value)
                conn.endheaders()
            else:
                conn.request('POST', '/api/image-links', body, headers)
            response = conn.getresponse()
            return response.status, json.loads(response.read())
        finally:
            conn.close()

    def test_authenticated_local_roi_match_and_injected_endpoint(self):
        status, body = self.request(self.payload)
        self.assertEqual(status, 200, body)
        self.assertEqual(body['status'], 'matched', body)
        self.assertEqual(body['coordinateSpace'], 'decoded-image-normalized')
        np.testing.assert_allclose(body['pairs'][0]['parentCorners'],
                                   np.array([[110, 80], [520, 80], [520, 390], [110, 390]])/[640, 480], atol=.006)
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        try:
            conn.request('GET', '/')
            page = conn.getresponse().read().decode('utf-8')
            self.assertIn('"imageLinksEndpoint": "/api/image-links"', page)
        finally:
            conn.close()

    def test_authentication_guards_precede_image_decoding(self):
        with patch('studio_image_links.locate_image_links') as locate:
            for header in [{'Origin': 'https://untrusted.invalid'}, {'Host': 'untrusted.invalid'}, {'X-Studio-Token': ''}]:
                with self.subTest(header=next(iter(header))):
                    self.assertEqual(self.request(self.payload, header, headers_only=True)[0], 403)
            locate.assert_not_called()

    def test_size_schema_roi_and_remote_path_are_rejected(self):
        self.assertEqual(self.request({}, {'Content-Length': '44000001'})[0], 422)
        for payload in [{}, {'images': []}, {**self.payload, 'url': 'https://untrusted.invalid'},
                        {'images': [self.payload['images'][0], {**self.payload['images'][1], 'roi': {'x': 0, 'y': 0, 'w': 2, 'h': 1}}]},
                        {'images': [self.payload['images'][0], {**self.payload['images'][1], 'data': 'https://untrusted.invalid/secret.png'}]}]:
            with self.subTest(keys=list(payload)):
                self.assertEqual(self.request(payload)[0], 422)

    def test_failed_engine_returns_error_without_a_fabricated_match(self):
        with patch('studio_image_links.locate_image_links', side_effect=RuntimeError('Synthetic unavailable engine')):
            status, body = self.request(self.payload)
            self.assertEqual(status, 500)
            self.assertEqual(body, {'error': 'Synthetic unavailable engine'})


if __name__ == '__main__':
    unittest.main()

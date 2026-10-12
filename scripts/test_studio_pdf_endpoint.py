"""Exercise local PDF import boundaries without exposing a filesystem or remote URL API."""
from __future__ import annotations
import base64
import http.client
import json
from pathlib import Path
import sys
import threading
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'skills/polish-sci-figures/scripts'))
import studio_server as server


class PdfEndpointTests(unittest.TestCase):
    def test_rejects_bad_and_ambiguous_inputs(self):
        source=base64.b64encode(b'%PDF-1.7\nlocal fixture').decode()
        payload={'data':source,'action':'inspect'}
        for invalid in [None,[],{},dict(payload,url='https://example.com/f.pdf'),
                        dict(payload,path='private.pdf'),dict(payload,action='run'),
                        dict(payload,data=[]),dict(payload,data='***'),
                        dict(payload,data=base64.b64encode(b'not a pdf').decode()),
                        dict(payload,page=True),dict(payload,page=-1),dict(payload,page=1.5)]:
            with self.subTest(payload=invalid),self.assertRaises(ValueError):server.import_pdf(invalid)

    def test_routes_bytes_and_zero_based_pages(self):
        import studio_pdf
        raw=b'%PDF-1.7\nlocal fixture'
        payload={'data':base64.b64encode(raw).decode(),'action':'inspect'}
        with patch.object(studio_pdf,'inspect_pdf',return_value={'pageCount':3}) as inspect:
            self.assertEqual(server.import_pdf(payload),{'pageCount':3});inspect.assert_called_once_with(raw)
        with patch.object(studio_pdf,'import_pdf_page',return_value={'svg':'<svg/>'}) as page:
            self.assertEqual(server.import_pdf(dict(payload,action='page',page=2)),{'svg':'<svg/>'});page.assert_called_once_with(raw,2)

    def test_http_authorization_and_isolation(self):
        service=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        service.address=f'127.0.0.1:{service.server_port}';service.token='local-pdf-test-token'
        worker=threading.Thread(target=service.serve_forever,daemon=True);worker.start()
        headers={'Host':service.address,'Origin':'http://'+service.address,'X-Studio-Token':service.token,'Content-Type':'application/json'}
        def request(body,changes=None,path='/api/import-pdf'):
            client=http.client.HTTPConnection('127.0.0.1',service.server_port,timeout=5)
            client.request('POST',path,json.dumps(body),headers={**headers,**(changes or {})})
            response=client.getresponse();result=(response.status,json.loads(response.read()));client.close();return result
        try:
            with patch.object(server,'import_pdf',return_value={'pageCount':1}) as read:
                status,result=request({'data':'fixture','action':'inspect'})
                self.assertEqual(status,200);self.assertEqual(result['pdf'],{'pageCount':1});self.assertEqual(read.call_count,1)
                for change in [{'Host':'example.com'},{'Origin':'https://example.com'},{'X-Studio-Token':'wrong'}]:
                    self.assertEqual(request({'data':'fixture','action':'inspect'},change)[0],403)
                self.assertEqual(read.call_count,1,'Rejected requests must not enter the PDF parser')
            status,result=request({'data':'broken','action':'page'})
            self.assertEqual(status,422);self.assertIn('error',result)
            # A long PDF request must not expand limits for the existing data engine.
            self.assertEqual(request({},changes={'Content-Length':'3000001'},path='/api/render')[0],422)
        finally:service.shutdown();service.server_close();worker.join(timeout=2)


if __name__=='__main__':unittest.main()

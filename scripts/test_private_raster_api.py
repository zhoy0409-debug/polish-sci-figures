"""Explicit local case file -> actual authenticated raster HTTP endpoints.

The JSON case file and image payloads remain private; the result contains only
anonymous test IDs, status/kind/geometry/reasons. Paths must remain beneath the
case-file directory. No remote host is contacted. Intended for licensed local QA.
"""
from __future__ import annotations
import argparse,base64,hashlib,http.client,json,re,secrets,sys,threading,time
from urllib.parse import urlsplit
from http.server import ThreadingHTTPServer
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/polish-sci-figures/scripts'))
from studio_server import Handler


def run(cases_file,out,base_url=None):
    cases_file=Path(cases_file).resolve(strict=True)
    cases=json.loads(cases_file.read_text(encoding='utf-8'))
    server=None
    host_info={}
    if base_url:
        parsed=urlsplit(base_url)
        if (parsed.scheme!='http' or parsed.hostname!='127.0.0.1' or not parsed.port or
                parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('','/')):
            raise ValueError('Existing-server validation accepts only an explicit http://127.0.0.1:PORT/ origin')
        port=parsed.port
        address='127.0.0.1:'+str(port)
        connection=http.client.HTTPConnection('127.0.0.1',port,timeout=30)
        connection.request('GET','/')
        response=connection.getresponse()
        markup=response.read().decode('utf-8')
        connection.close()
        if response.status!=200:raise ValueError('Existing local editor is not ready')
        match=re.search(r'<script[^>]*\bid=["\']local-engine["\'][^>]*>(.*?)</script>',markup,re.S|re.I)
        if match is None:raise ValueError('Local editor did not provide an engine configuration')
        settings=json.loads(match.group(1))
        token=settings['token']
        host_info={key:settings.get('updateInfo',{}).get(key) for key in
                   ('currentVersion','suiteVersion','platform','architecture','packaged')}
    else:
        server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        port=server.server_port
        server.address=address='127.0.0.1:'+str(port)
        server.token=token=secrets.token_urlsafe(32)
        server.page=cases_file
        threading.Thread(target=server.serve_forever,daemon=True).start()
    def post(path,payload,authorized=True):
        connection=http.client.HTTPConnection('127.0.0.1',port,timeout=180)
        headers={'Content-Type':'application/json','Origin':'http://'+address}
        if authorized:headers['X-Studio-Token']=token
        connection.request('POST',path,json.dumps(payload),headers)
        response=connection.getresponse()
        status,value=response.status,json.loads(response.read())
        connection.close()
        return status,value
    records=[]
    try:
        assert post('/api/image-duplicates',{'action':'start','images':[]},False)[0]==403
        for case in cases['cases']:
            if case['expected']=='error' and not isinstance(case.get('errorContains'),str):
                raise ValueError('Expected errors must state errorContains; any error is not proof of the intended boundary')
            images=[]
            for i,record in enumerate(case['files']):
                path=(cases_file.parent/record['path']).resolve(strict=True)
                if cases_file.parent not in path.parents:raise ValueError('Source path escapes case directory')
                raw=path.read_bytes()
                if hashlib.sha256(raw).hexdigest()!=record['sha256']:raise ValueError('Source SHA mismatch')
                with Image.open(path) as image:fmt=image.format.lower()
                images.append({'id':f'image-{i+1}','label':f'image-{i+1}',
                               'data':'data:image/'+fmt+';base64,'+base64.b64encode(raw).decode('ascii')})
            if case['endpoint']=='links':
                status,value=post('/api/image-links',{'images':images})
                if status==200:
                    pair=value['pairs'][0]
                    observed=pair['status']
                    detail={k:pair[k] for k in ('reason','quality','parentCorners') if k in pair}
                else:observed,detail='error',{'reason':value.get('error')}
            else:
                status,value=post('/api/image-duplicates',{'action':'start','images':images})
                if status!=200:observed,detail='error',{'reason':value.get('error')}
                else:
                    deadline=time.monotonic()+120
                    while time.monotonic()<deadline:
                        _,result=post('/api/image-duplicates',{'action':'status','jobId':value['jobId']})
                        if result['status']!='running':break
                        time.sleep(.05)
                    if result['status']=='complete':
                        matches=result['result']['matches']
                        observed=matches[0]['kind'] if matches else 'no_match'
                        detail={'matches':len(matches),'highDepthPreviewCount':sum('high_bit_depth_preview' in x['warnings'] for x in result['result']['images'])}
                    else:observed,detail=result['status'],{'reason':result.get('error')}
            passed=observed==case['expected']
            if case['expected']=='error':
                passed=passed and case['errorContains'] in (detail.get('reason') or '')
            row={'id':case['id'],'status':'PASS' if passed else 'FAIL','expected':case['expected'],
                 'observed':observed,'detail':detail}
            records.append(row)
            print(json.dumps(row),flush=True)
    finally:
        if server is not None:
            server.shutdown();server.server_close()
    result={'schema':'private-raster-api-validation/1','status':'PASS' if all(r['status']=='PASS' for r in records) else 'FAIL',
            'unauthorizedRequestRejected':True,'network':'authenticated 127.0.0.1 only',
            'hostMode':'existing_local_server' if base_url else 'isolated_source_server',
            'hostInfo':host_info,
            'independentBlindStudy':False,'cases':records}
    Path(out).parent.mkdir(parents=True,exist_ok=True)
    Path(out).write_text(json.dumps(result,indent=2),encoding='utf-8')
    return result['status']=='PASS'


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cases',type=Path)
    parser.add_argument('--out',type=Path)
    parser.add_argument('--base-url',help='Optional already-running INSTALLED local editor origin; this tool never stops that server')
    args=parser.parse_args()
    if args.cases is None and args.out is None:
        print(json.dumps({'status':'NOT_RUN','reason':'Licensed local cases and output path must be supplied explicitly; no private files read'}))
        raise SystemExit(0)
    if args.cases is None or args.out is None:
        parser.error('--cases and --out must be provided together')
    raise SystemExit(0 if run(args.cases,args.out,args.base_url) else 1)

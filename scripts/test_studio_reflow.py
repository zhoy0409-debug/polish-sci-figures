"""Exact-size reflow integration: one selected SVG, unchanged data, guarded HTTP."""
import copy
import http.client
import json
import sys
import threading
import hashlib
import xml.etree.ElementTree as ET
import time
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'skills/make-sci-data-figures/scripts'),
              str(ROOT/'skills/polish-sci-figures/scripts')]
import numpy as np
import matplotlib.pyplot as plt
import gallery_registry as registry
from gallery_layout import REVIEWED
import studio_server as server
import roc_explorer
from test_studio_roc_sizes import raw_fixture
from build_gallery_styles import fixtures as baseline_fixtures

OUTPUT=ROOT/'.cache/studio-reflow-qa'
OUTPUT.mkdir(parents=True,exist_ok=True)


def table(frame):
    return [list(frame.columns)]+frame.astype(str).values.tolist()


def checked(recipe,rows,dimensions,label):
    original=(copy.deepcopy(recipe),copy.deepcopy(rows))
    start=time.monotonic()
    with patch.object(registry,'render_sizes',side_effect=AssertionError('Unexpected size bundle')):
        with patch.object(server,'regenerate',side_effect=AssertionError('Unexpected full analysis')):
            with patch.object(registry,'svg_at_size',wraps=registry.svg_at_size) as one:
                with patch.object(roc_explorer,'render_views',wraps=roc_explorer.render_views) as roc:
                    variant=server.reflow(recipe,rows,*dimensions)
    assert (recipe,rows)==original,'Reflow changed the input table or recipe'
    assert variant['preserveAspect'] is True
    np.testing.assert_allclose([variant['width'],variant['height']],dimensions,atol=1e-5,rtol=0)
    assert '<svg' in variant['svg'] and '<text' in variant['svg'] and '<image' not in variant['svg']
    assert 'studio-plot-frame' in variant['svg']
    if recipe['family']=='gallery':assert one.call_count==1 and roc.call_count==0
    else:
        assert roc.call_count==1 and one.call_count==0
        assert roc.call_args.kwargs['views']=={recipe['studio_view']}
    assert not plt.get_fignums(),'A figure leaked after reflow'
    (OUTPUT/(label+'.svg')).write_text(variant['svg'],encoding='utf-8')
    return {'label':label,'dimensions':dimensions,'seconds':round(time.monotonic()-start,3),
            'sha256':variant['sha256'], 'geometry_sha256':hashlib.sha256('\n'.join(
                element.attrib.get('d','') for element in ET.fromstring(variant['svg']).iter()
                if element.tag.endswith('}path')).encode()).hexdigest()}


def rejected(recipe,rows,width=369.25,height=248.5):
    before=(copy.deepcopy(recipe),copy.deepcopy(rows))
    try:server.reflow(recipe,rows,width,height)
    except (ValueError,TypeError,KeyError):pass
    else:raise AssertionError('Invalid reflow input was accepted')
    assert (recipe,rows)==before


def http_checks(recipe,rows):
    service=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
    service.address='127.0.0.1:'+str(service.server_port)
    service.token='test-reflow-token';service.page=OUTPUT/'http-page.html'
    service.page.write_text("<html><head></head><body></body></html>",encoding='utf-8')
    worker=threading.Thread(target=service.serve_forever,daemon=True);worker.start()
    payload={'recipe':recipe,'rows':rows,'width':413.75,'height':266.5}
    count=0
    def request(path='/api/reflow',body=None,headers=None,method='POST'):
        nonlocal count
        client=http.client.HTTPConnection('127.0.0.1',service.server_port,timeout=45)
        base={'Host':service.address,'Origin':'http://'+service.address,
              'X-Studio-Token':service.token,'Content-Type':'application/json'}
        if headers:base.update(headers)
        client.request(method,path,json.dumps(payload if body is None else body),headers=base)
        response=client.getresponse();data=response.read();status=response.status;client.close();count+=1
        return status,data
    real=server.reflow
    def locked(*args):
        assert server.LOCK.locked(),'The HTTP endpoint bypassed the drawing lock'
        return real(*args)
    try:
        with patch.object(server,'reflow',side_effect=locked):
            status,data=request();assert status==200,(status,data)
            result=json.loads(data);assert set(result)=={'variant','seconds'}
            assert result['variant']['preserveAspect'] and result['variant']['width']==413.75
        for headers in ({'Host':'evil.invalid'},{'Origin':'http://evil.invalid'},
                        {'X-Studio-Token':'wrong'}):
            assert request(headers=headers)[0]==403
        assert request(path='/api/unknown')[0]==403
        for body in ([],{},dict(payload,width=True),dict(payload,height=1441),dict(payload,code='run()')):
            status,data=request(body=body);assert status==422,(status,data)
        with patch.object(server,'regenerate',return_value={'legacy':True}) as legacy:
            status,data=request(path='/api/render',body={'recipe':recipe,'rows':rows})
            assert status==200 and json.loads(data)['panel']=={'legacy':True} and legacy.call_count==1
        status,data=request(path='/',method='GET')
        assert status==200 and b'"reflowEndpoint": "/api/reflow"' in data
    finally:
        service.shutdown();service.server_close();worker.join(timeout=2)
    return count


def main():
    report=[]
    reviewed=sorted(REVIEWED & registry.CONTRACTS.keys())
    # Physical sizes deliberately do not match any pre-generated layout size.
    sizes=[(369.25,248.5),(643.5,317.25),(263.5,429.75)]
    for view in reviewed:
        frame=getattr(registry.OWNERS[view],'fixtures',baseline_fixtures)()[view]
        recipe={'family':'gallery','parameters':{'view':view},'font':'Arial'}
        for index,dimensions in enumerate(sizes):
            report.append(checked(recipe,table(frame),dimensions,f'{view}_{index}'))
    base_recipe={'family':'roc','parameters':{'outcome':'outcome','score':'score','unit':'unit',
                 'cohort':'cohort','positive':'1'},'font':'Arial'}
    raw=raw_fixture();raw_rows=table(raw)
    for view in ['roc_pointwise_band','roc_bootstrap_curves']:
        recipe=dict(base_recipe,studio_view=view)
        for index,dimensions in enumerate(sizes):
            report.append(checked(recipe,raw_rows,dimensions,f'{view}_{index}'))
        changed=raw.copy(deep=True);changed.loc[changed.outcome==1,'score']+=.85
        updated=checked(recipe,table(changed),sizes[0],view+'_updated')
        assert updated['geometry_sha256']!=next(x['geometry_sha256'] for x in report if x['label']==view+'_0')
        report.append(updated)
    gallery_recipe={'family':'gallery','parameters':{'view':'clustered_matrix'}}
    gallery_rows=table(registry.OWNERS['clustered_matrix'].fixtures()['clustered_matrix'])
    invalid=0
    for value in [None,True,'360',float('nan'),float('inf'),-10,0,140,1441,10**500]:
        rejected(gallery_recipe,gallery_rows,width=value);invalid+=1
    for value in [None,False,'260',float('-inf'),-1,0,134,1441]:
        rejected(gallery_recipe,gallery_rows,height=value);invalid+=1
    bad_tables=[[],[['a']],['a',['x']],[['a','a'],['1','2']],[['a'],['1','2']],
                [['a'],[1]],[[''],['x']],[['a'],['x'*1001]],[['a']]+[['1']]*10001]
    for rows in bad_tables:rejected(gallery_recipe,rows);invalid+=1
    for recipe in [None,[],dict(gallery_recipe,font=[]),dict(gallery_recipe,palette=2),
                   dict(gallery_recipe,colors=['red']),dict(gallery_recipe,family='unknown'),
                   dict(gallery_recipe,parameters={'view':'unreviewed'}),
                   dict(gallery_recipe,parameters={'view':'clustered_matrix','code':'run()'})]:
        rejected(recipe,gallery_rows);invalid+=1
    raw_recipe=dict(base_recipe,studio_view='roc_pointwise_band')
    for params in [dict(base_recipe['parameters'],score='missing'),
                   dict(base_recipe['parameters'],score='unit'),
                   dict(base_recipe['parameters'],positive='unobserved'),
                   dict(base_recipe['parameters'],positive=True),
                   dict(base_recipe['parameters'],code='run()'),
                   {'outcome':'outcome','score':'score'}]:
        rejected(dict(raw_recipe,parameters=params),raw_rows);invalid+=1
    for edit in ['duplicate','blank','nonfinite','nonnumeric','one_class','one_per_class','seven_cohorts']:
        bad=raw.copy(deep=True)
        if edit=='duplicate':bad.loc[1,'unit']=bad.loc[0,'unit']
        elif edit=='blank':bad.loc[0,'unit']=' '
        elif edit=='nonfinite':bad.loc[0,'score']=float('inf')
        elif edit=='nonnumeric':bad['score']=bad.score.astype(str);bad.loc[0,'score']='missing'
        elif edit=='one_class':bad['outcome']=1
        elif edit=='one_per_class':bad=bad.iloc[:2]
        else:bad['cohort']=[str(i//4) for i in range(len(bad))]
        rejected(raw_recipe,table(bad));invalid+=1
    rejected(dict(raw_recipe,studio_view='roc_confusion'),raw_rows);invalid+=1
    http_count=http_checks(gallery_recipe,gallery_rows)
    # Existing callers still receive all six optional size variants.
    from build_original_roc_styles import fixtures as result_fixtures
    from studio_roc_sizes import render_sizes
    frame,options=result_fixtures()['partial']
    source=OUTPUT/'legacy-results.csv';frame.to_csv(source,index=False)
    legacy_recipe={'family':'roc_results','parameters':{'view':'partial',**options}}
    legacy=list(render_sizes(source,legacy_recipe,{}))
    assert {size for _,size,_ in legacy}==set(registry.SIZES)-{'original'}
    assert all(name=='roc_partial' and b'<svg' in raw for name,_,raw in legacy)
    summary={'reviewed_gallery_views':len(reviewed),'render_checks':len(report),
             'rejected_invalid_inputs':invalid,'http_checks':http_count,
             'legacy_size_variants':len(legacy),'results':report}
    (OUTPUT/'report.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in summary.items() if k!='results'}))


if __name__=='__main__':main()

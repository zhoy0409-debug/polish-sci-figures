"""Original-family statistics, data identity and real facet-size rendering checks."""
from __future__ import annotations
import copy
import http.client
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from http.server import ThreadingHTTPServer

ROOT=Path(__file__).resolve().parents[1]
TEST_TMP=(ROOT/'.cache/facet-split-test-tmp').resolve()
assert TEST_TMP.is_relative_to(ROOT.resolve())
TEST_TMP.mkdir(parents=True,exist_ok=True)
tempfile.tempdir=str(TEST_TMP)
sys.path.insert(0,str(ROOT/'skills/polish-sci-figures/scripts'))
import studio_server
from studio_facets import split_facets, title_svg
from studio_statistics import analyze, table_hash

RECIPE={'family':'gallery','parameters':{'view':'compare_facet_boxes'},'font':'Arial'}
CONFIG=dict(group='group',value='value',unit='unit',facet='factor',design='independent',
            method='welch',family='all_pairs',design_confirmed=True,unit_role='independent_experimental_unit')
ROWS=[['factor','group','unit','value']]+[[day,group,f'{group}-{i}',str((fi*1.6)+(gi*.5)+((i*7)%13)/6)]
        for fi,day in enumerate(['Day 1','Day 7','Day 14']) for gi,group in enumerate(['Control','Low','High']) for i in range(12)]


def record(rows=ROWS):
    result=analyze(RECIPE,rows,CONFIG)
    return {**result,'binding':'current','tableKey':table_hash(rows)}


def stub_render(recipe,rows,statistics=None,axes=None):
    return {'recipe':copy.deepcopy(recipe),'table':{'rows':copy.deepcopy(rows),'sha256':table_hash(rows)},'variants':[]}


class SplitContracts(unittest.TestCase):
    def test_exact_rows_and_original_global_holm(self):
        original=copy.deepcopy(ROWS);stats=record();stats_before=copy.deepcopy(stats)
        # A client-side mutated display record cannot replace server calculations.
        stats['analysis']['facets'][0]['primary_test']['pairwise'][0]['p']=.999
        with patch('studio_server.regenerate',side_effect=stub_render):
            result=split_facets(RECIPE,ROWS,stats)
        self.assertEqual(ROWS,original)
        self.assertEqual(result['source']['comparison_count'],9)
        original_facets=stats_before['analysis']['facets']
        for i,item in enumerate(result['panels']):
            p=item['panel'];s=p['statistics'];facet=item['facet']['value']
            self.assertEqual(p['table']['rows'],[ROWS[0]]+[row for row in ROWS[1:] if row[0]==facet])
            self.assertEqual(s['analysis']['primary_test'],original_facets[i]['primary_test'])
            self.assertEqual(s['analysis']['comparison_count'],9)
            self.assertEqual(s['analysis']['facet_comparison_count'],3)
            self.assertEqual(s['binding'],'results');self.assertEqual(s['tableKey'],p['table']['sha256'])
            self.assertEqual(s['analysis']['split_family']['source_data_sha256'],table_hash(ROWS))
            self.assertEqual(len(s['analysis']['split_family']['facets']),3)
            again=analyze(p['recipe'],s['inputRows'],s['config'])
            self.assertEqual([c['p'] for c in again['analysis']['primary_test']['pairwise']],
                             [c['p'] for c in original_facets[i]['primary_test']['pairwise']])
            local=analyze(p['recipe'],p['table']['rows'],{k:v for k,v in CONFIG.items() if k!='facet'})
            self.assertNotEqual([c['p'] for c in local['analysis']['primary_test']['pairwise']],
                                [c['p'] for c in s['analysis']['primary_test']['pairwise']], 'split must not shrink the Holm family')
        self.assertEqual(len({json.dumps(item['panel']['recipe']['axis_settings'],sort_keys=True) for item in result['panels']}),1)

    def test_invalid_or_stale_never_renders(self):
        stats=record()
        for altered in [{**stats,'stale':True},{**stats,'tableKey':'x'*64},{**stats,'data_sha256':'f'*64},
                        {**stats,'config':{**CONFIG,'facet':''}}]:
            with self.subTest(altered=altered),patch('studio_server.regenerate') as render,self.assertRaises(ValueError):
                split_facets(RECIPE,ROWS,altered)
            render.assert_not_called()
        with self.assertRaises(ValueError):split_facets({'family':'gallery','parameters':{'view':'compare_interaction'}},ROWS)

    def test_external_results_preserve_whole_family(self):
        original=record();rows=[['time','first','second','p']]+[[f['label'],c['group_a'],c['group_b'],repr(c['p'])]
              for f in original['analysis']['facets'] for c in f['primary_test']['pairwise']]
        config=dict(mode='results',group_a='first',group_b='second',p_value='p',facet='time',
                    family='all_pairs',method_label='Welch tests',adjustment='already_adjusted',correction_method='Holm (9 comparisons)',results_confirmed=True)
        stats={**analyze(RECIPE,rows,config),'binding':'results','tableKey':table_hash(ROWS),'inputRows':rows}
        with patch('studio_server.regenerate',side_effect=stub_render):result=split_facets(RECIPE,ROWS,stats)
        for i,item in enumerate(result['panels']):
            self.assertEqual(item['panel']['statistics']['analysis']['primary_test']['pairwise'],stats['analysis']['facets'][i]['primary_test']['pairwise'])
        with patch('studio_server.regenerate',side_effect=stub_render):plain=split_facets(RECIPE,ROWS)
        self.assertTrue(all('statistics' not in item['panel'] for item in plain['panels']))

    def test_title_escaped_and_bound_to_actual_facet(self):
        context=dict(column='factor',value='Day 1',label='Day 1 < 2',source_data_sha256=table_hash(ROWS))
        subset=[ROWS[0]]+[r for r in ROWS[1:] if r[0]=='Day 1'];recipe={**RECIPE,'facet_context':context}
        raw=title_svg(b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 345.6 259.2"/>',recipe,subset)
        self.assertIn(b'studio-facet-title',raw);self.assertIn(b'Day 1 &lt; 2',raw)
        with self.assertRaises(ValueError):title_svg(raw,recipe,ROWS)

    def test_authenticated_http_route(self):
        with tempfile.TemporaryDirectory() as tmp:
            page=Path(tmp)/'index.html';page.write_text('<head></head>')
            server=ThreadingHTTPServer(('127.0.0.1',0),studio_server.Handler);server.address=f'127.0.0.1:{server.server_port}';server.token='split-test';server.page=page
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            def post(payload,token='split-test'):
                conn=http.client.HTTPConnection(server.address,timeout=15);conn.request('POST','/api/split-facets',json.dumps(payload),{'Origin':'http://'+server.address,'X-Studio-Token':token,'Content-Type':'application/json'});response=conn.getresponse();data=json.loads(response.read());status=response.status;conn.close();return status,data
            try:
                payload={'recipe':RECIPE,'rows':ROWS}
                with patch('studio_facets.split_facets',return_value={'panels':[]}) as split:
                    self.assertEqual(post(payload)[0],200);split.assert_called_once_with(RECIPE,ROWS,None)
                self.assertEqual(post(payload,'wrong')[0],403)
                self.assertEqual(post({**payload,'execute':'bad'})[0],422)
            finally:server.shutdown();server.server_close();thread.join(5)


def real_render():
    result=split_facets(RECIPE,ROWS,record())
    destination=ROOT/'.cache/facet-split-qa';destination.mkdir(parents=True,exist_ok=True)
    (destination/'result.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
    for i,item in enumerate(result['panels']):
        panel=item['panel'];recipe=panel['recipe'];rows=panel['table']['rows']
        assert len(panel['variants'])>=7
        for variant in panel['variants']:assert 'studio-facet-title' in variant['svg']
        for label,width,height in [('square',259.2,259.2),('wide',518.4,259.2),('tall',345.6,388.8)]:
            svg=studio_server.reflow(recipe,rows,width,height)['svg']
            assert 'studio-facet-title' in svg
            (destination/f'{i}-{label}.svg').write_text(svg,encoding='utf-8')
        edited=copy.deepcopy(rows);edited[1][3]=str(float(edited[1][3])+2)
        changed=studio_server.regenerate(recipe,edited)
        assert 'statistics' not in changed, 'a split snapshot must not silently recompute a smaller family'
        assert changed['recipe']['facet_context']==recipe['facet_context']
        assert changed['table']['sha256']!=panel['table']['sha256']
    print('PASS real render: 3 editable split panels, all size variants, 9 physical reflows, title persistence, changed raw values and no accidental subgroup reanalysis. '+str(destination))


if __name__=='__main__':
    if '--render' in sys.argv:real_render()
    else:unittest.main(verbosity=2)

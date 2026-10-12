"""Verify exact cell metadata after clustering, data replacement and resizing."""
import io
import json
import re
import struct
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'skills/make-sci-data-figures/scripts'),str(ROOT/'skills/polish-sci-figures/scripts')]
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.collections import QuadMesh
from gallery_heatmap import contrast_color
import gallery_registry as registry
import data_family_workbench as legacy
from build_gallery_styles import fixtures
from figure_studio import inspect_svg_bytes,write_html

PATTERN=re.compile(r'studio-heat-value-(\d+)-([a-f\d]{16})-([a-f\d]{6})-([01])-(\d)-([a-f\d]{16})-([sd])-([a-f\d]{16})')

def check(fig,key):
    stream=io.BytesIO()
    with plt.rc_context({'svg.fonttype':'none'}):fig.savefig(stream,format='svg',metadata={'Date':None})
    raw=stream.getvalue();root=ET.fromstring(raw)
    ids=[el.attrib.get('id','') for el in root.iter()]
    records=[PATTERN.fullmatch(i) for i in ids if i.startswith('studio-heat-value-')]
    assert records and all(records),(key,'missing vector values')
    decoded=np.array([struct.unpack('>d',bytes.fromhex(m[2]))[0] for m in records])
    assert len(set(ids)-{''})==len([i for i in ids if i]),(key,'duplicate ids')
    assert all('studio-heat-box-'+m[1] in ids for m in records)
    actual=[];normalized=[]
    for ax in fig.axes:
        if any((text.get_gid() or '').startswith('studio-heat-value-') for text in ax.texts):
            meshes=[c for c in ax.collections if isinstance(c,QuadMesh)]
            if meshes:
                vals=np.ma.asarray(meshes[0].get_array()).compressed();actual.extend(vals.tolist());normalized.extend(meshes[0].norm(vals).tolist())
            elif ax.images:
                vals=np.ma.asarray(ax.images[0].get_array()).compressed();actual.extend(vals.tolist());normalized.extend(ax.images[0].norm(vals).tolist())
    if actual:
        np.testing.assert_allclose(decoded,np.asarray(actual).ravel(),atol=0,rtol=0)
        np.testing.assert_allclose([struct.unpack('>d',bytes.fromhex(m[6]))[0] for m in records],normalized,atol=0,rtol=0)
    for axis in fig.axes:
        bar=getattr(axis,'_colorbar',None)
        if bar is not None and bar.solids is not None:
            gid=bar.solids.get_gid()
            assert gid and gid.startswith('studio-heat-scale-'),(key,'unbound colorbar')
            encoded=gid.split('-')[-1].split('_')
            np.testing.assert_allclose([struct.unpack('>d',bytes.fromhex(v))[0] for v in encoded],bar.norm(np.asarray(bar.solids.get_array()).ravel()),atol=0,rtol=0)
    assert b'<text' in raw
    return raw,len(decoded)

def main():
    out=ROOT/'.cache/heatmap-qa';out.mkdir(parents=True,exist_ok=True)
    tables=fixtures()
    for module in registry.MODULES[1:]:tables.update(module.fixtures())
    keys=['correlation_values','clustered_matrix','checkerboard_assay','antibiogram_matrix','classification_counts','time_month_matrix','time_calendar','missingness_matrix']
    report=[];panels=[]
    for key in keys:
        for edited in [False,True]:
            d=tables[key].copy()
            if edited:
                if key=='antibiogram_matrix':d['susceptible']=(d.susceptible*.8).astype(int)
                elif key=='classification_counts':d['count']+=3
                elif key=='checkerboard_assay':d['inhibition']*=.8
                elif key=='missingness_matrix':d['observed']=1-d.observed
                else:d['value']=d.value*1.19+.037
            for size,dimensions in [('normal',(4.8,3.6)),('wide',(7.2,3.6)),('portrait',(3.6,4.8))]:
                fig=registry.render(d,key,figsize=dimensions);raw,count=check(fig,key)
                report.append({'key':key,'edited':edited,'size':size,'cells':count})
                if not edited and key in ['correlation_values','clustered_matrix']:
                    dest=out/f'{key}-{size}.svg';dest.write_bytes(raw)
                    p=next((p for p in panels if p['name']==key),None)
                    if p is None:p={'id':f'panel-{len(panels)}','name':key,'variants':[],'initialVariant':0};panels.append(p)
                    p['variants'].append({**inspect_svg_bytes(raw,key),'size':'original' if size=='normal' else size,'preserveAspect':True})
                plt.close(fig)
    # Ordinary signed matrices include genuinely missing cells, which stay blank.
    original=legacy.FIGSIZE
    for edited in [False,True]:
        values=np.array([[-1.23456,0,1.23456],[3.14159,np.nan,-.00001]])*(1.7 if edited else 1)
        for size,dimensions in [('normal',(4.8,3.6)),('wide',(7.2,3.6)),('portrait',(3.6,4.8))]:
            legacy.FIGSIZE=dimensions
            figures=legacy._matrix_figures(pd.DataFrame(values,index=['Row A','Row B'],columns=['One','Two','Three']),registry.COLORS)
            raw,count=check(figures[0][1],'matrix_heatmap');assert count==5
            report.append({'key':'matrix_heatmap','edited':edited,'size':size,'cells':count})
            if not edited:
                p=next((p for p in panels if p['name']=='matrix_heatmap'),None)
                if p is None:p={'id':f'panel-{len(panels)}','name':'matrix_heatmap','variants':[],'initialVariant':0};panels.append(p)
                p['variants'].append({**inspect_svg_bytes(raw,'matrix_heatmap'),'size':'original' if size=='normal' else size,'preserveAspect':True})
            for _,f in figures:plt.close(f)
    legacy.FIGSIZE=original
    assert contrast_color('#ffffff')=='#000000' and contrast_color('#000000')=='#ffffff'
    project={'schema':'figure-studio/1','id':'e9c367ac098a4398c145','title':'Heatmap value QA','panels':panels,'initialState':{'order':[p['id'] for p in panels],'columns':3,'gap':14,'panels':{p['id']:{'variant':0,'edits':{}} for p in panels}}}
    dest=out/'heatmap-studio.html'
    if dest.exists():dest.unlink()
    write_html(project,dest)
    (out/'metadata-results.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print(f'{len(report)} exact metadata checks passed; {dest}')

if __name__=='__main__':main()
